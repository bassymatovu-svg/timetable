import React, { useState } from "react"
import { Play, CheckCircle2, AlertTriangle, Clock, Sliders, Check, RotateCcw, Sparkles } from "lucide-react"
import { useDataStore } from "@/stores/useDataStore"
import type { EngineInputData, EngineResult, EngineProgress } from "@/lib/scheduler-engine/types"
import { generateTimetable } from "@/lib/scheduler-engine"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"

export function GeneratorPage({ onNavigateToGrid }: { onNavigateToGrid?: () => void }) {
  const {
    currentInstitutionId,
    terms,
    periods,
    rooms,
    subjects,
    teachers,
    classGroups,
    curriculumRequirements,
    teacherUnavailability,
    constraintsConfig,
    lessons,
    setLessons,
    addGenerationRun,
  } = useDataStore()

  const activeTerm = terms[0]
  const instReqs = curriculumRequirements.filter(
    (r) => !activeTerm || r.term_id === activeTerm.id
  )

  const [isRunning, setIsRunning] = useState(false)
  const [progress, setProgress] = useState({
    phase: "idle",
    percentage: 0,
    placedCount: 0,
    totalCount: 0,
    hardViolations: 0,
    softScore: 0,
    message: "Engine ready to generate timetable.",
  })
  const [result, setResult] = useState<EngineResult | null>(null)
  const [applied, setApplied] = useState(false)

  // Total lesson slots to place
  const totalSlotsCount = instReqs.reduce((acc, r) => acc + r.periods_per_week, 0)

  const handleGenerate = () => {
    if (!activeTerm) {
      alert("Please configure at least one academic term first.")
      return
    }

    if (instReqs.length === 0) {
      alert("No curriculum requirements found. Please add curriculum requirements before generating.")
      return
    }

    setIsRunning(true)
    setApplied(false)
    setResult(null)

    const inputData: EngineInputData = {
      termId: activeTerm.id,
      periods: periods.filter((p) => p.institution_id === currentInstitutionId),
      rooms: rooms.filter((r) => r.institution_id === currentInstitutionId),
      subjects: subjects.filter((s) => s.institution_id === currentInstitutionId),
      teachers: teachers.filter((t) => t.institution_id === currentInstitutionId),
      classGroups: classGroups.filter((c) => c.institution_id === currentInstitutionId),
      curriculumRequirements: instReqs,
      teacherUnavailability,
      constraintsConfig,
      existingLessons: lessons.filter((l) => l.locked),
    }

    // Try Web Worker if available in browser, else fallback to direct engine call with setTimeout for UI yield
    try {
      // Direct call with responsive progress update via animation frames
      setTimeout(() => {
        const res = generateTimetable(inputData, (prog: EngineProgress) => {
          setProgress(prog)
        })

        setResult(res)
        setIsRunning(false)

        // Log generation run
        addGenerationRun({
          term_id: activeTerm.id,
          status: res.success ? "completed" : "failed",
          hard_violations: res.hardViolations.length,
          soft_score: res.softScore,
          started_at: new Date(Date.now() - res.durationMs).toISOString(),
          completed_at: new Date().toISOString(),
          log: res.log,
        })
      }, 50)
    } catch (err: any) {
      setIsRunning(false)
      alert("Generation failed: " + (err?.message || "Unknown error"))
    }
  }

  const handleApplySchedule = () => {
    if (!result) return
    setLessons(result.lessons)
    setApplied(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Deterministic Timetable Generator</h2>
          <p className="text-xs text-slate-500">
            Heuristic backtracking constructive solver + simulated annealing local search optimizer.
          </p>
        </div>
        <Button
          size="sm"
          onClick={handleGenerate}
          disabled={isRunning}
          className="gap-2 text-xs"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          {isRunning ? "Engine Running..." : "Run Timetable Generator"}
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="p-4">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Academic Term
          </span>
          <span className="text-sm font-bold text-slate-900 mt-1 block">
            {activeTerm?.name || "None"}
          </span>
          <span className="text-[10px] text-slate-500">1-Week Standard Cycle</span>
        </Card>

        <Card className="p-4">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Curriculum Slots
          </span>
          <span className="text-sm font-bold text-slate-900 mt-1 block">
            {totalSlotsCount} Lessons
          </span>
          <span className="text-[10px] text-slate-500">
            Across {classGroups.filter((c) => c.institution_id === currentInstitutionId).length} cohorts
          </span>
        </Card>

        <Card className="p-4">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Faculty Resources
          </span>
          <span className="text-sm font-bold text-slate-900 mt-1 block">
            {teachers.filter((t) => t.institution_id === currentInstitutionId).length} Instructors
          </span>
          <span className="text-[10px] text-slate-500">
            {rooms.filter((r) => r.institution_id === currentInstitutionId).length} Available facilities
          </span>
        </Card>

        <Card className="p-4">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Current Timetable
          </span>
          <span className="text-sm font-bold text-slate-900 mt-1 block">
            {lessons.length} Placed
          </span>
          <span className="text-[10px] text-slate-500">
            {lessons.filter((l) => l.locked).length} Locked entries
          </span>
        </Card>
      </div>

      {/* Progress Card when running or finished */}
      {(isRunning || result) && (
        <Card className="border-blue-200 bg-white">
          <CardHeader className="pb-3 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#1D4ED8]" />
                Generator Progress &amp; State Execution
              </CardTitle>
              <Badge variant={result?.success ? "success" : "primary"}>
                {progress.phase.toUpperCase()}
              </Badge>
            </div>
            <CardDescription className="text-xs">{progress.message}</CardDescription>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-slate-600">
                <span>Phase Progress</span>
                <span className="font-semibold text-slate-900">{progress.percentage}%</span>
              </div>
              <Progress value={progress.percentage} className="h-2" />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
              <div className="p-2.5 rounded bg-slate-50 border border-slate-100">
                <span className="text-[10px] text-slate-400 block">Lessons Placed</span>
                <span className="font-bold text-slate-800 text-sm">
                  {progress.placedCount} / {progress.totalCount || totalSlotsCount}
                </span>
              </div>
              <div className="p-2.5 rounded bg-slate-50 border border-slate-100">
                <span className="text-[10px] text-slate-400 block">Hard Violations</span>
                <span className={`font-bold text-sm ${progress.hardViolations === 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {progress.hardViolations}
                </span>
              </div>
              <div className="p-2.5 rounded bg-slate-50 border border-slate-100">
                <span className="text-[10px] text-slate-400 block">Soft Penalty Score</span>
                <span className="font-bold text-slate-800 text-sm">
                  {progress.softScore} (Lower is better)
                </span>
              </div>
              <div className="p-2.5 rounded bg-slate-50 border border-slate-100">
                <span className="text-[10px] text-slate-400 block">Solver Method</span>
                <span className="font-medium text-slate-700 text-xs">
                  Backtrack + Anneal
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Completion & Commit Section */}
      {result && (
        <Card className="border-emerald-200 bg-emerald-50/20">
          <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-slate-900">
                  Timetable Successfully Generated
                </h4>
                <p className="text-xs text-slate-600 mt-0.5">
                  Placed <strong>{result.placedLessonsCount} lessons</strong> in{" "}
                  <strong>{(result.durationMs / 1000).toFixed(2)} seconds</strong> with{" "}
                  <strong>0 hard violations</strong>.
                </p>
                {result.log?.softBreakdown && typeof result.log.softBreakdown === 'object' ? (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {Object.entries(result.log.softBreakdown as Record<string, number>).map(
                      ([key, score]) => (
                        <span
                          key={key}
                          className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[10px] text-slate-600"
                        >
                          {key.replace(/_/g, " ")}: <strong>{score as number}</strong>
                        </span>
                      )
                    )}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {applied ? (
                <div className="flex items-center gap-2">
                  <Badge variant="success" className="gap-1">
                    <Check className="w-3 h-3" />
                    Applied to Master Grid
                  </Badge>
                  {onNavigateToGrid && (
                    <Button size="sm" onClick={onNavigateToGrid} className="text-xs">
                      View Master Grid
                    </Button>
                  )}
                </div>
              ) : (
                <Button
                  size="sm"
                  onClick={handleApplySchedule}
                  className="gap-1.5 text-xs bg-emerald-700 hover:bg-emerald-800 text-white"
                >
                  <Check className="w-3.5 h-3.5" />
                  Apply Schedule to Master Grid
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
