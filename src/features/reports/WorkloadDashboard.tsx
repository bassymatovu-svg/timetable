import React, { useState } from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"
import {
  FileSpreadsheet,
  Calendar,
  Printer,
  Download,
  BarChart3,
  Building,
  GraduationCap,
  Users,
} from "lucide-react"
import { useDataStore } from "@/stores/useDataStore"
import { exportTimetableToExcel } from "@/lib/export/excel-exporter"
import { generateIcsCalendar, downloadIcsFile } from "@/lib/export/ics-generator"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export function WorkloadDashboard() {
  const {
    currentInstitutionId,
    institutions,
    teachers,
    profiles,
    rooms,
    subjects,
    classGroups,
    periods,
    lessons,
  } = useDataStore()

  const currentInstitution = institutions.find((i) => i.id === currentInstitutionId)
  const instTeachers = teachers.filter((t) => t.institution_id === currentInstitutionId)
  const instRooms = rooms.filter((r) => r.institution_id === currentInstitutionId)
  const instPeriods = periods.filter((p) => p.institution_id === currentInstitutionId)
  const instSubjects = subjects.filter((s) => s.institution_id === currentInstitutionId)
  const instClasses = classGroups.filter((c) => c.institution_id === currentInstitutionId)

  const [selectedIcsTeacherId, setSelectedIcsTeacherId] = useState<string>(instTeachers[0]?.id || "")

  // 1. Prepare Teacher Workload Data for Recharts
  const teacherWorkloadData = instTeachers.map((t) => {
    const prof = profiles.find((p) => p.id === t.id)
    const assignedCount = lessons.filter((l) => l.teacher_id === t.id).length
    const cap = t.max_periods_per_week
    const utilPct = cap > 0 ? Math.round((assignedCount / cap) * 100) : 0

    return {
      name: prof?.full_name.split(" ").slice(-1)[0] || t.id.substring(0, 6),
      fullName: prof?.full_name || t.id,
      assigned: assignedCount,
      limit: cap,
      utilization: utilPct,
    }
  })

  // 2. Prepare Room Utilization Data
  const instructionalPeriodsCount = instPeriods.filter((p) => !p.is_break).length
  const roomUtilizationData = instRooms.map((r) => {
    const bookedCount = lessons.filter((l) => l.room_id === r.id).length
    const utilPct =
      instructionalPeriodsCount > 0
        ? Math.round((bookedCount / instructionalPeriodsCount) * 100)
        : 0

    return {
      name: r.name.replace(/Room |Lab |Studio /, ""),
      fullName: r.name,
      booked: bookedCount,
      total: instructionalPeriodsCount,
      rate: utilPct,
      type: r.room_type,
    }
  })

  // Export handlers
  const handleExcelExport = () => {
    exportTimetableToExcel({
      lessons,
      periods: instPeriods,
      rooms: instRooms,
      subjects: instSubjects,
      teachers: instTeachers,
      profiles,
      classGroups: instClasses,
      institutionName: currentInstitution?.name || "Institution",
    })
  }

  const handleIcsExport = () => {
    const teacherLessons = lessons.filter((l) => l.teacher_id === selectedIcsTeacherId)
    const teacherProf = profiles.find((p) => p.id === selectedIcsTeacherId)
    const title = `${teacherProf?.full_name || "Teacher"} Schedule`

    const icsContent = generateIcsCalendar({
      lessons: teacherLessons,
      periods: instPeriods,
      subjects: instSubjects,
      rooms: instRooms,
      profiles,
      calendarTitle: title,
    })

    const filename = `${(teacherProf?.full_name || "schedule")
      .toLowerCase()
      .replace(/\s+/g, "_")}_schedule.ics`
    downloadIcsFile(filename, icsContent)
  }

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-white border border-slate-200 rounded-lg">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Institutional Analytics &amp; Export Center</h2>
          <p className="text-xs text-slate-500">
            Real-time workload metrics, facility density, and export to Excel (.xlsx) and Calendar (.ics).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleExcelExport}
            className="gap-1.5 text-xs border-slate-300 hover:bg-slate-50 text-slate-800"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
            Export Excel (.xlsx)
          </Button>

          <div className="flex items-center gap-1 border border-slate-300 rounded-md p-0.5 bg-white">
            <select
              className="h-7 text-xs border-0 bg-transparent px-2 text-slate-700 focus:outline-none"
              value={selectedIcsTeacherId}
              onChange={(e) => setSelectedIcsTeacherId(e.target.value)}
            >
              {instTeachers.map((t) => {
                const p = profiles.find((prof) => prof.id === t.id)
                return (
                  <option key={t.id} value={t.id}>
                    {p?.full_name} (.ics)
                  </option>
                )
              })}
            </select>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleIcsExport}
              className="h-7 px-2 text-xs gap-1 text-[#1D4ED8]"
            >
              <Calendar className="w-3 h-3" />
              Download
            </Button>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Total Timetabled Lessons</span>
            <Calendar className="w-4 h-4 text-[#1D4ED8]" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{lessons.length}</div>
          <span className="text-[11px] text-slate-400 mt-1 block">Scheduled across 5 weekdays</span>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Active Teaching Faculty</span>
            <GraduationCap className="w-4 h-4 text-[#1D4ED8]" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{instTeachers.length}</div>
          <span className="text-[11px] text-slate-400 mt-1 block">Instructors assigned to classes</span>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Instructional Facilities</span>
            <Building className="w-4 h-4 text-[#1D4ED8]" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{instRooms.length}</div>
          <span className="text-[11px] text-slate-400 mt-1 block">Classrooms, labs and workshops</span>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Student Cohorts</span>
            <Users className="w-4 h-4 text-[#1D4ED8]" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{instClasses.length}</div>
          <span className="text-[11px] text-slate-400 mt-1 block">Active class groups</span>
        </Card>
      </div>

      {/* Recharts Workload Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Faculty Workload Chart */}
        <Card>
          <CardHeader className="pb-2 border-b border-slate-100">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>Faculty Workload: Assigned Periods vs Weekly Cap</span>
              <Badge variant="outline" className="text-[10px]">Periods / Week</Badge>
            </CardTitle>
            <CardDescription className="text-xs">
              Monitors teacher contact hours to ensure equitable distribution and prevent overload.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-6">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={teacherWorkloadData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} domain={[0, 30]} />
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload
                        return (
                          <div className="bg-slate-900 text-white p-2 rounded text-xs shadow-md">
                            <div className="font-bold">{data.fullName}</div>
                            <div>Assigned: <strong>{data.assigned}</strong> periods/wk</div>
                            <div>Weekly Limit: <strong>{data.limit}</strong> periods</div>
                            <div>Load: <strong>{data.utilization}%</strong></div>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Bar dataKey="assigned" radius={[3, 3, 0, 0]}>
                    {teacherWorkloadData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.utilization > 95 ? "#dc2626" : "#1D4ED8"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Room Utilization Rate Chart */}
        <Card>
          <CardHeader className="pb-2 border-b border-slate-100">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>Spatial Facility Utilization Rate</span>
              <Badge variant="outline" className="text-[10px]">% Capacity</Badge>
            </CardTitle>
            <CardDescription className="text-xs">
              Percentage of weekly instructional slots booked by classes.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-6">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={roomUtilizationData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} domain={[0, 100]} />
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload
                        return (
                          <div className="bg-slate-900 text-white p-2 rounded text-xs shadow-md">
                            <div className="font-bold">{data.fullName}</div>
                            <div>Type: {data.type}</div>
                            <div>Booked Slots: <strong>{data.booked}</strong> / {data.total}</div>
                            <div>Utilization: <strong>{data.rate}%</strong></div>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Bar dataKey="rate" fill="#0891b2" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
