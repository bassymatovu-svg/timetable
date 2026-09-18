import React from "react"
import {
  Calendar,
  Grid3X3,
  Users,
  Building,
  BookOpen,
  Sliders,
  Play,
  UserX,
  UploadCloud,
  BarChart3,
  Settings,
  History,
  Clock,
  Layers,
  GraduationCap,
  ClipboardCheck,
} from "lucide-react"
import { InstitutionSwitcher } from "./InstitutionSwitcher"
import { useDataStore } from "@/stores/useDataStore"

export type NavView =
  | "dashboard"
  | "master_grid"
  | "exam_timetable"
  | "test_timetable"
  | "generator"
  | "individual_views"
  | "substitutions"
  | "smart_import"
  | "curriculum"
  | "constraints"
  | "setup_terms"
  | "setup_periods"
  | "setup_rooms"
  | "setup_subjects"
  | "setup_teachers"
  | "setup_classes"
  | "reports"
  | "institutions_mgmt"
  | "audit_logs"

interface SidebarProps {
  currentView: NavView
  onSelectView: (view: NavView) => void
}

export function Sidebar({ currentView, onSelectView }: SidebarProps) {
  const { currentProfile } = useDataStore()
  const role = currentProfile.role
  const isViewer = role === "viewer"
  const isTeacher = role === "teacher"
  const isSuperAdmin = role === "super_admin"

  const navSections = [
    {
      title: "Timetable & Ops",
      items: [
        { id: "master_grid" as NavView, label: "Master Grid", icon: Grid3X3, visible: true },
        { id: "individual_views" as NavView, label: "Personal & Class Views", icon: Calendar, visible: true },
        { id: "generator" as NavView, label: "Timetable Generator", icon: Play, visible: !isViewer && !isTeacher },
        { id: "substitutions" as NavView, label: "Substitution Manager", icon: UserX, visible: !isViewer },
        { id: "smart_import" as NavView, label: "Smart Import (AI)", icon: UploadCloud, visible: !isViewer && !isTeacher },
      ],
    },
    {
      title: "Assessments & Exams",
      items: [
        { id: "exam_timetable" as NavView, label: "Exam Timetable", icon: GraduationCap, visible: true },
        { id: "test_timetable" as NavView, label: "Test Timetable", icon: ClipboardCheck, visible: true },
      ],
    },
    {
      title: "Curriculum & Rules",
      items: [
        { id: "curriculum" as NavView, label: "Curriculum Requirements", icon: Layers, visible: !isViewer && !isTeacher },
        { id: "constraints" as NavView, label: "Constraints Config", icon: Sliders, visible: !isViewer && !isTeacher },
      ],
    },
    {
      title: "Institution Data",
      items: [
        { id: "setup_terms" as NavView, label: "Terms & Academic Cycles", icon: Calendar, visible: !isViewer && !isTeacher },
        { id: "setup_periods" as NavView, label: "Period Structure", icon: Clock, visible: !isViewer && !isTeacher },
        { id: "setup_rooms" as NavView, label: "Rooms & Spaces", icon: Building, visible: !isViewer && !isTeacher },
        { id: "setup_subjects" as NavView, label: "Subjects & Labs", icon: BookOpen, visible: !isViewer && !isTeacher },
        { id: "setup_teachers" as NavView, label: "Teachers & Availability", icon: Users, visible: !isViewer && !isTeacher },
        { id: "setup_classes" as NavView, label: "Class Groups", icon: Users, visible: !isViewer && !isTeacher },
      ],
    },
    {
      title: "Analysis & Governance",
      items: [
        { id: "reports" as NavView, label: "Workload & Export", icon: BarChart3, visible: true },
        { id: "institutions_mgmt" as NavView, label: "Institutions (Tenants)", icon: Building, visible: isSuperAdmin },
        { id: "audit_logs" as NavView, label: "Audit & Edit History", icon: History, visible: !isViewer && !isTeacher },
      ],
    },
  ]

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-screen select-none shrink-0 no-print">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-7 h-7 rounded-md bg-[#1D4ED8] flex items-center justify-center text-white font-bold text-sm tracking-tight shadow-xs">
            T
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold tracking-tight text-slate-900 leading-tight">
              TimetableOS
            </span>
            <span className="text-[10px] text-slate-400 font-normal">
              Institutional Scheduler
            </span>
          </div>
        </div>

        {/* Multi-Tenant Switcher */}
        <InstitutionSwitcher />
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {navSections.map((section) => {
          const visibleItems = section.items.filter((item) => item.visible)
          if (visibleItems.length === 0) return null

          return (
            <div key={section.title}>
              <h4 className="px-2 mb-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                {section.title}
              </h4>
              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const Icon = item.icon
                  const isActive = currentView === item.id
                  return (
                    <button
                      key={item.id}
                      onClick={() => onSelectView(item.id)}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer text-left ${
                        isActive
                          ? "bg-blue-50 text-[#1D4ED8] font-semibold"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                    >
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          isActive ? "text-[#1D4ED8]" : "text-slate-400"
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      {/* Profile Footer */}
      <div className="p-3 border-t border-slate-200 bg-slate-50/75">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center text-xs font-semibold text-slate-700 shrink-0">
            {currentProfile.full_name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .substring(0, 2)
              .toUpperCase()}
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-xs font-medium text-slate-900 truncate">
              {currentProfile.full_name}
            </span>
            <span className="text-[10px] text-slate-400 truncate">
              {currentProfile.email}
            </span>
          </div>
        </div>
      </div>
    </aside>
  )
}
