import React, { useState } from "react"
import { Plus, Trash2, Edit2, Check, X, Calendar } from "lucide-react"
import { useDataStore } from "@/stores/useDataStore"
import type { Term } from "@/types/database"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export function TermsManager() {
  const { currentInstitutionId, terms, addTerm, updateTerm, deleteTerm } = useDataStore()
  const instTerms = terms.filter((t) => t.institution_id === currentInstitutionId)

  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // New term form state
  const [name, setName] = useState("")
  const [startDate, setStartDate] = useState("2026-09-01")
  const [endDate, setEndDate] = useState("2027-01-22")
  const [cycle, setCycle] = useState(1)

  // Edit form state
  const [editName, setEditName] = useState("")
  const [editStart, setEditStart] = useState("")
  const [editEnd, setEditEnd] = useState("")
  const [editCycle, setEditCycle] = useState(1)

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    addTerm({
      institution_id: currentInstitutionId,
      name: name.trim(),
      start_date: startDate,
      end_date: endDate,
      weeks_per_cycle: cycle,
    })
    setName("")
    setIsAdding(false)
  }

  const startEdit = (term: Term) => {
    setEditingId(term.id)
    setEditName(term.name)
    setEditStart(term.start_date)
    setEditEnd(term.end_date)
    setEditCycle(term.weeks_per_cycle)
  }

  const saveEdit = (id: string) => {
    updateTerm(id, {
      name: editName,
      start_date: editStart,
      end_date: editEnd,
      weeks_per_cycle: editCycle,
    })
    setEditingId(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Academic Terms &amp; Cycles</h2>
          <p className="text-xs text-slate-500">
            Define semesters, trimesters, or terms. Supports standard 1-week and 2-week (A/B fortnightly) cycle calendars.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setIsAdding(!isAdding)}
          className="gap-1.5"
        >
          <Plus className="w-4 h-4" />
          Add Term
        </Button>
      </div>

      {isAdding && (
        <Card className="border-blue-200 bg-blue-50/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Create New Academic Term</CardTitle>
            <CardDescription>Fill out the date boundaries and cycle pattern.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div>
                <label className="text-[11px] font-medium text-slate-700 block mb-1">Term Name</label>
                <Input
                  placeholder="e.g. Fall 2026"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-700 block mb-1">Start Date</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-700 block mb-1">End Date</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                />
              </div>
              <div className="flex gap-2 items-center">
                <div className="flex-1">
                  <label className="text-[11px] font-medium text-slate-700 block mb-1">Cycle</label>
                  <select
                    className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-1 text-xs text-slate-900 shadow-xs"
                    value={cycle}
                    onChange={(e) => setCycle(Number(e.target.value))}
                  >
                    <option value={1}>1-Week Cycle</option>
                    <option value={2}>2-Week (A/B Fortnight)</option>
                  </select>
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
                <TableHead>Term Name</TableHead>
                <TableHead>Date Range</TableHead>
                <TableHead>Cycle Pattern</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {instTerms.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-slate-400">
                    No academic terms configured for this institution.
                  </TableCell>
                </TableRow>
              ) : (
                instTerms.map((term) => (
                  <TableRow key={term.id}>
                    <TableCell className="font-medium text-slate-900">
                      {editingId === term.id ? (
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-7 text-xs"
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-[#1D4ED8]" />
                          <span>{term.name}</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingId === term.id ? (
                        <div className="flex items-center gap-1">
                          <Input
                            type="date"
                            value={editStart}
                            onChange={(e) => setEditStart(e.target.value)}
                            className="h-7 text-xs w-32"
                          />
                          <span className="text-slate-400">to</span>
                          <Input
                            type="date"
                            value={editEnd}
                            onChange={(e) => setEditEnd(e.target.value)}
                            className="h-7 text-xs w-32"
                          />
                        </div>
                      ) : (
                        <span className="text-slate-600">
                          {term.start_date} &rarr; {term.end_date}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingId === term.id ? (
                        <select
                          className="h-7 rounded border border-slate-300 bg-white px-2 text-xs"
                          value={editCycle}
                          onChange={(e) => setEditCycle(Number(e.target.value))}
                        >
                          <option value={1}>1-Week</option>
                          <option value={2}>2-Week (A/B)</option>
                        </select>
                      ) : (
                        <Badge variant="outline">
                          {term.weeks_per_cycle === 1 ? "1-Week Cycle" : "2-Week (A/B)"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {editingId === term.id ? (
                        <>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => saveEdit(term.id)}
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
                            onClick={() => startEdit(term)}
                            className="h-7 w-7 p-0 text-slate-500 hover:text-slate-900"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (window.confirm(`Delete "${term.name}"?`)) {
                                deleteTerm(term.id)
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
