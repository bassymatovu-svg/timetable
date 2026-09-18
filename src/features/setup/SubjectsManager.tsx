import React, { useState, useRef } from "react"
import { BookOpen, Plus, Trash2, Edit2, Check, X, UploadCloud, Download } from "lucide-react"
import * as XLSX from "xlsx"
import { useDataStore } from "@/stores/useDataStore"
import type { Subject } from "@/types/database"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const COLOR_PRESETS = [
  "#1e40af", // deep blue
  "#0891b2", // cyan
  "#0d9488", // teal
  "#15803d", // green
  "#b45309", // amber
  "#c2410c", // orange
  "#be185d", // pink
  "#4338ca", // indigo
  "#6d28d9", // purple
  "#475569", // slate
]

export function SubjectsManager() {
  const { currentInstitutionId, subjects, addSubject, updateSubject, deleteSubject } = useDataStore()
  const instSubjects = subjects.filter((s) => s.institution_id === currentInstitutionId)

  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Add form
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const [color, setColor] = useState("#1e40af")
  const [requiredRoomType, setRequiredRoomType] = useState("classroom")

  // Edit form
  const [editName, setEditName] = useState("")
  const [editCode, setEditCode] = useState("")
  const [editColor, setEditColor] = useState("")
  const [editRoomType, setEditRoomType] = useState("")

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !code.trim()) return

    addSubject({
      institution_id: currentInstitutionId,
      name: name.trim(),
      code: code.trim().toUpperCase(),
      color,
      required_room_type: requiredRoomType || null,
    })

    setName("")
    setCode("")
    setIsAdding(false)
  }

  const startEdit = (subj: Subject) => {
    setEditingId(subj.id)
    setEditName(subj.name)
    setEditCode(subj.code)
    setEditColor(subj.color)
    setEditRoomType(subj.required_room_type || "classroom")
  }

  const saveEdit = (id: string) => {
    updateSubject(id, {
      name: editName,
      code: editCode.toUpperCase(),
      color: editColor,
      required_room_type: editRoomType || null,
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
          const sName = row["Name"] || row["Subject"]
          const sCode = row["Code"] || (sName ? String(sName).substring(0, 4).toUpperCase() : "")
          const sRoom = row["Room Type"] || row["Required Room"] || "classroom"

          if (sName) {
            addSubject({
              institution_id: currentInstitutionId,
              name: String(sName).trim(),
              code: String(sCode).trim(),
              color: COLOR_PRESETS[count % COLOR_PRESETS.length],
              required_room_type: String(sRoom).trim().toLowerCase(),
            })
            count++
          }
        }
        alert(`Successfully imported ${count} subjects.`)
      } catch (err) {
        alert("Failed to parse spreadsheet.")
      }
    }
    reader.readAsBinaryString(file)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const downloadSampleTemplate = () => {
    const sampleData = [
      { Name: "Biology", Code: "BIO", "Room Type": "lab" },
      { Name: "Economics", Code: "ECON", "Room Type": "classroom" },
      { Name: "Robotics", Code: "ROB", "Room Type": "computer_lab" },
    ]
    const ws = XLSX.utils.json_to_sheet(sampleData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Subjects")
    XLSX.writeFile(wb, "subjects_template.xlsx")
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Subjects &amp; Academic Disciplines</h2>
          <p className="text-xs text-slate-500">
            Define subject codes, required room types for laboratory/specialist classes, and visual color tokens.
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
            Add Subject
          </Button>
        </div>
      </div>

      {isAdding && (
        <Card className="border-blue-200 bg-blue-50/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Register New Subject</CardTitle>
            <CardDescription className="text-xs">
              Color is used strictly to identify the discipline on the grid (never for marketing decoration).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div>
                <label className="text-[11px] font-medium text-slate-700 block mb-1">Subject Name</label>
                <Input
                  placeholder="e.g. Mathematics"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-700 block mb-1">Subject Code</label>
                <Input
                  placeholder="e.g. MATH"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="uppercase font-mono"
                  required
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-700 block mb-1">Required Room Type</label>
                <select
                  className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-1 text-xs text-slate-900 shadow-xs"
                  value={requiredRoomType}
                  onChange={(e) => setRequiredRoomType(e.target.value)}
                >
                  <option value="classroom">Standard Classroom</option>
                  <option value="lab">Science Lab</option>
                  <option value="computer_lab">Computer Lab</option>
                  <option value="gym">Gymnasium</option>
                  <option value="art_studio">Art Studio</option>
                </select>
              </div>
              <div className="flex gap-2 items-center">
                <div className="flex-1">
                  <label className="text-[11px] font-medium text-slate-700 block mb-1">Color Key</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="h-8 w-10 p-0 border border-slate-300 rounded cursor-pointer"
                    />
                    <div className="flex gap-1">
                      {COLOR_PRESETS.slice(0, 5).map((cp) => (
                        <button
                          key={cp}
                          type="button"
                          onClick={() => setColor(cp)}
                          className="w-4 h-4 rounded-full border border-white"
                          style={{ backgroundColor: cp }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <Button type="submit" size="sm" className="mt-auto">
                  Save
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAdding(false)}
                  className="mt-auto"
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
                <TableHead className="w-12">Color</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Subject Title</TableHead>
                <TableHead>Room Requirement</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {instSubjects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-slate-400">
                    No subjects registered yet.
                  </TableCell>
                </TableRow>
              ) : (
                instSubjects.map((subj) => (
                  <TableRow key={subj.id}>
                    <TableCell>
                      {editingId === subj.id ? (
                        <input
                          type="color"
                          value={editColor}
                          onChange={(e) => setEditColor(e.target.value)}
                          className="h-6 w-8 p-0 border border-slate-300 rounded cursor-pointer"
                        />
                      ) : (
                        <div
                          className="w-4 h-4 rounded-sm border border-black/10 shadow-2xs"
                          style={{ backgroundColor: subj.color }}
                        />
                      )}
                    </TableCell>
                    <TableCell className="font-mono font-semibold text-xs text-slate-800">
                      {editingId === subj.id ? (
                        <Input
                          value={editCode}
                          onChange={(e) => setEditCode(e.target.value)}
                          className="h-7 text-xs w-20 font-mono"
                        />
                      ) : (
                        subj.code
                      )}
                    </TableCell>
                    <TableCell className="font-medium text-slate-900">
                      {editingId === subj.id ? (
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-7 text-xs"
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                          <span>{subj.name}</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingId === subj.id ? (
                        <select
                          className="h-7 rounded border border-slate-300 bg-white px-2 text-xs"
                          value={editRoomType}
                          onChange={(e) => setEditRoomType(e.target.value)}
                        >
                          <option value="classroom">Standard Classroom</option>
                          <option value="lab">Science Lab</option>
                          <option value="computer_lab">Computer Lab</option>
                          <option value="gym">Gymnasium</option>
                          <option value="art_studio">Art Studio</option>
                        </select>
                      ) : (
                        <Badge variant="outline" className="text-[11px] font-mono">
                          {subj.required_room_type || "classroom"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {editingId === subj.id ? (
                        <>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => saveEdit(subj.id)}
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
                            onClick={() => startEdit(subj)}
                            className="h-7 w-7 p-0 text-slate-500 hover:text-slate-900"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (window.confirm(`Delete subject "${subj.name}"?`)) {
                                deleteSubject(subj.id)
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
