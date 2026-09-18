import React, { useState, useRef } from "react"
import { Building, Plus, Trash2, Edit2, Check, X, UploadCloud, Download } from "lucide-react"
import * as XLSX from "xlsx"
import { useDataStore } from "@/stores/useDataStore"
import type { Room } from "@/types/database"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const ROOM_TYPES = [
  { value: "classroom", label: "General Classroom" },
  { value: "lab", label: "Science Laboratory" },
  { value: "computer_lab", label: "Computer Lab" },
  { value: "gym", label: "Gymnasium / Sports Hall" },
  { value: "art_studio", label: "Fine Arts Studio" },
  { value: "auditorium", label: "Auditorium / Hall" },
  { value: "workshop", label: "Technical Workshop" },
]

export function RoomsManager() {
  const { currentInstitutionId, rooms, addRoom, updateRoom, deleteRoom } = useDataStore()
  const instRooms = rooms.filter((r) => r.institution_id === currentInstitutionId)

  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Add form state
  const [name, setName] = useState("")
  const [capacity, setCapacity] = useState(30)
  const [roomType, setRoomType] = useState("classroom")
  const [featuresStr, setFeaturesStr] = useState("whiteboard, projector")

  // Edit form state
  const [editName, setEditName] = useState("")
  const [editCapacity, setEditCapacity] = useState(30)
  const [editType, setEditType] = useState("classroom")

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    const features = featuresStr
      .split(",")
      .map((f) => f.trim())
      .filter(Boolean)

    addRoom({
      institution_id: currentInstitutionId,
      name: name.trim(),
      capacity: Number(capacity),
      room_type: roomType,
      features,
    })

    setName("")
    setIsAdding(false)
  }

  const startEdit = (room: Room) => {
    setEditingId(room.id)
    setEditName(room.name)
    setEditCapacity(room.capacity)
    setEditType(room.room_type)
  }

  const saveEdit = (id: string) => {
    updateRoom(id, {
      name: editName,
      capacity: Number(editCapacity),
      room_type: editType,
    })
    setEditingId(null)
  }

  // Bulk CSV / Excel Import using SheetJS
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

        let importedCount = 0
        for (const row of data) {
          const roomName = row["Name"] || row["name"] || row["Room"] || row["room"]
          const cap = Number(row["Capacity"] || row["capacity"] || 30)
          const type = row["Type"] || row["type"] || row["Room Type"] || "classroom"

          if (roomName) {
            addRoom({
              institution_id: currentInstitutionId,
              name: String(roomName).trim(),
              capacity: isNaN(cap) ? 30 : cap,
              room_type: String(type).trim().toLowerCase(),
              features: ["projector"],
            })
            importedCount++
          }
        }
        alert(`Successfully imported ${importedCount} rooms from file.`)
      } catch (err) {
        alert("Failed to parse file. Please upload a valid CSV or Excel spreadsheet.")
      }
    }
    reader.readAsBinaryString(file)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const downloadSampleTemplate = () => {
    const sampleData = [
      { Name: "Room 201", Capacity: 32, Type: "classroom" },
      { Name: "Biology Lab", Capacity: 28, Type: "lab" },
      { Name: "Media Lab", Capacity: 25, Type: "computer_lab" },
    ]
    const ws = XLSX.utils.json_to_sheet(sampleData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Rooms")
    XLSX.writeFile(wb, "rooms_template.xlsx")
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Rooms &amp; Spatial Facilities</h2>
          <p className="text-xs text-slate-500">
            Manage instructional spaces, seat capacities, and specialized facility tags.
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
            title="Download Excel template"
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
            <Plus className="w-3.5 h-3.5" />
            Add Room
          </Button>
        </div>
      </div>

      {isAdding && (
        <Card className="border-blue-200 bg-blue-50/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Register New Room or Facility</CardTitle>
            <CardDescription className="text-xs">Capacity is strictly validated during timetable placement.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div>
                <label className="text-[11px] font-medium text-slate-700 block mb-1">Room Name / Number</label>
                <Input
                  placeholder="e.g. Room 104 or Chemistry Lab"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-700 block mb-1">Capacity (Max Students)</label>
                <Input
                  type="number"
                  min={5}
                  max={500}
                  value={capacity}
                  onChange={(e) => setCapacity(Number(e.target.value))}
                  required
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-700 block mb-1">Room Classification</label>
                <select
                  className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-1 text-xs text-slate-900 shadow-xs"
                  value={roomType}
                  onChange={(e) => setRoomType(e.target.value)}
                >
                  {ROOM_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-[11px] font-medium text-slate-700 block mb-1">Features (comma-separated)</label>
                  <Input
                    placeholder="whiteboard, projector, sinks"
                    value={featuresStr}
                    onChange={(e) => setFeaturesStr(e.target.value)}
                  />
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
                <TableHead>Room Identifier</TableHead>
                <TableHead>Classification</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead>Features</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {instRooms.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-slate-400">
                    No rooms registered. Click "Add Room" or "Import CSV" to get started.
                  </TableCell>
                </TableRow>
              ) : (
                instRooms.map((room) => (
                  <TableRow key={room.id}>
                    <TableCell className="font-medium text-slate-900">
                      {editingId === room.id ? (
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-7 text-xs"
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          <Building className="w-3.5 h-3.5 text-slate-500" />
                          <span>{room.name}</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingId === room.id ? (
                        <select
                          className="h-7 rounded border border-slate-300 bg-white px-2 text-xs"
                          value={editType}
                          onChange={(e) => setEditType(e.target.value)}
                        >
                          {ROOM_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <Badge variant="outline" className="font-mono text-[11px]">
                          {room.room_type}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingId === room.id ? (
                        <Input
                          type="number"
                          value={editCapacity}
                          onChange={(e) => setEditCapacity(Number(e.target.value))}
                          className="h-7 text-xs w-20"
                        />
                      ) : (
                        <span className="text-slate-700 font-medium">
                          {room.capacity} seats
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {room.features?.map((f, i) => (
                          <span
                            key={i}
                            className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px]"
                          >
                            {f}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {editingId === room.id ? (
                        <>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => saveEdit(room.id)}
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
                            onClick={() => startEdit(room)}
                            className="h-7 w-7 p-0 text-slate-500 hover:text-slate-900"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (window.confirm(`Delete room "${room.name}"?`)) {
                                deleteRoom(room.id)
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
