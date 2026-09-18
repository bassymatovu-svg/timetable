import React, { useState } from "react"
import { Printer, Calendar, User, Users, Building, Download } from "lucide-react"
import { useDataStore } from "@/stores/useDataStore"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]

export function IndividualTimetableView() {
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
    lessons,
  } = useDataStore()

  const currentInstitution = institutions.find((i) => i.id === currentInstitutionId)
  const activeTerm = terms[0]

  const instPeriods = periods.filter((p) => p.institution_id === currentInstitutionId)
  const instTeachers = teachers.filter((t) => t.institution_id === currentInstitutionId)
  const instClasses = classGroups.filter((c) => c.institution_id === currentInstitutionId)
  const instRooms = rooms.filter((r) => r.institution_id === currentInstitutionId)

  const [viewType, setViewType] = useState<"teacher" | "class" | "room">("teacher")
  const [selectedEntityId, setSelectedEntityId] = useState<string>(instTeachers[0]?.id || "")

  const periodNumbers = Array.from(new Set(instPeriods.map((p) => p.period_number))).sort(
    (a, b) => a - b
  )

  // Filter lessons for selected individual
  const entityLessons = lessons.filter((l) => {
    if (viewType === "teacher") return l.teacher_id === selectedEntityId
    if (viewType === "class") return l.class_group_id === selectedEntityId
    if (viewType === "room") return l.room_id === selectedEntityId
    return false
  })

  // Entity Title
  let entityTitle = ""
  let entitySubtitle = ""
  if (viewType === "teacher") {
    const prof = profiles.find((p) => p.id === selectedEntityId)
    entityTitle = prof?.full_name || "Faculty Schedule"
    entitySubtitle = `Email: ${prof?.email || "—"} | Teaching Load: ${entityLessons.length} periods/week`
  } else if (viewType === "class") {
    const cg = instClasses.find((c) => c.id === selectedEntityId)
    entityTitle = cg?.name || "Class Schedule"
    entitySubtitle = `Year ${cg?.year_level || "-"} | Class Roll: ${cg?.size || 0} students`
  } else {
    const rm = instRooms.find((r) => r.id === selectedEntityId)
    entityTitle = rm?.name || "Facility Schedule"
    entitySubtitle = `Classification: ${rm?.room_type} | Seating Capacity: ${rm?.capacity}`
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="space-y-6">
      {/* Control Bar (Hidden in Print) */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-white border border-slate-200 rounded-lg no-print">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 mr-1">Target View:</span>
          <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5">
            <button
              onClick={() => {
                setViewType("teacher")
                setSelectedEntityId(instTeachers[0]?.id || "")
              }}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors cursor-pointer flex items-center gap-1.5 ${
                viewType === "teacher"
                  ? "bg-white text-[#1D4ED8] shadow-2xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <User className="w-3.5 h-3.5" />
              Teacher
            </button>
            <button
              onClick={() => {
                setViewType("class")
                setSelectedEntityId(instClasses[0]?.id || "")
              }}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors cursor-pointer flex items-center gap-1.5 ${
                viewType === "class"
                  ? "bg-white text-[#1D4ED8] shadow-2xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Class Group
            </button>
            <button
              onClick={() => {
                setViewType("room")
                setSelectedEntityId(instRooms[0]?.id || "")
              }}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors cursor-pointer flex items-center gap-1.5 ${
                viewType === "room"
                  ? "bg-white text-[#1D4ED8] shadow-2xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Building className="w-3.5 h-3.5" />
              Room
            </button>
          </div>

          <select
            className="h-8 rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800 shadow-2xs cursor-pointer min-w-52"
            value={selectedEntityId}
            onChange={(e) => setSelectedEntityId(e.target.value)}
          >
            {viewType === "teacher" &&
              instTeachers.map((t) => {
                const p = profiles.find((prof) => prof.id === t.id)
                return (
                  <option key={t.id} value={t.id}>
                    {p?.full_name || t.id}
                  </option>
                )
              })}
            {viewType === "class" &&
              instClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} (Year {c.year_level || "-"})
                </option>
              ))}
            {viewType === "room" &&
              instRooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.room_type})
                </option>
              ))}
          </select>
        </div>

        <Button
          size="sm"
          onClick={handlePrint}
          className="gap-1.5 text-xs bg-slate-900 text-white hover:bg-slate-800"
        >
          <Printer className="w-3.5 h-3.5" />
          Print Timetable
        </Button>
      </div>

      {/* Printable Timetable Document */}
      <div className="bg-white border border-slate-300 rounded-lg p-6 shadow-xs print:p-0 print:border-none print:shadow-none">
        {/* Print Header */}
        <div className="border-b border-slate-300 pb-4 mb-4 flex justify-between items-start">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#1D4ED8]">
              {currentInstitution?.name || "Institution Timetable"}
            </span>
            <h2 className="text-xl font-bold text-slate-900 mt-0.5">{entityTitle}</h2>
            <p className="text-xs text-slate-500">{entitySubtitle}</p>
          </div>
          <div className="text-right">
            <span className="text-xs font-semibold text-slate-800 block">
              {activeTerm?.name || "Academic Schedule"}
            </span>
            <span className="text-[11px] text-slate-400 block font-mono">
              Generated {new Date().toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Timetable Grid */}
        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full border-collapse timetable-grid-print">
            <thead>
              <tr className="bg-slate-100/90 border border-slate-300">
                <th className="p-2.5 border border-slate-300 text-left text-xs font-semibold text-slate-700 w-28">
                  Day / Period
                </th>
                {periodNumbers.map((pNum) => {
                  const sampleP = instPeriods.find((p) => p.period_number === pNum)
                  return (
                    <th
                      key={pNum}
                      className={`p-2 border border-slate-300 text-center text-xs font-semibold ${
                        sampleP?.is_break ? "bg-slate-200/50 text-slate-500" : "text-slate-800"
                      }`}
                    >
                      <div>P{pNum}</div>
                      <div className="text-[10px] font-normal text-slate-500">
                        {sampleP?.start_time.substring(0, 5)} - {sampleP?.end_time.substring(0, 5)}
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5].map((dayIdx) => (
                <tr key={dayIdx}>
                  <td className="p-2.5 border border-slate-300 bg-slate-50 font-semibold text-xs text-slate-800">
                    {DAY_NAMES[dayIdx - 1]}
                  </td>
                  {periodNumbers.map((pNum) => {
                    const period = instPeriods.find(
                      (p) => p.day_of_week === dayIdx && p.period_number === pNum
                    )
                    if (!period) return <td key={pNum} className="border border-slate-300" />

                    if (period.is_break) {
                      return (
                        <td
                          key={pNum}
                          className="p-1 border border-slate-300 bg-slate-100 text-center text-[10px] text-slate-400 font-medium"
                        >
                          Break
                        </td>
                      )
                    }

                    const lesson = entityLessons.find((l) => l.period_id === period.id)

                    if (!lesson) {
                      return (
                        <td
                          key={pNum}
                          className="p-1 border border-slate-300 bg-white text-center text-[10px] text-slate-300"
                        >
                          —
                        </td>
                      )
                    }

                    const subj = subjects.find((s) => s.id === lesson.subject_id)
                    const teach = profiles.find((p) => p.id === lesson.teacher_id)
                    const cg = classGroups.find((c) => c.id === lesson.class_group_id)
                    const rm = rooms.find((r) => r.id === lesson.room_id)

                    return (
                      <td
                        key={pNum}
                        className="p-2 border border-slate-300 bg-white text-left align-top"
                        style={{
                          borderLeft: `4px solid ${subj?.color || "#1D4ED8"}`,
                        }}
                      >
                        <div className="font-bold text-xs text-slate-900">
                          {subj?.name} ({subj?.code})
                        </div>
                        {viewType !== "class" && (
                          <div className="text-[11px] text-slate-700 font-medium mt-0.5">
                            {cg?.name}
                          </div>
                        )}
                        {viewType !== "room" && (
                          <div className="text-[10px] text-slate-500">
                            Room: {rm?.name}
                          </div>
                        )}
                        {viewType !== "teacher" && (
                          <div className="text-[10px] text-slate-500">
                            {teach?.full_name}
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
