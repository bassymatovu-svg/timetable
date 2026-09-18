import React, { useState, useMemo } from "react"
import {
  Calendar,
  Clock,
  Building,
  Users,
  UserCheck,
  Plus,
  Search,
  Filter,
  FileSpreadsheet,
  Printer,
  Edit2,
  Trash2,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock3,
  Layers,
  GraduationCap,
  ClipboardCheck,
} from "lucide-react"
import * as XLSX from "xlsx"
import { useDataStore } from "@/stores/useDataStore"
import type { AssessmentSession, AssessmentType } from "@/types/database"
import { AddAssessmentDialog } from "./AddAssessmentDialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface AssessmentManagerProps {
  defaultType: AssessmentType
}

type ViewTab = "schedule" | "table" | "supervisors" | "rooms"

export function AssessmentManager({ defaultType }: AssessmentManagerProps) {
  const {
    currentInstitutionId,
    institutions,
    terms,
    rooms,
    subjects,
    teachers,
    profiles,
    classGroups,
    assessmentSessions,
    deleteAssessmentSession,
  } = useDataStore()

  const currentInstitution = institutions.find((i) => i.id === currentInstitutionId)
  const activeTerm = terms[0]

  const instRooms = rooms.filter((r) => r.institution_id === currentInstitutionId)
  const instSubjects = subjects.filter((s) => s.institution_id === currentInstitutionId)
  const instTeachers = teachers.filter((t) => t.institution_id === currentInstitutionId)
  const instClasses = classGroups.filter((c) => c.institution_id === currentInstitutionId)

  // Current tab mode
  const [activeTab, setActiveTab] = useState<ViewTab>("schedule")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [sessionToEdit, setSessionToEdit] = useState<AssessmentSession | null>(null)

  // Filters
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedSubjectId, setSelectedSubjectId] = useState("all")
  const [selectedClassId, setSelectedClassId] = useState("all")
  const [selectedStatus, setSelectedStatus] = useState("all")

  // Filter assessment sessions for the current institution and matching type (exam / test)
  const filteredSessions = useMemo(() => {
    return assessmentSessions.filter((s) => {
      if (s.institution_id !== currentInstitutionId) return false
      if (s.type !== defaultType) return false

      if (selectedSubjectId !== "all" && s.subject_id !== selectedSubjectId) return false
      if (selectedClassId !== "all" && !s.class_group_ids.includes(selectedClassId)) return false
      if (selectedStatus !== "all" && s.status !== selectedStatus) return false

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const subj = instSubjects.find((sub) => sub.id === s.subject_id)
        const matchesTitle = s.title.toLowerCase().includes(q)
        const matchesSubj = subj?.name.toLowerCase().includes(q) || subj?.code.toLowerCase().includes(q)
        const matchesDate = s.date.includes(q)

        const matchesRoom = s.room_ids.some((rid) => {
          const rm = instRooms.find((r) => r.id === rid)
          return rm?.name.toLowerCase().includes(q)
        })

        const matchesSupervisor = s.supervisor_ids.some((sid) => {
          const prof = profiles.find((p) => p.id === sid)
          return prof?.full_name.toLowerCase().includes(q)
        })

        if (!matchesTitle && !matchesSubj && !matchesDate && !matchesRoom && !matchesSupervisor) {
          return false
        }
      }

      return true
    })
  }, [
    assessmentSessions,
    currentInstitutionId,
    defaultType,
    selectedSubjectId,
    selectedClassId,
    selectedStatus,
    searchQuery,
    instSubjects,
    instRooms,
    profiles,
  ])

  // Sort sessions chronologically (date, start_time)
  const sortedSessions = useMemo(() => {
    return [...filteredSessions].sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date)
      if (dateCompare !== 0) return dateCompare
      return a.start_time.localeCompare(b.start_time)
    })
  }, [filteredSessions])

  // Group by Date for the "Schedule" card view
  const sessionsByDate = useMemo(() => {
    const map = new Map<string, AssessmentSession[]>()
    for (const session of sortedSessions) {
      const list = map.get(session.date) || []
      list.push(session)
      map.set(session.date, list)
    }
    return Array.from(map.entries())
  }, [sortedSessions])

  // Stats calculation
  const totalDurationMinutes = useMemo(() => {
    return sortedSessions.reduce((sum, s) => sum + s.duration_minutes, 0)
  }, [sortedSessions])

  const totalUniqueStudentsCount = useMemo(() => {
    const classIds = new Set<string>()
    sortedSessions.forEach((s) => s.class_group_ids.forEach((cid) => classIds.add(cid)))
    return Array.from(classIds).reduce((sum, cid) => {
      const cg = instClasses.find((c) => c.id === cid)
      return sum + (cg?.size || 0)
    }, 0)
  }, [sortedSessions, instClasses])

  // Export to Excel
  const handleExportExcel = () => {
    const rows = sortedSessions.map((s, idx) => {
      const subj = instSubjects.find((sub) => sub.id === s.subject_id)
      const classNames = s.class_group_ids
        .map((cid) => instClasses.find((c) => c.id === cid)?.name)
        .filter(Boolean)
        .join(", ")
      const roomNames = s.room_ids
        .map((rid) => instRooms.find((r) => r.id === rid)?.name)
        .filter(Boolean)
        .join(", ")
      const supervisorNames = s.supervisor_ids
        .map((sid) => {
          const prof = profiles.find((p) => p.id === sid)
          const isChief = s.chief_supervisor_id === sid
          return `${prof?.full_name || sid}${isChief ? " (Chief)" : ""}`
        })
        .filter(Boolean)
        .join(", ")

      return {
        "#": idx + 1,
        Type: s.type.toUpperCase(),
        Date: s.date,
        "Start Time": s.start_time,
        "End Time": s.end_time,
        "Duration (Mins)": s.duration_minutes,
        "Assessment Title": s.title,
        Subject: `${subj?.name || ""} (${subj?.code || ""})`,
        "Classes / Cohorts": classNames,
        "Booked Rooms": roomNames,
        "Supervisors / Invigilators": supervisorNames,
        Status: s.status.toUpperCase(),
        Instructions: s.instructions || "",
      }
    })

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows)
    XLSX.utils.book_append_sheet(
      wb,
      ws,
      defaultType === "exam" ? "Exam Timetable" : "Test Timetable"
    )
    XLSX.writeFile(
      wb,
      `${currentInstitution?.name || "Institution"}_${defaultType}_timetable_${
        new Date().toISOString().substring(0, 10)
      }.xlsx`
    )
  }

  // Print view
  const handlePrint = () => {
    window.print()
  }

  const handleDelete = (id: string, title: string) => {
    if (window.confirm(`Are you sure you want to delete "${title}"?`)) {
      deleteAssessmentSession(id)
    }
  }

  const isExam = defaultType === "exam"

  return (
    <div className="space-y-6">
      {/* Top Banner & Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            {isExam ? (
              <GraduationCap className="w-6 h-6 text-blue-700" />
            ) : (
              <ClipboardCheck className="w-6 h-6 text-indigo-700" />
            )}
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              {isExam ? "Exam Timetable & Room Booking" : "Test Timetable & Continuous Assessment"}
            </h2>
            <Badge
              variant={isExam ? "default" : "secondary"}
              className="text-xs uppercase font-semibold tracking-wider"
            >
              {isExam ? "Summative Finals & Midterms" : "Formative & Unit Tests"}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {isExam
              ? "Comprehensive examination scheduling with duration controls, multi-room reservations, and invigilation rosters."
              : "Periodic class tests and quizzes with duration settings, lab allocations, and supervising teacher assignments."}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 no-print">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            className="h-8 text-xs gap-1.5 text-slate-700 border-slate-300 hover:bg-slate-50"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Excel Export</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="h-8 text-xs gap-1.5 text-slate-700 border-slate-300 hover:bg-slate-50"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            <span>Print Timetable</span>
          </Button>

          <Button
            size="sm"
            onClick={() => {
              setSessionToEdit(null)
              setIsDialogOpen(true)
            }}
            className="h-8 text-xs gap-1.5 bg-[#1D4ED8] hover:bg-blue-700 text-white font-semibold shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isExam ? "Schedule New Exam" : "Schedule New Test"}</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 no-print">
        <Card className="bg-white border-slate-200">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                {isExam ? "Total Exams" : "Total Tests"}
              </p>
              <h3 className="text-xl font-bold text-slate-900 mt-0.5">
                {sortedSessions.length}
              </h3>
            </div>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#1D4ED8] flex items-center justify-center">
              {isExam ? <GraduationCap className="w-4 h-4" /> : <ClipboardCheck className="w-4 h-4" />}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                Total Assessment Time
              </p>
              <h3 className="text-xl font-bold text-slate-900 mt-0.5">
                {Math.floor(totalDurationMinutes / 60)}h {totalDurationMinutes % 60}m
              </h3>
            </div>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
              <Clock3 className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                Students Sitting
              </p>
              <h3 className="text-xl font-bold text-slate-900 mt-0.5">
                {totalUniqueStudentsCount}
              </h3>
            </div>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                Active Term
              </p>
              <h3 className="text-xs font-bold text-slate-900 mt-1 truncate max-w-[140px]">
                {activeTerm?.name || "Fall Semester 2026"}
              </h3>
            </div>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Control Bar: Tabs & Filters */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-3 no-print">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* View Mode Tabs */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            <button
              onClick={() => setActiveTab("schedule")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "schedule"
                  ? "bg-white text-[#1D4ED8] shadow-2xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Date Timeline</span>
            </button>
            <button
              onClick={() => setActiveTab("table")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "table"
                  ? "bg-white text-[#1D4ED8] shadow-2xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Master Grid Table</span>
            </button>
            <button
              onClick={() => setActiveTab("supervisors")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "supervisors"
                  ? "bg-white text-[#1D4ED8] shadow-2xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Supervisor Duty Roster</span>
            </button>
            <button
              onClick={() => setActiveTab("rooms")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "rooms"
                  ? "bg-white text-[#1D4ED8] shadow-2xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Building className="w-3.5 h-3.5" />
              <span>Room Bookings</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search assessments, subjects..."
              className="h-8 pl-8 text-xs bg-slate-50 border-slate-200"
            />
          </div>
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 mr-1">
            <Filter className="w-3 h-3" />
            <span>Filter By:</span>
          </div>

          <select
            value={selectedSubjectId}
            onChange={(e) => setSelectedSubjectId(e.target.value)}
            className="h-7 px-2 text-xs rounded border border-slate-200 bg-white text-slate-700"
          >
            <option value="all">All Subjects</option>
            {instSubjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.code})
              </option>
            ))}
          </select>

          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="h-7 px-2 text-xs rounded border border-slate-200 bg-white text-slate-700"
          >
            <option value="all">All Class Cohorts</option>
            {instClasses.map((cg) => (
              <option key={cg.id} value={cg.id}>
                {cg.name}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="h-7 px-2 text-xs rounded border border-slate-200 bg-white text-slate-700"
          >
            <option value="all">All Statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="draft">Draft</option>
            <option value="completed">Completed</option>
          </select>

          {(selectedSubjectId !== "all" ||
            selectedClassId !== "all" ||
            selectedStatus !== "all" ||
            searchQuery) && (
            <button
              onClick={() => {
                setSelectedSubjectId("all")
                setSelectedClassId("all")
                setSelectedStatus("all")
                setSearchQuery("")
              }}
              className="text-[11px] text-blue-600 hover:underline cursor-pointer ml-auto"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Main View Display */}

      {/* View 1: Date-Grouped Timeline Cards */}
      {activeTab === "schedule" && (
        <div className="space-y-6">
          {sessionsByDate.length === 0 ? (
            <div className="p-12 text-center bg-white border border-slate-200 rounded-lg">
              <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-700">No assessment sessions found</p>
              <p className="text-xs text-slate-400 mt-1">
                Click "{isExam ? "Schedule New Exam" : "Schedule New Test"}" to create the first
                session.
              </p>
            </div>
          ) : (
            sessionsByDate.map(([dateString, sessions]) => {
              const dateObj = new Date(`${dateString}T00:00:00`)
              const formattedDate = dateObj.toLocaleDateString("en-US", {
                weekday: "long",
                month: "short",
                day: "numeric",
                year: "numeric",
              })

              return (
                <div key={dateString} className="space-y-3">
                  <div className="flex items-center gap-2 border-b border-slate-200 pb-1.5">
                    <Calendar className="w-4 h-4 text-[#1D4ED8]" />
                    <h3 className="text-sm font-bold text-slate-900">{formattedDate}</h3>
                    <Badge variant="secondary" className="text-[10px] font-normal py-0">
                      {sessions.length} {sessions.length === 1 ? "session" : "sessions"}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {sessions.map((session) => {
                      const subj = instSubjects.find((s) => s.id === session.subject_id)
                      const bookedRooms = session.room_ids.map((rid) =>
                        instRooms.find((r) => r.id === rid)
                      )
                      const assignedSupervisors = session.supervisor_ids.map((sid) =>
                        profiles.find((p) => p.id === sid)
                      )
                      const classesTaking = session.class_group_ids.map((cid) =>
                        instClasses.find((c) => c.id === cid)
                      )
                      const totalStudents = classesTaking.reduce(
                        (sum, c) => sum + (c?.size || 0),
                        0
                      )

                      return (
                        <Card
                          key={session.id}
                          className="border-slate-200 hover:border-slate-300 transition-shadow bg-white shadow-2xs"
                        >
                          <CardContent className="p-4 space-y-3">
                            {/* Card Header: Subject Tag, Duration, Status, Actions */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className="px-2 py-0.5 rounded text-[11px] font-bold text-white tracking-wide"
                                  style={{ backgroundColor: subj?.color || "#1E40AF" }}
                                >
                                  {subj?.code || "SUBJ"}
                                </span>
                                <Badge
                                  variant="outline"
                                  className="text-[10px] bg-blue-50 border-blue-200 text-blue-700 font-semibold"
                                >
                                  {session.duration_minutes} mins
                                </Badge>
                                <Badge
                                  variant={
                                    session.status === "scheduled" ? "success" : "secondary"
                                  }
                                  className="text-[10px] py-0 capitalize"
                                >
                                  {session.status}
                                </Badge>
                              </div>

                              <div className="flex items-center gap-1 no-print">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSessionToEdit(session)
                                    setIsDialogOpen(true)
                                  }}
                                  className="h-7 w-7 p-0 text-slate-500 hover:text-slate-800 cursor-pointer"
                                  title="Edit"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(session.id, session.title)}
                                  className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                                  title="Delete"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>

                            {/* Title */}
                            <div>
                              <h4 className="text-sm font-bold text-slate-900 leading-tight">
                                {session.title}
                              </h4>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                {subj?.name || "Subject"}
                              </p>
                            </div>

                            {/* Details Grid */}
                            <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100">
                              {/* Timing */}
                              <div className="flex items-center gap-2 text-slate-700">
                                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span>
                                  {session.start_time} - {session.end_time}
                                </span>
                              </div>

                              {/* Classes & Headcount */}
                              <div className="flex items-center gap-2 text-slate-700">
                                <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="truncate">
                                  {classesTaking.map((c) => c?.name).join(", ")} ({totalStudents} std)
                                </span>
                              </div>

                              {/* Booked Rooms */}
                              <div className="flex items-center gap-2 text-slate-700 col-span-2">
                                <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="font-medium text-slate-800">
                                  {bookedRooms.map((r) => r?.name).join(", ")}
                                </span>
                              </div>

                              {/* Supervisors / Invigilators */}
                              <div className="flex items-center gap-2 text-slate-700 col-span-2">
                                <UserCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {assignedSupervisors.map((p, i) => {
                                    const isChief = session.chief_supervisor_id === p?.id
                                    return (
                                      <span
                                        key={i}
                                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] ${
                                          isChief
                                            ? "bg-emerald-100 text-emerald-900 font-semibold"
                                            : "bg-slate-100 text-slate-700"
                                        }`}
                                      >
                                        {isChief && <ShieldCheck className="w-3 h-3 text-emerald-700" />}
                                        {p?.full_name || "Faculty"}
                                      </span>
                                    )
                                  })}
                                </div>
                              </div>
                            </div>

                            {/* Instructions / Notes */}
                            {session.instructions && (
                              <div className="p-2 bg-slate-50 border border-slate-200 rounded text-[11px] text-slate-600">
                                <span className="font-semibold text-slate-700">Note: </span>
                                {session.instructions}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* View 2: Master Tabular Grid */}
      {activeTab === "table" && (
        <Card className="bg-white border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 text-[11px]">
                  <TableHead className="w-24">Date</TableHead>
                  <TableHead className="w-28">Time & Duration</TableHead>
                  <TableHead className="min-w-[180px]">Title & Subject</TableHead>
                  <TableHead>Class Cohorts</TableHead>
                  <TableHead>Booked Rooms</TableHead>
                  <TableHead>Supervisors (Invigilators)</TableHead>
                  <TableHead className="w-20">Status</TableHead>
                  <TableHead className="w-16 text-right no-print">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-xs">
                {sortedSessions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-slate-400">
                      No matching records found
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedSessions.map((session) => {
                    const subj = instSubjects.find((s) => s.id === session.subject_id)
                    const bookedRooms = session.room_ids
                      .map((rid) => instRooms.find((r) => r.id === rid)?.name)
                      .filter(Boolean)
                    const supervisors = session.supervisor_ids.map((sid) => {
                      const prof = profiles.find((p) => p.id === sid)
                      const isChief = session.chief_supervisor_id === sid
                      return { name: prof?.full_name || sid, isChief }
                    })
                    const classes = session.class_group_ids
                      .map((cid) => instClasses.find((c) => c.id === cid)?.name)
                      .filter(Boolean)

                    return (
                      <TableRow key={session.id} className="hover:bg-slate-50/80">
                        <TableCell className="font-semibold text-slate-800 whitespace-nowrap">
                          {session.date}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <div className="font-medium text-slate-900">
                            {session.start_time} - {session.end_time}
                          </div>
                          <span className="text-[10px] text-blue-700 font-medium">
                            {session.duration_minutes} mins
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="font-bold text-slate-900">{session.title}</div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                            <span
                              className="w-2 h-2 rounded-full inline-block"
                              style={{ backgroundColor: subj?.color || "#1E40AF" }}
                            />
                            {subj?.name} ({subj?.code})
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-slate-800">{classes.join(", ")}</div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-slate-800">{bookedRooms.join(", ")}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            {supervisors.map((sup, idx) => (
                              <span
                                key={idx}
                                className={`text-[11px] ${
                                  sup.isChief ? "font-bold text-emerald-800" : "text-slate-700"
                                }`}
                              >
                                {sup.name} {sup.isChief && "(Chief)"}
                              </span>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={session.status === "scheduled" ? "success" : "secondary"}
                            className="text-[10px] py-0 capitalize"
                          >
                            {session.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right no-print">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSessionToEdit(session)
                                setIsDialogOpen(true)
                              }}
                              className="h-6 w-6 p-0 text-slate-500 hover:text-slate-800"
                            >
                              <Edit2 className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(session.id, session.title)}
                              className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* View 3: Supervisor Duty Roster */}
      {activeTab === "supervisors" && (
        <div className="space-y-4">
          <div className="p-3 bg-blue-50/50 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-center justify-between">
            <span className="font-medium">
              Faculty Invigilation & Supervision Duty Roster for {isExam ? "Exams" : "Tests"}.
            </span>
            <Badge variant="outline" className="text-[10px] bg-white border-blue-300">
              {instTeachers.length} Available Faculty
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {instTeachers.map((teacher) => {
              const prof = profiles.find((p) => p.id === teacher.id)
              const duties = sortedSessions.filter((s) => s.supervisor_ids.includes(teacher.id))
              const totalDutyMinutes = duties.reduce((sum, d) => sum + d.duration_minutes, 0)

              return (
                <Card key={teacher.id} className="border-slate-200 bg-white">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">{prof?.full_name}</h4>
                        <p className="text-[11px] text-slate-400">{prof?.email}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-slate-800">
                          {Math.floor(totalDutyMinutes / 60)}h {totalDutyMinutes % 60}m
                        </span>
                        <p className="text-[10px] text-slate-400">Total Duty Time</p>
                      </div>
                    </div>

                    {duties.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-2">No duties assigned</p>
                    ) : (
                      <div className="space-y-1.5">
                        {duties.map((duty) => {
                          const isChief = duty.chief_supervisor_id === teacher.id
                          const rooms = duty.room_ids
                            .map((rid) => instRooms.find((r) => r.id === rid)?.name)
                            .join(", ")

                          return (
                            <div
                              key={duty.id}
                              className="p-2 rounded bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                            >
                              <div>
                                <span className="font-semibold text-slate-800">{duty.title}</span>
                                <div className="text-[10px] text-slate-500 mt-0.5">
                                  {duty.date} | {duty.start_time} - {duty.end_time} | {rooms}
                                </div>
                              </div>
                              {isChief && (
                                <Badge className="bg-emerald-100 text-emerald-800 text-[10px] border-emerald-200 py-0">
                                  Chief Invigilator
                                </Badge>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* View 4: Room Bookings Grid */}
      {activeTab === "rooms" && (
        <div className="space-y-4">
          <div className="p-3 bg-indigo-50/50 border border-indigo-200 rounded-lg text-xs text-indigo-900 flex items-center justify-between">
            <span className="font-medium">
              Facility Utilization & Assessment Room Booking Overview.
            </span>
            <Badge variant="outline" className="text-[10px] bg-white border-indigo-300">
              {instRooms.length} Total Facilities
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {instRooms.map((room) => {
              const bookings = sortedSessions.filter((s) => s.room_ids.includes(room.id))

              return (
                <Card key={room.id} className="border-slate-200 bg-white">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">{room.name}</h4>
                        <p className="text-[11px] text-slate-400 capitalize">
                          {room.room_type} | Capacity: {room.capacity} seats
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-xs font-semibold">
                        {bookings.length} {bookings.length === 1 ? "booking" : "bookings"}
                      </Badge>
                    </div>

                    {bookings.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-2">
                        No assessment bookings for this facility
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {bookings.map((b) => (
                          <div
                            key={b.id}
                            className="p-2 rounded bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                          >
                            <div>
                              <span className="font-semibold text-slate-800">{b.title}</span>
                              <div className="text-[10px] text-slate-500 mt-0.5">
                                {b.date} | {b.start_time} - {b.end_time} ({b.duration_minutes}m)
                              </div>
                            </div>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-medium">
                              Reserved
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Dialog for Scheduling / Editing */}
      <AddAssessmentDialog
        open={isDialogOpen}
        onClose={() => {
          setIsDialogOpen(false)
          setSessionToEdit(null)
        }}
        initialType={defaultType}
        sessionToEdit={sessionToEdit}
      />
    </div>
  )
}
