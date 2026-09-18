import React, { useState, useEffect } from "react"
import {
  Calendar,
  Clock,
  Building,
  Users,
  UserCheck,
  AlertTriangle,
  CheckCircle2,
  BookOpen,
  FileText,
  ShieldCheck,
  Plus,
} from "lucide-react"
import { useDataStore } from "@/stores/useDataStore"
import type { AssessmentSession, AssessmentType } from "@/types/database"
import {
  calculateEndTime,
  validateAssessmentSession,
} from "@/lib/scheduler-engine/assessment-validator"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

const DURATION_PRESETS = [
  { label: "30m", minutes: 30 },
  { label: "45m", minutes: 45 },
  { label: "1h (60m)", minutes: 60 },
  { label: "1.5h (90m)", minutes: 90 },
  { label: "2h (120m)", minutes: 120 },
  { label: "3h (180m)", minutes: 180 },
]

interface AddAssessmentDialogProps {
  open: boolean
  onClose: () => void
  initialType?: AssessmentType
  sessionToEdit?: AssessmentSession | null
}

export function AddAssessmentDialog({
  open,
  onClose,
  initialType = "exam",
  sessionToEdit,
}: AddAssessmentDialogProps) {
  const {
    currentInstitutionId,
    terms,
    rooms,
    subjects,
    teachers,
    profiles,
    classGroups,
    assessmentSessions,
    addAssessmentSession,
    updateAssessmentSession,
  } = useDataStore()

  const activeTerm = terms[0]
  const instRooms = rooms.filter((r) => r.institution_id === currentInstitutionId)
  const instSubjects = subjects.filter((s) => s.institution_id === currentInstitutionId)
  const instTeachers = teachers.filter((t) => t.institution_id === currentInstitutionId)
  const instClasses = classGroups.filter((c) => c.institution_id === currentInstitutionId)

  // Form State
  const [type, setType] = useState<AssessmentType>(initialType)
  const [title, setTitle] = useState("")
  const [subjectId, setSubjectId] = useState("")
  const [selectedClassGroupIds, setSelectedClassGroupIds] = useState<string[]>([])
  const [date, setDate] = useState(new Date().toISOString().substring(0, 10))
  const [startTime, setStartTime] = useState("09:00")
  const [durationMinutes, setDurationMinutes] = useState(type === "exam" ? 120 : 45)
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([])
  const [selectedSupervisorIds, setSelectedSupervisorIds] = useState<string[]>([])
  const [chiefSupervisorId, setChiefSupervisorId] = useState<string>("")
  const [instructions, setInstructions] = useState("")
  const [status, setStatus] = useState<AssessmentSession["status"]>("scheduled")

  // Reset/Populate form when dialog opens or editing session changes
  useEffect(() => {
    if (open) {
      if (sessionToEdit) {
        setType(sessionToEdit.type)
        setTitle(sessionToEdit.title)
        setSubjectId(sessionToEdit.subject_id)
        setSelectedClassGroupIds(sessionToEdit.class_group_ids)
        setDate(sessionToEdit.date)
        setStartTime(sessionToEdit.start_time)
        setDurationMinutes(sessionToEdit.duration_minutes)
        setSelectedRoomIds(sessionToEdit.room_ids)
        setSelectedSupervisorIds(sessionToEdit.supervisor_ids)
        setChiefSupervisorId(sessionToEdit.chief_supervisor_id || "")
        setInstructions(sessionToEdit.instructions || "")
        setStatus(sessionToEdit.status)
      } else {
        setType(initialType)
        setTitle("")
        setSubjectId(instSubjects[0]?.id || "")
        setSelectedClassGroupIds(instClasses[0] ? [instClasses[0].id] : [])
        setDate(new Date().toISOString().substring(0, 10))
        setStartTime("09:00")
        setDurationMinutes(initialType === "exam" ? 120 : 45)
        setSelectedRoomIds(instRooms[0] ? [instRooms[0].id] : [])
        setSelectedSupervisorIds(instTeachers[0] ? [instTeachers[0].id] : [])
        setChiefSupervisorId(instTeachers[0]?.id || "")
        setInstructions(
          initialType === "exam"
            ? "Calculators permitted. Bags and phones deposited at front of hall."
            : "Closed book assessment."
        )
        setStatus("scheduled")
      }
    }
  }, [open, sessionToEdit, initialType])

  // Calculated End Time
  const computedEndTime = calculateEndTime(startTime, durationMinutes)

  // Total Students taking this assessment
  const totalStudents = selectedClassGroupIds.reduce((sum, cid) => {
    const cg = instClasses.find((c) => c.id === cid)
    return sum + (cg?.size || 0)
  }, 0)

  // Total Room Capacity booked
  const totalRoomCapacity = selectedRoomIds.reduce((sum, rid) => {
    const r = instRooms.find((rm) => rm.id === rid)
    return sum + (r?.capacity || 0)
  }, 0)

  // Live Validation
  const candidateSession: Partial<AssessmentSession> = {
    id: sessionToEdit?.id,
    type,
    title,
    date,
    start_time: startTime,
    duration_minutes: durationMinutes,
    end_time: computedEndTime,
    room_ids: selectedRoomIds,
    supervisor_ids: selectedSupervisorIds,
    chief_supervisor_id: chiefSupervisorId || null,
    class_group_ids: selectedClassGroupIds,
  }

  const { isValid, conflicts } = validateAssessmentSession(candidateSession, {
    existingSessions: assessmentSessions,
    rooms: instRooms,
    teachers: instTeachers,
    profiles,
    classGroups: instClasses,
  })

  const hasHardError = conflicts.some((c) => c.severity === "error")

  // Toggle class group selection
  const toggleClassGroup = (cgId: string) => {
    setSelectedClassGroupIds((prev) =>
      prev.includes(cgId) ? prev.filter((id) => id !== cgId) : [...prev, cgId]
    )
  }

  // Toggle room selection
  const toggleRoom = (roomId: string) => {
    setSelectedRoomIds((prev) =>
      prev.includes(roomId) ? prev.filter((id) => id !== roomId) : [...prev, roomId]
    )
  }

  // Toggle supervisor selection
  const toggleSupervisor = (teacherId: string) => {
    setSelectedSupervisorIds((prev) => {
      const next = prev.includes(teacherId)
        ? prev.filter((id) => id !== teacherId)
        : [...prev, teacherId]

      // If chief supervisor was unselected, reset chief supervisor
      if (!next.includes(chiefSupervisorId)) {
        setChiefSupervisorId(next[0] || "")
      }
      return next
    })
  }

  const handleSave = () => {
    if (!title.trim() || !subjectId || selectedClassGroupIds.length === 0) {
      alert("Please enter a title, select a subject, and at least one class group.")
      return
    }

    if (selectedRoomIds.length === 0) {
      alert("Please book at least one room for this assessment.")
      return
    }

    if (selectedSupervisorIds.length === 0) {
      alert("Please assign at least one supervisor.")
      return
    }

    if (hasHardError) {
      const confirmSave = window.confirm(
        "There are scheduling conflicts detected (room or supervisor double-booked). Do you want to proceed anyway?"
      )
      if (!confirmSave) return
    }

    const payload: Omit<AssessmentSession, "id" | "created_at"> = {
      institution_id: currentInstitutionId,
      term_id: activeTerm?.id || "default-term",
      type,
      title: title.trim(),
      subject_id: subjectId,
      class_group_ids: selectedClassGroupIds,
      date,
      start_time: startTime,
      duration_minutes: Number(durationMinutes),
      end_time: computedEndTime,
      room_ids: selectedRoomIds,
      supervisor_ids: selectedSupervisorIds,
      chief_supervisor_id: chiefSupervisorId || selectedSupervisorIds[0] || null,
      instructions: instructions.trim() || null,
      status,
    }

    if (sessionToEdit) {
      updateAssessmentSession(sessionToEdit.id, payload)
    } else {
      addAssessmentSession(payload)
    }

    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <DialogTitle className="text-base font-semibold flex items-center gap-2 text-slate-900">
              <Calendar className="w-4 h-4 text-[#1D4ED8]" />
              {sessionToEdit
                ? `Edit ${type === "exam" ? "Exam" : "Test"}`
                : `Schedule New ${type === "exam" ? "Exam" : "Test"}`}
            </DialogTitle>
            <div className="flex items-center gap-1.5 p-0.5 bg-slate-100 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setType("exam")
                  if (!sessionToEdit) setDurationMinutes(120)
                }}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  type === "exam"
                    ? "bg-white text-blue-700 shadow-2xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Exam
              </button>
              <button
                type="button"
                onClick={() => {
                  setType("test")
                  if (!sessionToEdit) setDurationMinutes(45)
                }}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  type === "test"
                    ? "bg-white text-indigo-700 shadow-2xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Test
              </button>
            </div>
          </div>
          <DialogDescription className="text-xs text-slate-500">
            Define timing, set duration, book rooms, and assign invigilators with real-time clash
            detection.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* 1. Title & Subject */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="font-medium text-slate-700 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                {type === "exam" ? "Exam Title / Paper Name" : "Test Title"} *
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  type === "exam"
                    ? "e.g. Mathematics Paper 1 (Calculus & Vectors)"
                    : "e.g. Unit 3 Physics Progress Quiz"
                }
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="font-medium text-slate-700 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                Subject *
              </label>
              <select
                value={subjectId}
                onChange={(e) => {
                  setSubjectId(e.target.value)
                  if (!title) {
                    const subj = instSubjects.find((s) => s.id === e.target.value)
                    if (subj) {
                      setTitle(`${subj.name} ${type === "exam" ? "Final Examination" : "Class Test"}`)
                    }
                  }
                }}
                className="w-full h-8 px-2 text-xs rounded-md border border-slate-300 bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-600"
              >
                {instSubjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 2. Class Groups Multi-Select */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-medium text-slate-700 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                Participating Classes / Cohorts *
              </label>
              <Badge variant="secondary" className="text-[10px] font-normal py-0">
                Enrolled Students: <span className="font-semibold ml-1">{totalStudents}</span>
              </Badge>
            </div>
            <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-md max-h-24 overflow-y-auto">
              {instClasses.map((cg) => {
                const isSelected = selectedClassGroupIds.includes(cg.id)
                return (
                  <button
                    key={cg.id}
                    type="button"
                    onClick={() => toggleClassGroup(cg.id)}
                    className={`px-2.5 py-1 rounded text-xs flex items-center gap-1.5 transition-all cursor-pointer border ${
                      isSelected
                        ? "bg-blue-600 text-white border-blue-700 shadow-2xs font-medium"
                        : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                    }`}
                  >
                    <span>{cg.name}</span>
                    <span
                      className={`text-[10px] px-1 py-0.2 rounded-full ${
                        isSelected ? "bg-blue-700 text-blue-100" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {cg.size} students
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 3. Date, Start Time & Duration */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="font-medium text-slate-700 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Date *
                </label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-8 text-xs bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="font-medium text-slate-700 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  Start Time *
                </label>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="h-8 text-xs bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="font-medium text-slate-700 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    Calculated Window
                  </span>
                </label>
                <div className="h-8 px-2.5 bg-white border border-slate-300 rounded-md flex items-center justify-between text-xs">
                  <span className="text-slate-500">End Time:</span>
                  <span className="font-bold text-slate-900">{computedEndTime}</span>
                </div>
              </div>
            </div>

            {/* Duration Presets & Custom Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="font-medium text-slate-700">Set Duration:</label>
                <span className="text-[11px] font-semibold text-blue-700">
                  {durationMinutes} minutes ({Math.floor(durationMinutes / 60)}h{" "}
                  {durationMinutes % 60}m)
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {DURATION_PRESETS.map((preset) => (
                  <button
                    key={preset.minutes}
                    type="button"
                    onClick={() => setDurationMinutes(preset.minutes)}
                    className={`px-2.5 py-1 rounded text-xs font-medium border cursor-pointer transition-colors ${
                      durationMinutes === preset.minutes
                        ? "bg-blue-50 border-[#1D4ED8] text-[#1D4ED8] font-semibold"
                        : "bg-white border-slate-300 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
                <div className="flex items-center gap-1 ml-auto">
                  <span className="text-slate-400 text-[11px]">Custom:</span>
                  <Input
                    type="number"
                    min={5}
                    max={600}
                    step={5}
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Math.max(5, Number(e.target.value)))}
                    className="w-16 h-7 text-xs bg-white text-center"
                  />
                  <span className="text-slate-400 text-[11px]">mins</span>
                </div>
              </div>
            </div>
          </div>

          {/* 4. Room Booking (Multi-Room with Capacity Check) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-medium text-slate-700 flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-slate-400" />
                Book Room / Rooms *
              </label>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500">
                  Capacity:{" "}
                  <strong
                    className={totalStudents > totalRoomCapacity ? "text-red-600" : "text-emerald-700"}
                  >
                    {totalRoomCapacity} seats
                  </strong>
                </span>
                {totalStudents > totalRoomCapacity && (
                  <Badge variant="destructive" className="text-[10px] py-0">
                    Deficit: {totalStudents - totalRoomCapacity}
                  </Badge>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 max-h-32 overflow-y-auto p-1.5 bg-slate-50 border border-slate-200 rounded-md">
              {instRooms.map((room) => {
                const isSelected = selectedRoomIds.includes(room.id)
                return (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => toggleRoom(room.id)}
                    className={`p-1.5 rounded text-left border cursor-pointer transition-all flex flex-col justify-between ${
                      isSelected
                        ? "bg-blue-50 border-[#1D4ED8] text-blue-900 font-medium"
                        : "bg-white border-slate-300 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="truncate text-[11px] font-medium">{room.name}</span>
                      {isSelected && <CheckCircle2 className="w-3 h-3 text-[#1D4ED8] shrink-0" />}
                    </div>
                    <span className="text-[10px] text-slate-400">
                      Cap: {room.capacity} | {room.room_type}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 5. Supervisor(s) Assignment */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-medium text-slate-700 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                Assign Supervisor(s) / Invigilator(s) *
              </label>
              <span className="text-[11px] text-slate-500">
                Assigned: <strong>{selectedSupervisorIds.length}</strong>
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-32 overflow-y-auto p-1.5 bg-slate-50 border border-slate-200 rounded-md">
              {instTeachers.map((t) => {
                const prof = profiles.find((p) => p.id === t.id)
                const isSelected = selectedSupervisorIds.includes(t.id)
                const isChief = chiefSupervisorId === t.id

                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleSupervisor(t.id)}
                    className={`p-1.5 rounded text-left border cursor-pointer transition-all flex flex-col justify-between ${
                      isSelected
                        ? "bg-emerald-50 border-emerald-600 text-emerald-950 font-medium"
                        : "bg-white border-slate-300 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="truncate text-[11px] font-medium">
                        {prof?.full_name || t.id}
                      </span>
                      {isSelected && <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />}
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-[9px] text-slate-400 truncate">{prof?.email}</span>
                      {isChief && (
                        <span className="text-[9px] bg-emerald-200 text-emerald-800 px-1 rounded font-semibold">
                          Chief
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Chief Supervisor Designation */}
            {selectedSupervisorIds.length > 1 && (
              <div className="flex items-center gap-2 p-2 bg-slate-100 border border-slate-200 rounded-md">
                <ShieldCheck className="w-3.5 h-3.5 text-slate-600" />
                <span className="text-slate-600 text-[11px]">Designate Chief Invigilator:</span>
                <select
                  value={chiefSupervisorId}
                  onChange={(e) => setChiefSupervisorId(e.target.value)}
                  className="h-7 px-2 text-xs rounded border border-slate-300 bg-white font-medium"
                >
                  {selectedSupervisorIds.map((sid) => {
                    const prof = profiles.find((p) => p.id === sid)
                    return (
                      <option key={sid} value={sid}>
                        {prof?.full_name || sid} (Chief Invigilator)
                      </option>
                    )
                  })}
                </select>
              </div>
            )}
          </div>

          {/* 6. Instructions & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="font-medium text-slate-700">Special Instructions / Rules</label>
              <Input
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="e.g. Graph paper supplied, scientific calculators permitted"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="font-medium text-slate-700">Publishing Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as AssessmentSession["status"])}
                className="w-full h-8 px-2 text-xs rounded-md border border-slate-300 bg-white"
              >
                <option value="draft">Draft (Unpublished)</option>
                <option value="scheduled">Scheduled (Active)</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {/* 7. Real-Time Conflict Alerts */}
          {conflicts.length > 0 && (
            <div className="p-2.5 rounded-md border bg-amber-50/70 border-amber-200 space-y-1.5">
              <div className="flex items-center gap-1.5 text-amber-800 font-semibold text-[11px]">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span>Scheduling Alerts ({conflicts.length})</span>
              </div>
              <ul className="space-y-1 pl-4 list-disc text-[11px]">
                {conflicts.map((c, i) => (
                  <li
                    key={i}
                    className={c.severity === "error" ? "text-red-700 font-medium" : "text-amber-700"}
                  >
                    {c.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {conflicts.length === 0 && selectedRoomIds.length > 0 && (
            <div className="p-2 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-1.5 text-[11px]">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>No scheduling conflicts detected. Rooms and supervisors are free.</span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-slate-200">
          <Button variant="outline" size="sm" onClick={onClose} className="h-8 text-xs">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            className="h-8 text-xs bg-[#1D4ED8] hover:bg-blue-700 text-white font-semibold"
          >
            {sessionToEdit ? "Save Changes" : `Schedule ${type === "exam" ? "Exam" : "Test"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
