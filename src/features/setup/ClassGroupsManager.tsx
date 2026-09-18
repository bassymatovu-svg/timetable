import React, { useState, useRef } from "react"
import { Users, Plus, Trash2, Edit2, Check, X, UploadCloud, Download } from "lucide-react"
import * as XLSX from "xlsx"
import { useDataStore } from "@/stores/useDataStore"
import type { ClassGroup } from "@/types/database"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

export function ClassGroupsManager() {
  const { currentInstitutionId, classGroups, addClassGroup, updateClassGroup, deleteClassGroup } = useDataStore()
  const instClasses = classGroups.filter((cg) => cg.institution_id === currentInstitutionId)

  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Add form
  const [name, setName] = useState("")
  const [yearLevel, setYearLevel] = useState(9)
  const [size, setSize] = useState(28)

  // Edit form
  const [editName, setEditName] = useState("")
  const [editYear, setEditYear] = useState(9)
  const [editSize, setEditSize] = useState(28)

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    addClassGroup({
      institution_id: currentInstitutionId,
      name: name.trim(),
      year_level: Number(yearLevel),
      size: Number(size),
    })

    setName("")
    setIsAdding(false)
  }

  const startEdit = (cg: ClassGroup) => {
    setEditingId(cg.id)
    setEditName(cg.name)
    setEditYear(cg.year_level || 9)
    setEditSize(cg.size)
  }

  const saveEdit = (id: string) => {
    updateClassGroup(id, {
      name: editName,
      year_level: Number(editYear),
      size: Number(editSize),
    })
    setEditingId(null)
  }

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
          const cName = row["Name"] || row["Class"] || row["Cohort"]
          const yL = Number(row["Year"] || row["Grade"] || 9)
          const sz = Number(row["Size"] || row["Students"] || 25)

          if (cName) {
            addClassGroup({
              institution_id: currentInstitutionId,
              name: String(cName).trim(),
              year_level: isNaN(yL) ? 9 : yL,
              size: isNaN(sz) ? 25 : sz,
            })
            count++
          }
        }
        alert(`Successfully imported ${count} class cohorts.`)
      } catch (err) {
        alert("Failed to parse spreadsheet.")
      }
    }
    reader.readAsBinaryString(file)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const downloadSampleTemplate = () => {
    const sampleData = [
      { Class: "Grade 11-A", Grade: 11, Size: 26 },
      { Class: "Grade 11-B", Grade: 11, Size: 24 },
      { Class: "Grade 12-Sci", Grade: 12, Size: 20 },
    ]
    const ws = XLSX.utils.json_to_sheet(sampleData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "ClassGroups")
    XLSX.writeFile(wb, "classes_template.xlsx")
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Class Groups &amp; Student Cohorts</h2>
          <p className="text-xs text-slate-500">
            Define grade cohorts and student counts. Room allocations enforce capacity &ge; class size.
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
            Add Class Group
          </Button>
        </div>
      </div>

      {isAdding && (
        <Card className="border-blue-200 bg-blue-50/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Register Class Group</CardTitle>
            <CardDescription className="text-xs">
              Every class will be scheduled for all curriculum requirements assigned to it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div>
                <label className="text-[11px] font-medium text-slate-700 block mb-1">Class / Cohort Name</label>
                <Input
                  placeholder="e.g. Grade 10B"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-700 block mb-1">Year / Grade Level</label>
                <Input
                  type="number"
                  min={1}
                  max={16}
                  value={yearLevel}
                  onChange={(e) => setYearLevel(Number(e.target.value))}
                  required
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-700 block mb-1">Enrollment (Students)</label>
                <Input
                  type="number"
                  min={1}
                  max={200}
                  value={size}
                  onChange={(e) => setSize(Number(e.target.value))}
                  required
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm">
                  Save Cohort
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAdding(false)}
                >
                  Cancel
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
                <TableHead>Class Identifier</TableHead>
                <TableHead>Grade / Year Level</TableHead>
                <TableHead>Class Size (Roll)</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {instClasses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-slate-400">
                    No class groups configured yet.
                  </TableCell>
                </TableRow>
              ) : (
                instClasses.map((cg) => (
                  <TableRow key={cg.id}>
                    <TableCell className="font-medium text-slate-900">
                      {editingId === cg.id ? (
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-7 text-xs"
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          <span>{cg.name}</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">
                      {editingId === cg.id ? (
                        <Input
                          type="number"
                          value={editYear}
                          onChange={(e) => setEditYear(Number(e.target.value))}
                          className="h-7 text-xs w-20"
                        />
                      ) : (
                        `Year ${cg.year_level || "-"}`
                      )}
                    </TableCell>
                    <TableCell className="text-xs font-medium text-slate-800">
                      {editingId === cg.id ? (
                        <Input
                          type="number"
                          value={editSize}
                          onChange={(e) => setEditSize(Number(e.target.value))}
                          className="h-7 text-xs w-20"
                        />
                      ) : (
                        `${cg.size} students`
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {editingId === cg.id ? (
                        <>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => saveEdit(cg.id)}
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
                            onClick={() => startEdit(cg)}
                            className="h-7 w-7 p-0 text-slate-500 hover:text-slate-900"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (window.confirm(`Delete class "${cg.name}"?`)) {
                                deleteClassGroup(cg.id)
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
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
