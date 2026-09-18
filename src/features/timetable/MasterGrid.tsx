import React, { useState } from "react"
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  Lock,
  Unlock,
  MoveRight,
  AlertCircle,
  CheckCircle2,
  Users,
  GraduationCap,
  Building,
  Coffee,
  Filter,
  Download,
  FileSpreadsheet,
  FileText,
  Printer,
  Plus,
} from "lucide-react"
import { useDataStore } from "@/stores/useDataStore"
import type { Lesson, Period } from "@/types/database"
import { validatePlacement } from "@/lib/scheduler-engine"
import { MoveToDialog } from "./MoveToDialog"
import { AddLessonDialog } from "./AddLessonDialog"
import {
  downloadGridAsExcel,
  downloadGridAsWord,
  downloadGridAsPdf,
} from "@/lib/export/grid-exporter"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]

type FilterMode = "class_group" | "teacher" | "room"

export function MasterGrid() {
  const {
    currentInstitutionId,
    institutions,
    terms,
    periods,
    rooms,
    subjects,
    teachers,
    profiles,
    classGroups,
    teacherUnavailability,
    lessons,
    updateLesson,
    toggleLessonLock,
  } = useDataStore()

  const currentInstitution = institutions.find((i) => i.id === currentInstitutionId)
  const activeTerm = terms[0]

  const instPeriods = periods.filter((p) => p.institution_id === currentInstitutionId)
  const instRooms = rooms.filter((r) => r.institution_id === currentInstitutionId)
  const instSubjects = subjects.filter((s) => s.institution_id === currentInstitutionId)
  const instTeachers = teachers.filter((t) => t.institution_id === currentInstitutionId)
  const instClasses = classGroups.filter((c) => c.institution_id === currentInstitutionId)

  // Filter state
  const [filterMode, setFilterMode] = useState<FilterMode>("class_group")
  const [selectedFilterId, setSelectedFilterId] = useState<string>(instClasses[0]?.id || "")

  // Drag and drop state
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null)
  const [overPeriodId, setOverPeriodId] = useState<string | null>(null)
  const [dialogLesson, setDialogLesson] = useState<Lesson | null>(null)

  // Add lesson to empty slot state
  const [addSlotPeriod, setAddSlotPeriod] = useState<Period | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  )

  const hardContext = {
    periods: instPeriods,
    rooms: instRooms,
    subjects: instSubjects,
    teachers: instTeachers,
    classGroups: instClasses,
    teacherUnavailability,
  }

  // Filter lessons based on selected mode
  const filteredLessons = lessons.filter((l) => {
    if (filterMode === "class_group") return l.class_group_id === selectedFilterId
    if (filterMode === "teacher") return l.teacher_id === selectedFilterId
    if (filterMode === "room") return l.room_id === selectedFilterId
    return true
  })

  // Period numbers in order
  const periodNumbers = Array.from(new Set(instPeriods.map((p) => p.period_number))).sort(
    (a, b) => a - b
  )

  const activeLesson = lessons.find((l) => l.id === activeLessonId)

  // Validate drag over in real time
  let isDragOverValid = true
  let dragOverViolationMessage = ""
  if (activeLesson && overPeriodId) {
    const candidate: Lesson = {
      ...activeLesson,
      period_id: overPeriodId,
    }
    const otherLessons = lessons.filter((l) => l.id !== activeLesson.id)
    const res = validatePlacement(candidate, otherLessons, hardContext)
    isDragOverValid = res.isValid
    if (!res.isValid) {
      dragOverViolationMessage = res.violations[0]?.message || "Illegal placement"
    }
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveLessonId(String(event.active.id))
  }

  const handleDragOver = (event: DragOverEvent) => {
    if (event.over) {
      setOverPeriodId(String(event.over.id))
    } else {
      setOverPeriodId(null)
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveLessonId(null)
    setOverPeriodId(null)

    if (!over) return

    const draggedLessonId = String(active.id)
    const targetPeriodId = String(over.id)

    const targetPeriod = instPeriods.find((p) => p.id === targetPeriodId)
    if (!targetPeriod || targetPeriod.is_break) return

    const draggedLesson = lessons.find((l) => l.id === draggedLessonId)
    if (!draggedLesson || draggedLesson.locked) return

    // Run hard constraint validator
    const candidate: Lesson = {
      ...draggedLesson,
      period_id: targetPeriodId,
    }
    const otherLessons = lessons.filter((l) => l.id !== draggedLesson.id)
    const { isValid, violations } = validatePlacement(candidate, otherLessons, hardContext)

    if (!isValid) {
      alert(`Cannot move lesson: ${violations[0]?.message || "Hard constraint violated."}`)
      return
    }

    // Persist valid drop
    updateLesson(draggedLesson.id, {
      period_id: targetPeriodId,
    })
  }

  // Get active filter title for document headers
  let activeFilterTitle = "Master Timetable"
  if (filterMode === "class_group") {
    const cg = instClasses.find((c) => c.id === selectedFilterId)
    activeFilterTitle = `${cg?.name || "Class"} Timetable`
  } else if (filterMode === "teacher") {
    const prof = profiles.find((p) => p.id === selectedFilterId)
    activeFilterTitle = `${prof?.full_name || "Teacher"} Schedule`
  } else if (filterMode === "room") {
    const r = instRooms.find((rm) => rm.id === selectedFilterId)
    activeFilterTitle = `${r?.name || "Room"} Schedule`
  }

  const exportContext = {
    title: activeFilterTitle,
    subtitle: activeTerm?.name || "Academic Schedule",
    institutionName: currentInstitution?.name || "Institution",
    periods: instPeriods,
    lessons: filteredLessons,
    rooms: instRooms,
    subjects: instSubjects,
    classGroups: instClasses,
    profiles,
  }

  return (
    <div className="space-y-4">
      {/* Top Filter & View Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-white border border-slate-200 rounded-lg no-print">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 flex items-center gap-1 mr-1">
            <Filter className="w-3.5 h-3.5" />
            View Mode:
          </span>

          <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5">
            <button
              onClick={() => {
                setFilterMode("class_group")
                setSelectedFilterId(instClasses[0]?.id || "")
              }}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer flex items-center gap-1.5 ${
                filterMode === "class_group"
                  ? "bg-white text-[#1D4ED8] shadow-2xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Class Cohort
            </button>
            <button
              onClick={() => {
                setFilterMode("teacher")
                setSelectedFilterId(instTeachers[0]?.id || "")
              }}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer flex items-center gap-1.5 ${
                filterMode === "teacher"
                  ? "bg-white text-[#1D4ED8] shadow-2xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              Teacher Schedule
            </button>
            <button
              onClick={() => {
                setFilterMode("room")
                setSelectedFilterId(instRooms[0]?.id || "")
              }}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer flex items-center gap-1.5 ${
                filterMode === "room"
                  ? "bg-white text-[#1D4ED8] shadow-2xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Building className="w-3.5 h-3.5" />
              Room Utilization
            </button>
          </div>

          <select
            className="h-8 rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800 shadow-2xs cursor-pointer min-w-44"
            value={selectedFilterId}
            onChange={(e) => setSelectedFilterId(e.target.value)}
          >
            {filterMode === "class_group" &&
              instClasses.map((cg) => (
                <option key={cg.id} value={cg.id}>
                  {cg.name} (Year {cg.year_level || "-"}, {cg.size} students)
                </option>
              ))}
            {filterMode === "teacher" &&
              instTeachers.map((t) => {
                const prof = profiles.find((p) => p.id === t.id)
                return (
                  <option key={t.id} value={t.id}>
                    {prof?.full_name || t.id}
                  </option>
                )
              })}
            {filterMode === "room" &&
              instRooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.room_type}, {r.capacity} seats)
                </option>
              ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          {/* Download Dropdown Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 border-slate-300 bg-white hover:bg-slate-50 text-slate-800"
              >
                <Download className="w-3.5 h-3.5 text-[#1D4ED8]" />
                <span>Download Timetable</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-[10px] text-slate-400 uppercase tracking-wider">
                Export Options
              </DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => downloadGridAsExcel(exportContext)}
                className="text-xs flex items-center gap-2 cursor-pointer py-2"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <div className="flex flex-col">
                  <span className="font-semibold text-slate-800">Excel Spreadsheet (.xlsx)</span>
                  <span className="text-[10px] text-slate-400">Timetable grid matrix</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => downloadGridAsWord(exportContext)}
                className="text-xs flex items-center gap-2 cursor-pointer py-2"
              >
                <FileText className="w-4 h-4 text-blue-600" />
                <div className="flex flex-col">
                  <span className="font-semibold text-slate-800">Word Document (.docx)</span>
                  <span className="text-[10px] text-slate-400">Formatted printable tables</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={downloadGridAsPdf}
                className="text-xs flex items-center gap-2 cursor-pointer py-2"
              >
                <Printer className="w-4 h-4 text-slate-700" />
                <div className="flex flex-col">
                  <span className="font-semibold text-slate-800">Print / Save as PDF</span>
                  <span className="text-[10px] text-slate-400">Clean print stylesheet</span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="hidden lg:flex items-center gap-2 text-xs text-slate-500 pl-2 border-l border-slate-200">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              Valid
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
              Conflict
            </span>
            <span className="flex items-center gap-1">
              <Lock className="w-3 h-3 text-slate-400" />
              Locked
            </span>
          </div>
        </div>
      </div>

      {/* DndContext Wrapping the Master Timetable Grid */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="border border-slate-300 rounded-lg overflow-x-auto bg-white shadow-xs">
          <table className="w-full border-collapse min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-300 bg-slate-100/80">
                <th className="p-2.5 border-r border-slate-300 w-28 text-left text-xs font-semibold text-slate-600">
                  Day / Period
                </th>
                {periodNumbers.map((pNum) => {
                  const samplePeriod = instPeriods.find((p) => p.period_number === pNum)
                  return (
                    <th
                      key={pNum}
                      className={`p-2 border-r border-slate-300 text-center font-semibold text-xs ${
                        samplePeriod?.is_break
                          ? "bg-amber-100/50 text-amber-900 w-20"
                          : "text-slate-800"
                      }`}
                    >
                      <div>Period {pNum}</div>
                      <div className="text-[10px] font-normal text-slate-500">
                        {samplePeriod?.start_time.substring(0, 5)} -{" "}
                        {samplePeriod?.end_time.substring(0, 5)}
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5].map((dayIdx) => (
                <tr key={dayIdx} className="border-b border-slate-200">
                  <td className="p-2.5 border-r border-slate-300 bg-slate-50/75 font-semibold text-xs text-slate-800">
                    {DAY_NAMES[dayIdx - 1]}
                  </td>

                  {periodNumbers.map((pNum) => {
                    const period = instPeriods.find(
                      (p) => p.day_of_week === dayIdx && p.period_number === pNum
                    )
                    if (!period) return <td key={pNum} className="border-r border-slate-200" />

                    const cellLessons = filteredLessons.filter(
                      (l) => l.period_id === period.id
                    )

                    return (
                      <GridCell
                        key={period.id}
                        period={period}
                        lessons={cellLessons}
                        isOver={overPeriodId === period.id}
                        isValidOver={isDragOverValid}
                        onMoveClick={(lesson) => setDialogLesson(lesson)}
                        onToggleLock={(id) => toggleLessonLock(id)}
                        onAddLessonClick={() => setAddSlotPeriod(period)}
                        subjects={instSubjects}
                        teachers={instTeachers}
                        profiles={profiles}
                        rooms={instRooms}
                        classGroups={instClasses}
                      />
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Drag Overlay with Live Dragging Card Preview */}
        <DragOverlay>
          {activeLesson ? (
            <div
              className={`p-2.5 rounded shadow-lg border text-left w-48 bg-white cursor-grabbing ${
                isDragOverValid
                  ? "border-emerald-500 ring-2 ring-emerald-400"
                  : "border-red-500 ring-2 ring-red-400"
              }`}
            >
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="font-bold text-xs text-slate-900 truncate">
                  {subjects.find((s) => s.id === activeLesson.subject_id)?.name}
                </span>
                {!isDragOverValid && (
                  <Badge variant="destructive" className="text-[9px] py-0 px-1">
                    Conflict
                  </Badge>
                )}
              </div>
              <span className="text-[10px] text-slate-500 block truncate">
                {rooms.find((r) => r.id === activeLesson.room_id)?.name}
              </span>
              {dragOverViolationMessage && (
                <span className="text-[9px] text-red-600 block truncate mt-1">
                  {dragOverViolationMessage}
                </span>
              )}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Keyboard Accessible Move To Modal */}
      <MoveToDialog
        lesson={dialogLesson}
        open={Boolean(dialogLesson)}
        onClose={() => setDialogLesson(null)}
      />

      {/* Add Lesson to Empty Slot Modal */}
      <AddLessonDialog
        period={addSlotPeriod}
        defaultClassId={filterMode === "class_group" ? selectedFilterId : undefined}
        defaultTeacherId={filterMode === "teacher" ? selectedFilterId : undefined}
        defaultRoomId={filterMode === "room" ? selectedFilterId : undefined}
        open={Boolean(addSlotPeriod)}
        onClose={() => setAddSlotPeriod(null)}
      />
    </div>
  )
}

// Droppable Period Cell
interface GridCellProps {
  period: Period
  lessons: Lesson[]
  isOver: boolean
  isValidOver: boolean
  onMoveClick: (lesson: Lesson) => void
  onToggleLock: (id: string) => void
  onAddLessonClick: () => void
  subjects: any[]
  teachers: any[]
  profiles: any[]
  rooms: any[]
  classGroups: any[]
}

function GridCell({
  period,
  lessons,
  isOver,
  isValidOver,
  onMoveClick,
  onToggleLock,
  onAddLessonClick,
  subjects,
  teachers,
  profiles,
  rooms,
  classGroups,
}: GridCellProps) {
  const { setNodeRef } = useDroppable({
    id: period.id,
    disabled: period.is_break,
  })

  if (period.is_break) {
    return (
      <td
        ref={setNodeRef}
        className="p-1 border-r border-slate-300 bg-amber-50/40 text-center align-middle"
      >
        <span className="flex items-center justify-center gap-1 text-[10px] text-amber-700 font-medium">
          <Coffee className="w-3 h-3 text-amber-600" />
          Break
        </span>
      </td>
    )
  }

  // Compute visual highlight classes during drag
  let highlightClass = "hover:bg-slate-50/60"
  if (isOver) {
    highlightClass = isValidOver
      ? "bg-emerald-50 ring-2 ring-emerald-500 ring-inset"
      : "bg-red-50 ring-2 ring-red-500 ring-inset"
  }

  return (
    <td
      ref={setNodeRef}
      className={`p-1.5 border-r border-slate-200 align-top transition-colors min-h-16 relative group/cell ${highlightClass}`}
    >
      <div className="space-y-1.5 min-h-[52px]">
        {lessons.length === 0 ? (
          <button
            type="button"
            onClick={onAddLessonClick}
            className="w-full h-full min-h-[52px] border border-dashed border-transparent group-hover/cell:border-slate-300 rounded flex flex-col items-center justify-center text-[10px] text-slate-300 group-hover/cell:text-[#1D4ED8] group-hover/cell:bg-blue-50/30 transition-all cursor-pointer"
            title="Click to schedule a lesson in this slot"
          >
            <Plus className="w-3.5 h-3.5 mb-0.5 opacity-0 group-hover/cell:opacity-100" />
            <span className="opacity-0 group-hover/cell:opacity-100 font-medium">Add Lesson</span>
          </button>
        ) : (
          lessons.map((lesson) => (
            <DraggableLessonCard
              key={lesson.id}
              lesson={lesson}
              onMoveClick={() => onMoveClick(lesson)}
              onToggleLock={() => onToggleLock(lesson.id)}
              subject={subjects.find((s) => s.id === lesson.subject_id)}
              teacherProfile={profiles.find((p) => p.id === lesson.teacher_id)}
              room={rooms.find((r) => r.id === lesson.room_id)}
              classGroup={classGroups.find((c) => c.id === lesson.class_group_id)}
            />
          ))
        )}
      </div>
    </td>
  )
}

// Draggable Lesson Card
function DraggableLessonCard({
  lesson,
  onMoveClick,
  onToggleLock,
  subject,
  teacherProfile,
  room,
  classGroup,
}: {
  lesson: Lesson
  onMoveClick: () => void
  onToggleLock: () => void
  subject: any
  teacherProfile: any
  room: any
  classGroup: any
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: lesson.id,
    disabled: lesson.locked,
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`p-1.5 rounded-sm border transition-all text-left group select-none relative ${
        isDragging ? "opacity-30" : "opacity-100"
      } ${
        lesson.locked
          ? "border-slate-300 bg-slate-50"
          : "border-slate-200 bg-white hover:border-slate-400 hover:shadow-xs cursor-grab"
      }`}
      style={{
        borderLeftWidth: "4px",
        borderLeftColor: subject?.color || "#1D4ED8",
      }}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="font-bold text-[11px] text-slate-900 truncate">
          {subject?.code || "SUBJ"}
        </span>
        <div className="flex items-center gap-0.5 opacity-80 group-hover:opacity-100">
          {/* Lock / Unlock button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onToggleLock()
            }}
            className="text-slate-400 hover:text-slate-800 p-0.5"
            title={lesson.locked ? "Unlock lesson" : "Lock lesson in place"}
          >
            {lesson.locked ? (
              <Lock className="w-3 h-3 text-amber-700" />
            ) : (
              <Unlock className="w-3 h-3 text-slate-300 hover:text-slate-600" />
            )}
          </button>

          {/* Keyboard accessible move button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onMoveClick()
            }}
            className="text-slate-400 hover:text-[#1D4ED8] p-0.5"
            title="Keyboard move alternative"
          >
            <MoveRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="text-[10px] text-slate-700 font-medium truncate mt-0.5">
        {classGroup?.name || "Class"} &bull; {room?.name || "Room"}
      </div>

      <div className="text-[9px] text-slate-500 truncate">
        {teacherProfile?.full_name || "Teacher"}
      </div>
    </div>
  )
}
