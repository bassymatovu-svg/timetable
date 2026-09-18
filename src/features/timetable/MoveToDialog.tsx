import React, { useState } from "react"
import { MoveRight, AlertCircle, CheckCircle2, Lock } from "lucide-react"
import { useDataStore } from "@/stores/useDataStore"
import type { Lesson, Period } from "@/types/database"
import { validatePlacement } from "@/lib/scheduler-engine"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]

interface MoveToDialogProps {
  lesson: Lesson | null
  open: boolean
  onClose: () => void
}

export function MoveToDialog({ lesson, open, onClose }: MoveToDialogProps) {
  const {
    currentInstitutionId,
    periods,
    rooms,
    subjects,
    teachers,
    classGroups,
    teacherUnavailability,
    lessons,
    updateLesson,
  } = useDataStore()

  const [selectedDay, setSelectedDay] = useState<number>(1)
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("")
  const [selectedRoomId, setSelectedRoomId] = useState<string>(lesson?.room_id || "")

  React.useEffect(() => {
    if (lesson) {
      const currentPeriod = periods.find((p) => p.id === lesson.period_id)
      if (currentPeriod) {
        setSelectedDay(currentPeriod.day_of_week)
      }
      setSelectedPeriodId(lesson.period_id)
      setSelectedRoomId(lesson.room_id)
    }
  }, [lesson, periods])

  if (!lesson) return null

  const subject = subjects.find((s) => s.id === lesson.subject_id)
  const teacher = teachers.find((t) => t.id === lesson.teacher_id)
  const classGroup = classGroups.find((c) => c.id === lesson.class_group_id)

  const hardContext = {
    periods,
    rooms,
    subjects,
    teachers,
    classGroups,
    teacherUnavailability,
  }

  // Periods for selected day
  const dayPeriods = periods
    .filter((p) => p.institution_id === currentInstitutionId && p.day_of_week === selectedDay)
    .sort((a, b) => a.period_number - b.period_number)

  // Validate candidate placement
  const candidate: Lesson = {
    ...lesson,
    period_id: selectedPeriodId || lesson.period_id,
    room_id: selectedRoomId || lesson.room_id,
  }

  const otherLessons = lessons.filter((l) => l.id !== lesson.id)
  const { isValid, violations } = validatePlacement(candidate, otherLessons, hardContext)

  const handleConfirmMove = () => {
    if (!isValid) return
    updateLesson(lesson.id, {
      period_id: candidate.period_id,
      room_id: candidate.room_id,
    })
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm flex items-center gap-2">
            <MoveRight className="w-4 h-4 text-[#1D4ED8]" />
            Keyboard Accessible Move: {subject?.name || "Lesson"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Transfer this lesson to another period and room with live conflict verification.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Target Day Selector */}
          <div>
            <label className="text-[11px] font-semibold text-slate-700 block mb-1">Target Day</label>
            <div className="grid grid-cols-5 gap-1">
              {[1, 2, 3, 4, 5].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setSelectedDay(d)}
                  className={`py-1.5 text-xs font-medium rounded border transition-colors cursor-pointer ${
                    selectedDay === d
                      ? "bg-[#1D4ED8] text-white border-[#1D4ED8]"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {DAY_NAMES[d - 1].substring(0, 3)}
                </button>
              ))}
            </div>
          </div>

          {/* Period Selector with Live Legality Badge */}
          <div>
            <label className="text-[11px] font-semibold text-slate-700 block mb-1">Target Period</label>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {dayPeriods.map((p) => {
                const testCandidate: Lesson = {
                  ...lesson,
                  period_id: p.id,
                  room_id: selectedRoomId || lesson.room_id,
                }
                const testResult = validatePlacement(testCandidate, otherLessons, hardContext)
                const isSelected = selectedPeriodId === p.id
                const isCurrent = lesson.period_id === p.id

                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={p.is_break || (!testResult.isValid && !isCurrent)}
                    onClick={() => setSelectedPeriodId(p.id)}
                    className={`w-full flex items-center justify-between p-2 rounded text-xs border text-left transition-colors ${
                      isSelected
                        ? "border-[#1D4ED8] bg-blue-50/60 text-[#1D4ED8] font-semibold"
                        : p.is_break
                        ? "border-slate-100 bg-slate-50 text-slate-400 opacity-60 cursor-not-allowed"
                        : !testResult.isValid && !isCurrent
                        ? "border-red-200 bg-red-50/40 text-red-700 opacity-75 cursor-not-allowed"
                        : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50 cursor-pointer"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-slate-600">P{p.period_number}</span>
                      <span className="text-[11px] text-slate-500">
                        {p.start_time.substring(0, 5)} - {p.end_time.substring(0, 5)}
                      </span>
                      {isCurrent && (
                        <Badge variant="outline" className="text-[9px] py-0 px-1">
                          Current
                        </Badge>
                      )}
                    </div>

                    <div>
                      {p.is_break ? (
                        <span className="text-[10px] text-amber-700 font-medium">Break</span>
                      ) : !testResult.isValid && !isCurrent ? (
                        <span className="text-[10px] text-red-600 font-medium">
                          {testResult.violations[0]?.code.replace(/_/g, " ") || "Conflict"}
                        </span>
                      ) : (
                        <span className="text-[10px] text-emerald-600 font-medium">Legal Slot</span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Room Selector */}
          <div>
            <label className="text-[11px] font-semibold text-slate-700 block mb-1">Target Room</label>
            <select
              className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-1 text-xs text-slate-900 shadow-xs"
              value={selectedRoomId}
              onChange={(e) => setSelectedRoomId(e.target.value)}
            >
              {rooms
                .filter((r) => r.institution_id === currentInstitutionId)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.room_type}, {r.capacity} seats)
                  </option>
                ))}
            </select>
          </div>

          {/* Conflict Alert Banner */}
          {!isValid && violations.length > 0 && (
            <div className="p-2.5 rounded bg-red-50 border border-red-200 flex items-start gap-2 text-xs text-red-800">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-semibold">Cannot move to this slot:</strong>
                <p className="text-[11px]">{violations[0]?.message}</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleConfirmMove}
            disabled={!isValid || selectedPeriodId === lesson.period_id && selectedRoomId === lesson.room_id}
          >
            Confirm Move
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
