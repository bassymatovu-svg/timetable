import React, { useState, useRef } from "react"
import { Users, Plus, Trash2, Edit2, Check, X, CalendarOff, UploadCloud, Download } from "lucide-react"
import * as XLSX from "xlsx"
import { useDataStore } from "@/stores/useDataStore"
import type { Teacher, Period } from "@/types/database"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri"]

export function TeachersManager() {
  const {
    currentInstitutionId,
    teachers,
    profiles,
    subjects,
    periods,
    teacherUnavailability,
    addTeacher,
    updateTeacher,
    deleteTeacher,
    setTeacherUnavailability,
  } = useDataStore()

  const instTeachers = teachers.filter((t) => t.institution_id === currentInstitutionId)
  const instSubjects = subjects.filter((s) => s.institution_id === currentInstitutionId)
  const instPeriods = periods.filter((p) => p.institution_id === currentInstitutionId)

  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [unavailTeacherId, setUnavailTeacherId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Add form
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [maxDaily, setMaxDaily] = useState(5)
  const [maxWeekly, setMaxWeekly] = useState(22)
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([])

  // Edit form
  const [editName, setEditName] = useState("")
  const [editEmail, setEditEmail] = useState("")
  const [editMaxDaily, setEditMaxDaily] = useState(5)
  const [editMaxWeekly, setEditMaxWeekly] = useState(22)
  const [editSubjects, setEditSubjects] = useState<string[]>([])

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim() || !email.trim()) return

    addTeacher({
      institution_id: currentInstitutionId,
      fullName: fullName.trim(),
      email: email.trim(),
      max_periods_per_day: Number(maxDaily),
      max_periods_per_week: Number(maxWeekly),
      qualified_subject_ids: selectedSubjects,
    })

    setFullName("")
    setEmail("")
    setSelectedSubjects([])
    setIsAdding(false)
  }

  const startEdit = (teacher: Teacher) => {
    const prof = profiles.find((p) => p.id === teacher.id)
    setEditingId(teacher.id)
    setEditName(prof?.full_name || "")
    setEditEmail(prof?.email || "")
    setEditMaxDaily(teacher.max_periods_per_day)
    setEditMaxWeekly(teacher.max_periods_per_week)
    setEditSubjects(teacher.qualified_subject_ids || [])
  }

  const saveEdit = (id: string) => {
    updateTeacher(id, {
      fullName: editName,
      email: editEmail,
      max_periods_per_day: Number(editMaxDaily),
      max_periods_per_week: Number(editMaxWeekly),
      qualified_subject_ids: editSubjects,
    })
    setEditingId(null)
  }

  const toggleSubject = (subId: string, currentList: string[], setter: (val: string[]) => void) => {
    if (currentList.includes(subId)) {
      setter(currentList.filter((id) => id !== subId))
    } else {
      setter([...currentList, subId])
    }
  }

  // Teacher Unavailability Matrix modal helpers
  const activeUnavailTeacher = instTeachers.find((t) => t.id === unavailTeacherId)
  const activeUnavailProfile = profiles.find((p) => p.id === unavailTeacherId)
  const currentUnavailPeriodIds = teacherUnavailability
    .filter((u) => u.teacher_id === unavailTeacherId)
    .map((u) => u.period_id)

  const toggleUnavailabilitySlot = (periodId: string) => {
    if (!unavailTeacherId) return
    let updated: string[]
    if (currentUnavailPeriodIds.includes(periodId)) {
      updated = currentUnavailPeriodIds.filter((id) => id !== periodId)
    } else {
      updated = [...currentUnavailPeriodIds, periodId]
    }
    setTeacherUnavailability(unavailTeacherId, updated)
  }

  const periodNumbers = Array.from(new Set(instPeriods.map((p) => p.period_number))).sort(
    (a, b) => a - b
  )

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result
        const wb = XLSX.read(bstr, { type: "binary" })
        const wsname = wb.SheetNames[0]
        const ws = wb.Sheets[wsname]
        const data = XLSX.utils.sheet_to_json<Record<string, any>>(ws)

        let count = 0
        for (const row of data) {
          const tName = row["Name"] || row["Teacher Name"] || row["Full Name"]
          const tEmail = row["Email"] || (tName ? `${String(tName).toLowerCase().replace(/\s+/g, ".")}@school.edu` : "")
          const maxD = Number(row["Max Daily"] || 5)
          const maxW = Number(row["Max Weekly"] || 22)

          if (tName) {
            addTeacher({
              institution_id: currentInstitutionId,
              fullName: String(tName).trim(),
              email: String(tEmail).trim(),
              max_periods_per_day: isNaN(maxD) ? 5 : maxD,
              max_periods_per_week: isNaN(maxW) ? 22 : maxW,
              qualified_subject_ids: instSubjects.slice(0, 2).map((s) => s.id),
            })
            count++
          }
        }
        alert(`Successfully imported ${count} teachers.`)
      } catch (err) {
        alert("Failed to parse spreadsheet.")
      }
    }
    reader.readAsBinaryString(file)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const downloadSampleTemplate = () => {
    const sampleData = [
      { "Full Name": "Jane Doe", Email: "jdoe@school.edu", "Max Daily": 5, "Max Weekly": 22 },
      { "Full Name": "John Smith", Email: "jsmith@school.edu", "Max Daily": 6, "Max Weekly": 25 },
    ]
    const ws = XLSX.utils.json_to_sheet(sampleData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Teachers")
    XLSX.writeFile(wb, "teachers_template.xlsx")
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Faculty &amp; Teaching Availability</h2>
          <p className="text-xs text-slate-500">
            Manage teacher profiles, weekly/daily period limits, subject qualifications, and declared unavailabilities.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".csv,.xlsx,.xls"
            className="hidden"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={downloadSampleTemplate}
            className="gap-1.5 text-xs"
          >
            <Download className="w-3.5 h-3.5" />
            Template
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="gap-1.5 text-xs"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            Import CSV / Excel
          </Button>
          <Button
            size="sm"
            onClick={() => setIsAdding(!isAdding)}
            className="gap-1.5 text-xs"
          >
            <Plus className="w-4 h-4" />
            Add Teacher
          </Button>
        </div>
      </div>

      {isAdding && (
        <Card className="border-blue-200 bg-blue-50/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Register Faculty Member</CardTitle>
            <CardDescription className="text-xs">
              Load limits are strictly enforced by both the generator and the drag-and-drop grid.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-slate-700 block mb-1">Full Name</label>
                  <Input
                    placeholder="e.g. Dr. Robert Vance"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-700 block mb-1">Email Address</label>
                  <Input
                    type="email"
                    placeholder="e.g. rvance@school.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-700 block mb-1">Max Periods / Day</label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={maxDaily}
                    onChange={(e) => setMaxDaily(Number(e.target.value))}
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-700 block mb-1">Max Periods / Week</label>
                  <Input
                    type="number"
                    min={1}
                    max={35}
                    value={maxWeekly}
                    onChange={(e) => setMaxWeekly(Number(e.target.value))}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-700 block mb-1.5">
                  Qualified Subject Disciplines (Select all that apply)
                </label>
                <div className="flex flex-wrap gap-1.5 p-2.5 rounded-md border border-slate-200 bg-white">
                  {instSubjects.map((s) => {
                    const isSelected = selectedSubjects.includes(s.id)
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleSubject(s.id, selectedSubjects, setSelectedSubjects)}
                        className={`text-xs px-2.5 py-1 rounded border transition-colors cursor-pointer flex items-center gap-1.5 ${
                          isSelected
                            ? "bg-blue-50 border-blue-400 text-[#1D4ED8] font-medium"
                            : "border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: s.color }}
                        />
                        {s.name} ({s.code})
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAdding(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm">
                  Save Teacher Profile
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Teacher Name &amp; Contact</TableHead>
                <TableHead>Load Caps</TableHead>
                <TableHead>Subject Qualifications</TableHead>
                <TableHead>Unavailability</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {instTeachers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-slate-400">
                    No faculty profiles recorded.
                  </TableCell>
                </TableRow>
              ) : (
                instTeachers.map((teacher) => {
                  const prof = profiles.find((p) => p.id === teacher.id)
                  const unavailCount = teacherUnavailability.filter(
                    (u) => u.teacher_id === teacher.id
                  ).length

                  const isEditing = editingId === teacher.id

                  return (
                    <TableRow key={teacher.id}>
                      <TableCell className="font-medium text-slate-900">
                        {isEditing ? (
                          <div className="space-y-1">
                            <Input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="h-7 text-xs"
                              placeholder="Full Name"
                            />
                            <Input
                              value={editEmail}
                              onChange={(e) => setEditEmail(e.target.value)}
                              className="h-7 text-xs text-slate-500"
                              placeholder="Email"
                            />
                          </div>
                        ) : (
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-xs font-semibold text-slate-700 shrink-0">
                              {(prof?.full_name || "T")
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                                .substring(0, 2)}
                            </div>
                            <div className="flex flex-col">
                              <span>{prof?.full_name || "Teacher Profile"}</span>
                              <span className="text-[10px] text-slate-400">{prof?.email}</span>
                            </div>
                          </div>
                        )}
                      </TableCell>

                      <TableCell>
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <div>
                              <span className="text-[10px] text-slate-400 block">Day</span>
                              <Input
                                type="number"
                                value={editMaxDaily}
                                onChange={(e) => setEditMaxDaily(Number(e.target.value))}
                                className="h-7 text-xs w-14"
                              />
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block">Wk</span>
                              <Input
                                type="number"
                                value={editMaxWeekly}
                                onChange={(e) => setEditMaxWeekly(Number(e.target.value))}
                                className="h-7 text-xs w-14"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-slate-600">
                            <span className="font-medium text-slate-800">{teacher.max_periods_per_day}</span>/day &bull;{" "}
                            <span className="font-medium text-slate-800">{teacher.max_periods_per_week}</span>/wk
                          </div>
                        )}
                      </TableCell>

                      <TableCell>
                        {isEditing ? (
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {instSubjects.map((s) => {
                              const sel = editSubjects.includes(s.id)
                              return (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() => toggleSubject(s.id, editSubjects, setEditSubjects)}
                                  className={`text-[10px] px-1.5 py-0.5 rounded border ${
                                    sel
                                      ? "bg-blue-50 border-blue-400 text-[#1D4ED8]"
                                      : "border-slate-200 text-slate-500"
                                  }`}
                                >
                                  {s.code}
                                </button>
                              )
                            })}
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {teacher.qualified_subject_ids?.map((subId) => {
                              const subj = instSubjects.find((s) => s.id === subId)
                              if (!subj) return null
                              return (
                                <Badge
                                  key={subId}
                                  variant="outline"
                                  className="text-[10px] py-0 px-1.5 flex items-center gap-1"
                                >
                                  <span
                                    className="w-1.5 h-1.5 rounded-full"
                                    style={{ backgroundColor: subj.color }}
                                  />
                                  {subj.code}
                                </Badge>
                              )
                            })}
                          </div>
                        )}
                      </TableCell>

                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setUnavailTeacherId(teacher.id)}
                          className="h-7 text-xs gap-1.5 border-slate-200"
                        >
                          <CalendarOff className="w-3 h-3 text-slate-500" />
                          <span>{unavailCount > 0 ? `${unavailCount} blocked` : "None"}</span>
                        </Button>
                      </TableCell>

                      <TableCell className="text-right space-x-1">
                        {isEditing ? (
                          <>
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => saveEdit(teacher.id)}
                              className="h-7 px-2"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingId(null)}
                              className="h-7 px-2"
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => startEdit(teacher)}
                              className="h-7 w-7 p-0 text-slate-500 hover:text-slate-900"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                if (window.confirm(`Delete faculty record for "${prof?.full_name}"?`)) {
                                  deleteTeacher(teacher.id)
                                }
                              }}
                              className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Unavailability Matrix Modal Dialog */}
      <Dialog
        open={Boolean(unavailTeacherId)}
        onOpenChange={(open) => !open && setUnavailTeacherId(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <CalendarOff className="w-4 h-4 text-red-600" />
              Teacher Unavailability Matrix: {activeUnavailProfile?.full_name}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Click on slots to toggle unavailability. Red highlighted slots will never have lessons scheduled for this teacher.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 overflow-x-auto">
            <table className="w-full border-collapse text-center text-xs">
              <thead>
                <tr>
                  <th className="p-2 border border-slate-200 bg-slate-50 text-slate-600 font-medium text-left">
                    Day / Slot
                  </th>
                  {periodNumbers.map((pNum) => (
                    <th key={pNum} className="p-2 border border-slate-200 bg-slate-50 text-slate-600 font-medium">
                      P{pNum}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4, 5].map((dayIdx) => (
                  <tr key={dayIdx}>
                    <td className="p-2 border border-slate-200 font-medium text-slate-800 bg-slate-50/50 text-left">
                      {DAY_NAMES[dayIdx - 1]}
                    </td>
                    {periodNumbers.map((pNum) => {
                      const p = instPeriods.find(
                        (period) => period.day_of_week === dayIdx && period.period_number === pNum
                      )
                      if (!p) return <td key={pNum} className="border border-slate-200 bg-slate-100" />

                      const isBlocked = currentUnavailPeriodIds.includes(p.id)
                      const isBreak = p.is_break

                      if (isBreak) {
                        return (
                          <td key={pNum} className="p-2 border border-slate-200 bg-slate-100 text-slate-400 text-[10px]">
                            Break
                          </td>
                        )
                      }

                      return (
                        <td
                          key={pNum}
                          onClick={() => toggleUnavailabilitySlot(p.id)}
                          className={`p-2 border border-slate-200 cursor-pointer transition-colors text-[11px] font-medium ${
                            isBlocked
                              ? "bg-red-100 text-red-800 hover:bg-red-200 font-semibold"
                              : "text-slate-600 hover:bg-slate-100"
                          }`}
                          title="Click to toggle availability"
                        >
                          {isBlocked ? "BLOCKED" : "Free"}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <DialogFooter className="sm:justify-between items-center">
            <span className="text-xs text-slate-400">
              {currentUnavailPeriodIds.length} periods currently marked unavailable
            </span>
            <Button size="sm" onClick={() => setUnavailTeacherId(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
