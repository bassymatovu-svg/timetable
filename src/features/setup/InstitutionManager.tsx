import React, { useState } from "react"
import { Building2, Plus, Edit2, Check, X, ArrowRight, Globe } from "lucide-react"
import { useDataStore } from "@/stores/useDataStore"
import type { Institution } from "@/types/database"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export function InstitutionManager() {
  const {
    institutions,
    currentInstitutionId,
    currentProfile,
    teachers,
    classGroups,
    rooms,
    switchInstitution,
    addInstitution,
    updateInstitution,
  } = useDataStore()

  const isSuperAdmin = currentProfile.role === "super_admin"

  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Add form
  const [name, setName] = useState("")
  const [timezone, setTimezone] = useState("UTC")

  // Edit form
  const [editName, setEditName] = useState("")
  const [editTimezone, setEditTimezone] = useState("")

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    const newInst = addInstitution({
      name: name.trim(),
      timezone: timezone.trim() || "UTC",
      settings: { working_days: [1, 2, 3, 4, 5] },
    })

    setName("")
    setIsAdding(false)
    switchInstitution(newInst.id)
  }

  const startEdit = (inst: Institution) => {
    setEditingId(inst.id)
    setEditName(inst.name)
    setEditTimezone(inst.timezone)
  }

  const saveEdit = (id: string) => {
    updateInstitution(id, {
      name: editName,
      timezone: editTimezone,
    })
    setEditingId(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Tenant &amp; Multi-Institution Management</h2>
          <p className="text-xs text-slate-500">
            Super-Admin governance across multiple schools, university colleges, or campuses.
          </p>
        </div>
        {isSuperAdmin && (
          <Button
            size="sm"
            onClick={() => setIsAdding(!isAdding)}
            className="gap-1.5 text-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Institution
          </Button>
        )}
      </div>

      {!isSuperAdmin && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800">
          <strong>Note:</strong> You are currently viewing this screen as a regular user role. Switch to <strong>Super Admin</strong> via the top-right role switcher to create or modify cross-institution tenants.
        </div>
      )}

      {isAdding && (
        <Card className="border-blue-200 bg-blue-50/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Register New Institution / Campus</CardTitle>
            <CardDescription className="text-xs">
              Every institution has complete database tenant isolation via Postgres Row Level Security.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div>
                <label className="text-[11px] font-medium text-slate-700 block mb-1">Institution Name</label>
                <Input
                  placeholder="e.g. St. Jude University College"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-700 block mb-1">Timezone</label>
                <select
                  className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-1 text-xs text-slate-900 shadow-xs"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                >
                  <option value="UTC">UTC (Universal Time)</option>
                  <option value="America/New_York">America/New_York (Eastern)</option>
                  <option value="America/Chicago">America/Chicago (Central)</option>
                  <option value="America/Los_Angeles">America/Los_Angeles (Pacific)</option>
                  <option value="Europe/London">Europe/London (GMT/BST)</option>
                  <option value="Europe/Paris">Europe/Paris (CET)</option>
                  <option value="Asia/Singapore">Asia/Singapore (SGT)</option>
                  <option value="Australia/Sydney">Australia/Sydney (AEST)</option>
                </select>
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm">
                  Create Tenant
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
                <TableHead>Institution Name</TableHead>
                <TableHead>Timezone</TableHead>
                <TableHead>Scope Counts</TableHead>
                <TableHead>Tenant Status</TableHead>
                <TableHead className="text-right">Switch / Edit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {institutions.map((inst) => {
                const isCurrent = inst.id === currentInstitutionId
                const instTeachersCount = teachers.filter((t) => t.institution_id === inst.id).length
                const instClassesCount = classGroups.filter((c) => c.institution_id === inst.id).length
                const instRoomsCount = rooms.filter((r) => r.institution_id === inst.id).length

                const isEditing = editingId === inst.id

                return (
                  <TableRow key={inst.id} className={isCurrent ? "bg-blue-50/30" : ""}>
                    <TableCell className="font-medium text-slate-900">
                      {isEditing ? (
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-7 text-xs"
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          <Building2 className={`w-4 h-4 ${isCurrent ? "text-[#1D4ED8]" : "text-slate-400"}`} />
                          <span className="font-semibold text-slate-800">{inst.name}</span>
                          {isCurrent && (
                            <Badge variant="primary" className="text-[10px] py-0 px-1.5">
                              Active Context
                            </Badge>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">
                      {isEditing ? (
                        <Input
                          value={editTimezone}
                          onChange={(e) => setEditTimezone(e.target.value)}
                          className="h-7 text-xs w-32"
                        />
                      ) : (
                        <div className="flex items-center gap-1">
                          <Globe className="w-3 h-3 text-slate-400" />
                          <span>{inst.timezone}</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">
                      <span>{instClassesCount} classes</span> &bull;{" "}
                      <span>{instTeachersCount} teachers</span> &bull;{" "}
                      <span>{instRoomsCount} rooms</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] text-emerald-700 bg-emerald-50 border-emerald-200">
                        Operational
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1.5">
                      {isEditing ? (
                        <>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => saveEdit(inst.id)}
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
                          {isSuperAdmin && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => startEdit(inst)}
                              className="h-7 w-7 p-0 text-slate-400 hover:text-slate-900"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          {!isCurrent && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => switchInstitution(inst.id)}
                              className="h-7 text-xs gap-1 text-[#1D4ED8] border-blue-200 hover:bg-blue-50"
                            >
                              <span>Switch</span>
                              <ArrowRight className="w-3 h-3" />
                            </Button>
                          )}
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
