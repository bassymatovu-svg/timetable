import React from "react"
import { ShieldAlert, Sliders, CheckCircle2, Info } from "lucide-react"
import { useDataStore } from "@/stores/useDataStore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const HARD_CONSTRAINTS_META: Record<string, { label: string; desc: string }> = {
  teacher_no_double_book: {
    label: "Teacher Conflict Prevention",
    desc: "A teacher cannot be scheduled in two distinct classrooms or cohorts in the same period.",
  },
  room_no_double_book: {
    label: "Room Double-Booking Guard",
    desc: "A facility or room cannot be assigned to two classes simultaneously in the same period.",
  },
  class_no_double_book: {
    label: "Class Cohort Collision Guard",
    desc: "A student class cohort cannot have two simultaneous lessons scheduled.",
  },
  teacher_availability: {
    label: "Teacher Availability Compliance",
    desc: "A teacher cannot be scheduled in periods marked as unavailable on their schedule.",
  },
  room_type_and_capacity: {
    label: "Room Specification & Capacity",
    desc: "Assigned room must match subject type (lab, gym, art) and hold >= class student size.",
  },
  curriculum_periods_fulfillment: {
    label: "Curriculum Allotment Fulfillment",
    desc: "Every cohort must receive exactly its specified weekly period allotment for all subjects.",
  },
  double_period_consecutive: {
    label: "Consecutive Double Period Requirement",
    desc: "Double periods must be scheduled as two adjacent periods on the same day in the same room.",
  },
  teacher_max_load_limits: {
    label: "Teacher Daily & Weekly Load Caps",
    desc: "A teacher cannot be scheduled for more periods in a day or week than their profile limits.",
  },
}

const SOFT_CONSTRAINTS_META: Record<string, { label: string; desc: string }> = {
  minimize_teacher_gaps: {
    label: "Minimize Teacher Free Gaps",
    desc: "Compacts teacher schedules to avoid idle wait windows between scheduled lessons.",
  },
  minimize_student_gaps: {
    label: "Minimize Student Schedule Gaps",
    desc: "Eliminates empty unsupervised gaps during the middle of the school day for students.",
  },
  spread_subject_evenly: {
    label: "Subject Day Distribution",
    desc: "Distributes multiple periods of a subject across different days rather than same-day cramming.",
  },
  avoid_demanding_subject_last: {
    label: "Avoid High-Cognitive Subjects Last Period",
    desc: "Prefers morning slots for intensive subjects (e.g. advanced mathematics, chemistry).",
  },
  respect_time_preferences: {
    label: "Teacher Time-of-Day Preferences",
    desc: "Biases placement towards morning or afternoon slots according to faculty preferences.",
  },
  balance_teacher_workload: {
    label: "Teacher Workload Balancing",
    desc: "Aims for an even distribution of classes across Monday through Friday for each faculty member.",
  },
  minimize_room_changes: {
    label: "Minimize Room Hopping",
    desc: "Prefers keeping classes or teachers in a consistent homeroom across consecutive periods.",
  },
  avoid_isolated_single_free_period: {
    label: "Avoid Single-Period Holes",
    desc: "Penalizes isolated 1-period gaps where teachers cannot effectively prepare or commute.",
  },
}

export function ConstraintsConfigView() {
  const { constraintsConfig, updateConstraintConfig } = useDataStore()

  const hardConstraints = constraintsConfig.filter((c) => c.constraint_type === "hard")
  const softConstraints = constraintsConfig.filter((c) => c.constraint_type === "soft")

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Scheduling Constraints &amp; Optimization Penalties</h2>
        <p className="text-xs text-slate-500">
          Hard constraints are mandatory and strictly rejected. Soft constraints are scored and optimized via simulated annealing.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hard Constraints Column */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-1 border-b border-slate-200">
            <ShieldAlert className="w-4 h-4 text-red-600" />
            <h3 className="text-sm font-semibold text-slate-900">
              Hard Constraints (Mandatory Invariants)
            </h3>
          </div>
          <p className="text-[11px] text-slate-500">
            Enforced by the generation algorithm, the drag-and-drop grid validator, and database unique constraints.
          </p>

          <div className="space-y-2.5">
            {hardConstraints.map((c) => {
              const meta = HARD_CONSTRAINTS_META[c.constraint_key] || {
                label: c.constraint_key,
                desc: "",
              }

              return (
                <Card key={c.constraint_key} className="border-slate-200 bg-white shadow-2xs">
                  <CardContent className="p-3.5 flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="text-xs font-semibold text-slate-800">
                          {meta.label}
                        </span>
                        <Badge variant="outline" className="text-[9px] py-0 px-1 border-emerald-300 text-emerald-800 bg-emerald-50">
                          Zero Tolerance
                        </Badge>
                      </div>
                      <p className="text-[11px] text-slate-500">{meta.desc}</p>
                    </div>

                    <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-600 shrink-0">
                      <input
                        type="checkbox"
                        checked={c.enabled}
                        onChange={(e) =>
                          updateConstraintConfig(c.constraint_key, { enabled: e.target.checked })
                        }
                        className="w-4 h-4 rounded text-[#1D4ED8]"
                      />
                      <span className="text-[11px] font-medium">Active</span>
                    </label>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>

        {/* Soft Constraints Column */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-1 border-b border-slate-200">
            <Sliders className="w-4 h-4 text-[#1D4ED8]" />
            <h3 className="text-sm font-semibold text-slate-900">
              Soft Constraints (Optimization Objectives)
            </h3>
          </div>
          <p className="text-[11px] text-slate-500">
            Adjust penalty weights (1 to 10). Higher weights incentivize the simulated annealing engine to prioritize the objective.
          </p>

          <div className="space-y-2.5">
            {softConstraints.map((c) => {
              const meta = SOFT_CONSTRAINTS_META[c.constraint_key] || {
                label: c.constraint_key,
                desc: "",
              }

              return (
                <Card key={c.constraint_key} className="border-slate-200 bg-white shadow-2xs">
                  <CardContent className="p-3.5 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-slate-800">
                            {meta.label}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">{meta.desc}</p>
                      </div>

                      <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-600 shrink-0">
                        <input
                          type="checkbox"
                          checked={c.enabled}
                          onChange={(e) =>
                            updateConstraintConfig(c.constraint_key, { enabled: e.target.checked })
                          }
                          className="w-4 h-4 rounded text-[#1D4ED8]"
                        />
                        <span className="text-[11px] font-medium">Enabled</span>
                      </label>
                    </div>

                    {c.enabled && (
                      <div className="flex items-center gap-3 pt-1 border-t border-slate-100">
                        <span className="text-[10px] text-slate-400 uppercase font-semibold">
                          Weight:
                        </span>
                        <input
                          type="range"
                          min={1}
                          max={10}
                          value={c.weight}
                          onChange={(e) =>
                            updateConstraintConfig(c.constraint_key, {
                              weight: Number(e.target.value),
                            })
                          }
                          className="flex-1 accent-[#1D4ED8] h-1.5 bg-slate-100 rounded-lg cursor-pointer"
                        />
                        <span className="text-xs font-bold text-slate-800 w-5 text-right font-mono">
                          {c.weight}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
