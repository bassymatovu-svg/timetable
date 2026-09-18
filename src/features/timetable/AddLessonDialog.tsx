import React, { useState } from "react"
import { Plus, AlertCircle, CheckCircle2, Building, User, BookOpen, Users } from "lucide-react"
import { useDataStore } from "@/stores/useDataStore"
import type { Lesson, Period } from "@/types/database"
import { validatePlacement } from "@/lib/scheduler-engine"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]

interface AddLessonDialogProps {
  period: Period | null
  defaultClassId?: string
  defaultTeacherId?: string
  defaultRoomId?: string
  open: boolean
  onClose: () => void
}

export function AddLessonDialog({
  period,
  defaultClassId,
  defaultTeacherId,
  defaultRoomId,
  open,
  onClose,
}: AddLessonDialogProps) {
  const {
    currentInstitutionId,
    terms,
    periods,
    rooms,
    subjects,
    teachers,
    profiles,
    classGroups,
    teacherUnavailability,
    lessons,
    addLesson,
  } = useDataStore()

  const activeTerm = terms[0]
  const instRooms = rooms.filter((r) => r.institution_id === currentInstitutionId)
  const instSubjects = subjects.filter((s) => s.institution_id === currentInstitutionId)
  const instTeachers = teachers.filter((t) => t.institution_id === currentInstitutionId)
  const instClasses = classGroups.filter((c) => c.institution_id === currentInstitutionId)

  // Selection states
  const [selectedClassId, setSelectedClassId] = useState(defaultClassId || instClasses[0]?.id || "")
  const [selectedSubjectId, setSelectedSubjectId] = useState(instSubjects[0]?.id || "")
  const [selectedTeacherId, setSelectedTeacherId] = useState(defaultTeacherId || instTeachers[0]?.id || "")
  const [selectedRoomId, setSelectedRoomId] = useState(defaultRoomId || instRooms[0]?.id || "")

  // Reset defaults when opened
  React.useEffect(() => {
    if (open) {
      if (defaultClassId) setSelectedClassId(defaultClassId)
      if (defaultTeacherId) setSelectedTeacherId(defaultTeacherId)
      if (defaultRoomId) setSelectedRoomId(defaultRoomId)
    }
  }, [open, defaultClassId, defaultTeacherId, defaultRoomId])

  if (!period) return null

  const hardContext = {
    periods,
    rooms: instRooms,
    subjects: instSubjects,
    teachers: instTeachers,
    classGroups: instClasses,
    teacherUnavailability,
  }

  // Candidate lesson for live validation
  const candidate: Lesson = {
    id: `temp-add-${Date.now()}`,
    term_id: activeTerm?.id || "",
    class_group_id: selectedClassId,
    subject_id: selectedSubjectId,
    teacher_id: selectedTeacherId,
    room_id: selectedRoomId,
    period_id: period.id,
    week_pattern: "all",
    locked: false,
  }

  const { isValid, violations } = validatePlacement(candidate, lessons, hardContext)

  const handleSave = () => {
    if (!isValid || !activeTerm) return

    addLesson({
      term_id: activeTerm.id,
      class_group_id: selectedClassId,
      subject_id: selectedSubjectId,
      teacher_id: selectedTeacherId,
      room_id: selectedRoomId,
      period_id: period.id,
      week_pattern: "all",
      locked: false,
    })

    onClose()
  }

  const selectedSubject = instSubjects.find((s) => s.id === selectedSubjectId)
  const selectedClass = instClasses.find((c) => c.id === selectedClassId)
  const selectedRoom = instRooms.find((r) => r.id === selectedRoomId)
  const selectedTeacherProfile = profiles.find((p) => p.id === selectedTeacherId)

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm flex items-center gap-2">
            <Plus className="w-4 h-4 text-[#1D4ED8]" />
            Add Lesson to {DAY_NAMES[period.day_of_week - 1]} &bull; Period {period.period_number}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {period.start_time.substring(0, 5)} - {period.end_time.substring(0, 5)} &bull; Select cohort, subject discipline, faculty, and room.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 py-2">
          {/* Class Group Selection */}
          <div>
            <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5 mb-1">
              <Users className="w-3.5 h-3.5 text-slate-500" />
              Class Cohort
            </label>
            <select
              className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-xs text-slate-800 shadow-2xs cursor-pointer"
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
            >
              {instClasses.map((cg) => (
                <option key={cg.id} value={cg.id}>
                  {cg.name} (Year {cg.year_level || "-"}, {cg.size} students)
                </option>
              ))}
            </select>
          </div>

          {/* Subject Selection */}
          <div>
            <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5 mb-1">
              <BookOpen className="w-3.5 h-3.5 text-slate-500" />
              Subject Discipline
            </label>
            <select
              className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-xs text-slate-800 shadow-2xs cursor-pointer"
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
            >
              {instSubjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code}) - Requires {s.required_room_type || "classroom"}
                </option>
              ))}
            </select>
          </div>

          {/* Teacher Selection */}
          <div>
            <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5 mb-1">
              <User className="w-3.5 h-3.5 text-slate-500" />
              Faculty Instructor
            </label>
            <select
              className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-xs text-slate-800 shadow-2xs cursor-pointer"
              value={selectedTeacherId}
              onChange={(e) => setSelectedTeacherId(e.target.value)}
            >
              {instTeachers.map((t) => {
                const prof = profiles.find((p) => p.id === t.id)
                const isSpecialist = selectedSubject ? t.qualified_subject_ids.includes(selectedSubject.id) : false
                const isUnavailable = teacherUnavailability.some(
                  (u) => u.teacher_id === t.id && u.period_id === period.id
                )
                const isAlreadyTeaching = lessons.some(
                  (l) => l.teacher_id === t.id && l.period_id === period.id
                )

                let statusBadge = ""
                if (isAlreadyTeaching) statusBadge = " [Busy this period]"
                else if (isUnavailable) statusBadge = " [Unavailable]"
                else if (isSpecialist) statusBadge = " (Specialist)"

                return (
                  <option key={t.id} value={t.id}>
                    {prof?.full_name || t.id} {statusBadge}
                  </option>
                )
              })}
            </select>
          </div>

          {/* Room Selection */}
          <div>
            <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5 mb-1">
              <Building className="w-3.5 h-3.5 text-slate-500" />
              Instructional Facility / Room
            </label>
            <select
              className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-xs text-slate-800 shadow-2xs cursor-pointer"
              value={selectedRoomId}
              onChange={(e) => setSelectedRoomId(e.target.value)}
            >
              {instRooms.map((r) => {
                const isBooked = lessons.some(
                  (l) => l.room_id === r.id && l.period_id === period.id
                )
                const fitsCapacity = selectedClass ? r.capacity >= selectedClass.size : true
                const fitsType = selectedSubject?.required_room_type
                  ? r.room_type === selectedSubject.required_room_type
                  : true

                let note = ""
                if (isBooked) note = " [Booked]"
                else if (!fitsCapacity) note = " [Undersized]"
                else if (!fitsType) note = ` [Not a ${selectedSubject?.required_room_type}]`

                return (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.room_type}, {r.capacity} seats) {note}
                  </option>
                )
              })}
            </select>
          </div>

          {/* Live Validation Alert Banner */}
          {!isValid && violations.length > 0 ? (
            <div className="p-2.5 rounded bg-red-50 border border-red-200 flex items-start gap-2 text-xs text-red-800">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-semibold">Constraint Conflict:</strong>
                <p className="text-[11px]">{violations[0].message}</p>
              </div>
            </div>
          ) : (
            <div className="p-2 rounded bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-xs text-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Valid placement &bull; All hard constraints satisfied</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!isValid}>
            Add Lesson
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
