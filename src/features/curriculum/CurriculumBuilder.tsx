import React, { useState } from "react"
import { Layers, Plus, Trash2, Check, AlertCircle, Sparkles } from "lucide-react"
import { useDataStore } from "@/stores/useDataStore"
import type { CurriculumRequirement } from "@/types/database"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export function CurriculumBuilder() {
  const {
    currentInstitutionId,
    terms,
    classGroups,
    subjects,
    teachers,
    profiles,
    periods,
    curriculumRequirements,
    addCurriculumRequirement,
    updateCurriculumRequirement,
    deleteCurriculumRequirement,
  } = useDataStore()

  const activeTerm = terms[0]
  const instClasses = classGroups.filter((c) => c.institution_id === currentInstitutionId)
  const instSubjects = subjects.filter((s) => s.institution_id === currentInstitutionId)
  const instTeachers = teachers.filter((t) => t.institution_id === currentInstitutionId)
  const instPeriods = periods.filter((p) => p.institution_id === currentInstitutionId)
  const instReqs = curriculumRequirements.filter(
    (r) => !activeTerm || r.term_id === activeTerm.id
  )

  const [selectedClassId, setSelectedClassId] = useState<string>(instClasses[0]?.id || "")
  const [isAdding, setIsAdding] = useState(false)

  // New requirement state
  const [newSubjectId, setNewSubjectId] = useState(instSubjects[0]?.id || "")
  const [newTeacherId, setNewTeacherId] = useState(instTeachers[0]?.id || "")
  const [newPeriodsPerWeek, setNewPeriodsPerWeek] = useState(4)
  const [newDoublePeriod, setNewDoublePeriod] = useState(false)

  // Calculate available instructional periods per week (excluding breaks)
  const instructionalPeriodsCount = instPeriods.filter((p) => !p.is_break).length

  // Filter requirements for currently selected class
  const classReqs = instReqs.filter((r) => r.class_group_id === selectedClassId)
  const totalAllocatedPeriods = classReqs.reduce((sum, r) => sum + r.periods_per_week, 0)
  const isOverAllocated = totalAllocatedPeriods > instructionalPeriodsCount

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedClassId || !newSubjectId || !activeTerm) return

    addCurriculumRequirement({
      term_id: activeTerm.id,
      class_group_id: selectedClassId,
      subject_id: newSubjectId,
      teacher_id: newTeacherId || null,
      periods_per_week: Number(newPeriodsPerWeek),
      double_period: newDoublePeriod,
    })

    setIsAdding(false)
  }

  const currentClass = instClasses.find((c) => c.id === selectedClassId)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Curriculum Requirements &amp; Allotments</h2>
          <p className="text-xs text-slate-500">
            Define weekly periods per subject, assigned faculty, and paired double-period constraints.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setIsAdding(!isAdding)}
            className="gap-1.5 text-xs"
            disabled={!selectedClassId}
          >
            <Plus className="w-3.5 h-3.5" />
            Add Subject Allotment
          </Button>
        </div>
      </div>

      {/* Cohort Selector Tabs & Workload Indicator */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-3 bg-white border border-slate-200 rounded-lg">
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs font-semibold text-slate-500 mr-2">Cohort:</span>
          {instClasses.map((cg) => (
            <button
              key={cg.id}
              onClick={() => setSelectedClassId(cg.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                selectedClassId === cg.id
                  ? "bg-[#1D4ED8] text-white shadow-2xs font-semibold"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {cg.name}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[11px] text-slate-400 block">Weekly Periods Scheduled</span>
            <div className="flex items-center gap-1.5">
              <span className={`text-sm font-bold ${isOverAllocated ? "text-red-600" : "text-slate-900"}`}>
                {totalAllocatedPeriods}
              </span>
              <span className="text-xs text-slate-400">/ {instructionalPeriodsCount} available</span>
            </div>
          </div>
          {isOverAllocated && (
            <Badge variant="destructive" className="gap-1 text-[10px]">
              <AlertCircle className="w-3 h-3" />
              Over-Capacity
            </Badge>
          )}
        </div>
      </div>

      {isAdding && (
        <Card className="border-blue-200 bg-blue-50/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">
              Add Subject Requirement for {currentClass?.name}
            </CardTitle>
            <CardDescription className="text-xs">
              Double periods will be strictly scheduled as two adjacent consecutive periods on the same day in the same room.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div>
                <label className="text-[11px] font-medium text-slate-700 block mb-1">Subject</label>
                <select
                  className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-1 text-xs text-slate-900 shadow-xs"
                  value={newSubjectId}
                  onChange={(e) => setNewSubjectId(e.target.value)}
                  required
                >
                  {instSubjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-700 block mb-1">Assigned Teacher</label>
                <select
                  className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-1 text-xs text-slate-900 shadow-xs"
                  value={newTeacherId}
                  onChange={(e) => setNewTeacherId(e.target.value)}
                >
                  <option value="">Unassigned (Engine Auto-Assign)</option>
                  {instTeachers.map((t) => {
                    const prof = profiles.find((p) => p.id === t.id)
                    return (
                      <option key={t.id} value={t.id}>
                        {prof?.full_name || t.id}
                      </option>
                    )
                  })}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-700 block mb-1">Periods / Week</label>
                <Input
                  type="number"
                  min={1}
                  max={15}
                  value={newPeriodsPerWeek}
                  onChange={(e) => setNewPeriodsPerWeek(Number(e.target.value))}
                  required
                />
              </div>
              <div className="flex gap-2 items-center">
                <label className="flex items-center gap-2 cursor-pointer pb-2">
                  <input
                    type="checkbox"
                    checked={newDoublePeriod}
                    onChange={(e) => setNewDoublePeriod(e.target.checked)}
                    className="w-4 h-4 rounded text-[#1D4ED8]"
                  />
                  <span className="text-xs text-slate-700 font-medium">Double Period</span>
                </label>
                <Button type="submit" size="sm" className="ml-auto">
                  Save
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

      {/* Table of Class Requirements */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Color</TableHead>
                <TableHead>Subject Code</TableHead>
                <TableHead>Discipline Title</TableHead>
                <TableHead>Assigned Faculty</TableHead>
                <TableHead>Weekly Load</TableHead>
                <TableHead>Format</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {classReqs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-slate-400">
                    <Layers className="w-6 h-6 mx-auto mb-2 opacity-40" />
                    No curriculum requirements assigned to {currentClass?.name || "this cohort"} yet.
                  </TableCell>
                </TableRow>
              ) : (
                classReqs.map((req) => {
                  const subj = instSubjects.find((s) => s.id === req.subject_id)
                  const teach = instTeachers.find((t) => t.id === req.teacher_id)
                  const teachProf = teach ? profiles.find((p) => p.id === teach.id) : null

                  return (
                    <TableRow key={req.id}>
                      <TableCell>
                        <div
                          className="w-3.5 h-3.5 rounded-sm shadow-2xs border border-black/10"
                          style={{ backgroundColor: subj?.color || "#475569" }}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs font-bold text-slate-800">
                        {subj?.code || "—"}
                      </TableCell>
                      <TableCell className="font-medium text-slate-900">
                        {subj?.name || "Unknown Subject"}
                      </TableCell>
                      <TableCell>
                        {teachProf ? (
                          <span className="text-xs text-slate-800 font-medium">
                            {teachProf.full_name}
                          </span>
                        ) : (
                          <Badge variant="outline" className="text-slate-400 text-[10px]">
                            Auto-Assign
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-semibold text-slate-800">
                          {req.periods_per_week} periods/wk
                        </span>
                      </TableCell>
                      <TableCell>
                        {req.double_period ? (
                          <Badge variant="primary" className="text-[10px]">
                            Includes 1 Double Period
                          </Badge>
                        ) : (
                          <span className="text-xs text-slate-500">Single Periods</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (window.confirm(`Delete requirement for "${subj?.name}"?`)) {
                              deleteCurriculumRequirement(req.id)
                            }
                          }}
                          className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
