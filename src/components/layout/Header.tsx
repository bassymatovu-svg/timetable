import React from "react"
import { Database, RotateCcw } from "lucide-react"
import { RoleSwitcher } from "./RoleSwitcher"
import { useDataStore } from "@/stores/useDataStore"
import { isSupabaseConfigured } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { NavView } from "./Sidebar"

interface HeaderProps {
  currentView: NavView
}

const VIEW_TITLES: Record<NavView, { title: string; subtitle: string }> = {
  dashboard: { title: "Operations Dashboard", subtitle: "High-level overview of scheduling health & substitutions" },
  master_grid: { title: "Master Timetable Grid", subtitle: "Interactive drag-and-drop grid with real-time constraint validation" },
  exam_timetable: { title: "Exam Timetable & Room Booking", subtitle: "Summative exam scheduling, room capacity verification, and supervisor duty assignments" },
  test_timetable: { title: "Test Timetable & Continuous Assessment", subtitle: "Periodic tests, quizzes, duration settings, and supervising teacher allocations" },
  generator: { title: "Algorithmic Timetable Generator", subtitle: "Deterministic constraint-satisfaction and local search engine" },
  individual_views: { title: "Personal & Class Timetables", subtitle: "Teacher, class group, and room-specific weekly schedules" },
  substitutions: { title: "Teacher Substitution Management", subtitle: "Absence logging and intelligent substitute ranking" },
  smart_import: { title: "Smart Import & Timetable Migration", subtitle: "AI-assisted extraction from spreadsheets and legacy schedules" },
  curriculum: { title: "Curriculum Requirements Matrix", subtitle: "Weekly period allotments, teacher assignments, and double periods" },
  constraints: { title: "Constraint Rules & Penalties", subtitle: "Configure hard constraint rules and soft penalty weights" },
  setup_terms: { title: "Academic Terms & Cycles", subtitle: "Manage academic terms and weekly cycle types" },
  setup_periods: { title: "Period Structure Builder", subtitle: "Define daily time slots, intervals, and designated breaks" },
  setup_rooms: { title: "Rooms & Specialized Facilities", subtitle: "Classrooms, laboratories, workshops, and student capacities" },
  setup_subjects: { title: "Subjects & Academic Disciplines", subtitle: "Curriculum codes, color keys, and room type requirements" },
  setup_teachers: { title: "Teachers & Unavailability Matrix", subtitle: "Faculty profiles, load limits, and unavailable periods" },
  setup_classes: { title: "Class Groups & Cohorts", subtitle: "Grade levels, cohorts, and student roll counts" },
  reports: { title: "Analytics, Workload & Exports", subtitle: "Teacher loads, facility utilization, Excel, ICS and print exports" },
  institutions_mgmt: { title: "Tenant & Institution Management", subtitle: "Multi-tenant administration and campus configurations" },
  audit_logs: { title: "Audit Trail & Activity Log", subtitle: "Tamper-evident record of scheduling adjustments and assignments" },
}

export function Header({ currentView }: HeaderProps) {
  const { terms, resetToDefaultSeed } = useDataStore()
  const activeTerm = terms[0]
  const viewInfo = VIEW_TITLES[currentView] || { title: "TimetableOS", subtitle: "" }

  const handleReset = () => {
    if (window.confirm("Reset demo data to initial seed? (This clears custom modifications)")) {
      resetToDefaultSeed()
    }
  }

  return (
    <header className="h-14 border-b border-slate-200 bg-white px-6 flex items-center justify-between shrink-0 no-print">
      <div className="flex flex-col">
        <h1 className="text-sm font-semibold text-slate-900 leading-tight">
          {viewInfo.title}
        </h1>
        <p className="text-[11px] text-slate-500 hidden sm:block">
          {viewInfo.subtitle}
        </p>
      </div>

      <div className="flex items-center gap-3">
        {/* Active Term indicator */}
        {activeTerm && (
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200 text-xs text-slate-700">
            <span className="text-slate-400">Term:</span>
            <span className="font-medium text-slate-800">{activeTerm.name}</span>
          </div>
        )}

        {/* Database mode badge */}
        <Badge
          variant={isSupabaseConfigured ? "success" : "secondary"}
          className="text-[10px] py-0 px-2 font-normal hidden lg:flex items-center gap-1"
        >
          <Database className="w-2.5 h-2.5" />
          {isSupabaseConfigured ? "TimetableOS Cloud" : "TimetableOS Local"}
        </Badge>

        {/* Role Switcher */}
        <RoleSwitcher />

        {/* Reset Demo Data Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleReset}
          className="h-7 text-[11px] px-2 text-slate-600 border-slate-200 hover:bg-slate-50"
          title="Reset sample data"
        >
          <RotateCcw className="w-3 h-3 mr-1 text-slate-400" />
          <span className="hidden sm:inline">Reset Seed</span>
        </Button>
      </div>
    </header>
  )
}
