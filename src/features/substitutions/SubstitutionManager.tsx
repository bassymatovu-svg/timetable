import React, { useState } from "react"
import { UserX, UserCheck, AlertCircle, Calendar, Check, Sparkles, History, Search } from "lucide-react"
import { useDataStore } from "@/stores/useDataStore"
import type { Lesson, Teacher, Substitution } from "@/types/database"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export function SubstitutionManager() {
  const {
    currentInstitutionId,
    teachers,
    profiles,
    subjects,
    classGroups,
    rooms,
    periods,
    lessons,
    substitutions,
    teacherUnavailability,
    createSubstitution,
    updateSubstitution,
  } = useDataStore()

  const instTeachers = teachers.filter((t) => t.institution_id === currentInstitutionId)
  const instPeriods = periods.filter((p) => p.institution_id === currentInstitutionId)

  const [absentTeacherId, setAbsentTeacherId] = useState<string>(instTeachers[0]?.id || "")
  const [absenceDate, setAbsenceDate] = useState<string>(new Date().toISOString().substring(0, 10))
  const [reason, setReason] = useState("Medical Leave")
  const [selectedSubstitutes, setSelectedSubstitutes] = useState<Record<string, string>>({})

  // Determine day of week from date (1 = Monday, ..., 5 = Friday)
  const dateObj = new Date(absenceDate + "T00:00:00")
  let dayOfWeek = dateObj.getDay()
  if (dayOfWeek === 0) dayOfWeek = 7 // Sunday -> 7

  // Find affected lessons for the absent teacher on this day of week
  const sameDayPeriodIds = new Set(
    instPeriods.filter((p) => p.day_of_week === dayOfWeek).map((p) => p.id)
  )

  const affectedLessons = lessons.filter(
    (l) => l.teacher_id === absentTeacherId && sameDayPeriodIds.has(l.period_id)
  )

  // Intelligent Candidate Ranking Engine for an affected lesson
  const getRankedSubstituteCandidates = (lesson: Lesson) => {
    const subject = subjects.find((s) => s.id === lesson.subject_id)

    const candidates = instTeachers.filter((t) => {
      // Cannot substitute for oneself
      if (t.id === absentTeacherId) return false

      // Must be free in this period (no other lesson scheduled)
      const isBooked = lessons.some(
        (l) => l.teacher_id === t.id && l.period_id === lesson.period_id
      )
      if (isBooked) return false

      // Must not be marked unavailable in this period
      const isUnavail = teacherUnavailability.some(
        (u) => u.teacher_id === t.id && u.period_id === lesson.period_id
      )
      if (isUnavail) return false

      // Check weekly load
      const currentWeeklyLessons = lessons.filter((l) => l.teacher_id === t.id).length
      if (currentWeeklyLessons >= t.max_periods_per_week) return false

      return true
    })

    // Rank candidates:
    // 1. Subject qualified teachers first
    // 2. Then sorted by fewest periods taught on that day
    return candidates.sort((a, b) => {
      const aQual = subject ? a.qualified_subject_ids.includes(subject.id) : false
      const bQual = subject ? b.qualified_subject_ids.includes(subject.id) : false

      if (aQual && !bQual) return -1
      if (!aQual && bQual) return 1

      // Fewer periods on this day preferred
      const aDayLoad = lessons.filter(
        (l) => l.teacher_id === a.id && sameDayPeriodIds.has(l.period_id)
      ).length
      const bDayLoad = lessons.filter(
        (l) => l.teacher_id === b.id && sameDayPeriodIds.has(l.period_id)
      ).length
      return aDayLoad - bDayLoad
    })
  }

  const handleAssignSubstitution = (lesson: Lesson) => {
    const substituteTeacherId = selectedSubstitutes[lesson.id]
    if (!substituteTeacherId) {
      alert("Please select a substitute teacher from the candidate list.")
      return
    }

    createSubstitution({
      lesson_id: lesson.id,
      date: absenceDate,
      absent_teacher_id: absentTeacherId,
      substitute_teacher_id: substituteTeacherId,
      status: "assigned",
      reason,
    })

    alert("Substitute assigned and recorded in institutional log.")
  }

  const absentProfile = profiles.find((p) => p.id === absentTeacherId)
  const instSubstitutions = substitutions.filter((s) => {
    const t = instTeachers.find((teach) => teach.id === s.absent_teacher_id)
    return Boolean(t)
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Faculty Absence &amp; Intelligent Substitution</h2>
        <p className="text-xs text-slate-500">
          Mark absences, analyze impacted classes, and rank available faculty substitutes by subject qualification and workload.
        </p>
      </div>

      {/* Absence Logging Card */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-sm flex items-center gap-2">
            <UserX className="w-4 h-4 text-red-600" />
            Declare Faculty Absence
          </CardTitle>
          <CardDescription className="text-xs">
            System automatically cross-references the master timetable to isolate affected lessons.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div>
              <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                Absent Faculty Member
              </label>
              <select
                className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-xs text-slate-800 shadow-2xs cursor-pointer"
                value={absentTeacherId}
                onChange={(e) => setAbsentTeacherId(e.target.value)}
              >
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
              <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                Absence Date
              </label>
              <Input
                type="date"
                value={absenceDate}
                onChange={(e) => setAbsenceDate(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                Absence Reason
              </label>
              <Input
                placeholder="e.g. Illness, Professional Development, Conference"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Impacted Lessons & Ranked Candidates */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <span>Impacted Lessons for {absentProfile?.full_name}</span>
            <Badge variant="outline" className="text-xs">
              {affectedLessons.length} lessons on {DAY_NAMES[dayOfWeek - 1] || "Selected Date"}
            </Badge>
          </h3>
        </div>

        {affectedLessons.length === 0 ? (
          <Card className="p-8 text-center text-slate-400">
            <UserCheck className="w-8 h-8 mx-auto mb-2 text-emerald-600 opacity-80" />
            <p className="text-xs">No lessons are scheduled for this teacher on this day of the week.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {affectedLessons.map((lesson) => {
              const subj = subjects.find((s) => s.id === lesson.subject_id)
              const cg = classGroups.find((c) => c.id === lesson.class_group_id)
              const rm = rooms.find((r) => r.id === lesson.room_id)
              const period = periods.find((p) => p.id === lesson.period_id)

              const rankedCandidates = getRankedSubstituteCandidates(lesson)
              const chosenSubId = selectedSubstitutes[lesson.id] || (rankedCandidates[0]?.id ?? "")

              return (
                <Card key={lesson.id} className="border-slate-200">
                  <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="font-mono text-xs font-bold"
                          style={{
                            borderColor: subj?.color,
                            color: subj?.color,
                          }}
                        >
                          {subj?.code}
                        </Badge>
                        <span className="font-semibold text-xs text-slate-900">
                          {subj?.name}
                        </span>
                        <span className="text-xs text-slate-500">
                          &bull; {cg?.name}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Period {period?.period_number} ({period?.start_time.substring(0, 5)} - {period?.end_time.substring(0, 5)}) &bull; Room: {rm?.name}
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 w-full sm:w-auto">
                      <div className="flex-1 sm:w-72">
                        <select
                          className="w-full h-8 rounded border border-slate-300 bg-white px-2 text-xs text-slate-800"
                          value={chosenSubId}
                          onChange={(e) =>
                            setSelectedSubstitutes((prev) => ({
                              ...prev,
                              [lesson.id]: e.target.value,
                            }))
                          }
                        >
                          {rankedCandidates.length === 0 ? (
                            <option value="">No qualified free teachers</option>
                          ) : (
                            rankedCandidates.map((cand, idx) => {
                              const prof = profiles.find((p) => p.id === cand.id)
                              const isSpecialist = subj ? cand.qualified_subject_ids.includes(subj.id) : false
                              return (
                                <option key={cand.id} value={cand.id}>
                                  {idx + 1}. {prof?.full_name}{" "}
                                  {isSpecialist ? "⭐ (Subject Specialist)" : "(Available Free)"}
                                </option>
                              )
                            })
                          )}
                        </select>
                      </div>

                      <Button
                        size="sm"
                        disabled={rankedCandidates.length === 0}
                        onClick={() => handleAssignSubstitution(lesson)}
                        className="h-8 text-xs gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Assign
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Substitution History Table */}
      <Card>
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-sm flex items-center gap-2">
            <History className="w-4 h-4 text-slate-500" />
            Recent Substitution Assignments
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Absent Faculty</TableHead>
                <TableHead>Substitute Assigned</TableHead>
                <TableHead>Subject &amp; Class</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {instSubstitutions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-400">
                    No substitute assignments logged yet.
                  </TableCell>
                </TableRow>
              ) : (
                instSubstitutions.map((sub) => {
                  const absentProf = profiles.find((p) => p.id === sub.absent_teacher_id)
                  const subProf = profiles.find((p) => p.id === sub.substitute_teacher_id)
                  const les = lessons.find((l) => l.id === sub.lesson_id)
                  const subj = les ? subjects.find((s) => s.id === les.subject_id) : null
                  const cg = les ? classGroups.find((c) => c.id === les.class_group_id) : null

                  return (
                    <TableRow key={sub.id}>
                      <TableCell className="text-xs font-mono text-slate-600">
                        {sub.date}
                      </TableCell>
                      <TableCell className="text-xs font-medium text-red-700">
                        {absentProf?.full_name || sub.absent_teacher_id}
                      </TableCell>
                      <TableCell className="text-xs font-medium text-emerald-700">
                        {subProf?.full_name || "Unassigned"}
                      </TableCell>
                      <TableCell className="text-xs text-slate-800">
                        {subj?.name} ({cg?.name})
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {sub.reason || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="primary" className="text-[10px] uppercase">
                          {sub.status}
                        </Badge>
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
