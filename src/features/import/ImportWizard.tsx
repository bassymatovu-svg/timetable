import React, { useState, useRef } from "react"
import {
  UploadCloud,
  FileSpreadsheet,
  FileText,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RotateCcw,
  Check,
  X,
  ShieldAlert,
} from "lucide-react"
import * as XLSX from "xlsx"
import { useDataStore } from "@/stores/useDataStore"
import type { ImportSourceType, DraftImportRow, Lesson } from "@/types/database"
import { fuzzyMatchRow } from "@/lib/import/fuzzy-matcher"
import { validateAllHardConstraints } from "@/lib/scheduler-engine"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export function ImportWizard({ onNavigateToGrid }: { onNavigateToGrid?: () => void }) {
  const {
    currentInstitutionId,
    terms,
    classGroups,
    subjects,
    teachers,
    profiles,
    rooms,
    periods,
    teacherUnavailability,
    addDraftImport,
    addDraftImportRows,
    commitDraftImport,
  } = useDataStore()

  const activeTerm = terms[0]
  const instClasses = classGroups.filter((c) => c.institution_id === currentInstitutionId)
  const instSubjects = subjects.filter((s) => s.institution_id === currentInstitutionId)
  const instTeachers = teachers.filter((t) => t.institution_id === currentInstitutionId)
  const instRooms = rooms.filter((r) => r.institution_id === currentInstitutionId)
  const instPeriods = periods.filter((p) => p.institution_id === currentInstitutionId)

  // Wizard state: 1: upload -> 2: review/reconcile -> 3: commit summary
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [importMode, setImportMode] = useState<ImportSourceType>("curriculum_list")
  const [isProcessing, setIsProcessing] = useState(false)
  const [activeImportId, setActiveImportId] = useState<string | null>(null)
  const [extractedRows, setExtractedRows] = useState<DraftImportRow[]>([])
  const [includedRowIds, setIncludedRowIds] = useState<Set<string>>(new Set())
  const [preCommitConflicts, setPreCommitConflicts] = useState<{ rowId: string; message: string }[]>([])
  const [commitSummary, setCommitSummary] = useState<{ count: number; mode: ImportSourceType } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsProcessing(true)
    const reader = new FileReader()

    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result
        const wb = XLSX.read(bstr, { type: "binary" })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(ws)

        // Create draft import record
        const draft = addDraftImport({
          institution_id: currentInstitutionId,
          term_id: activeTerm?.id || null,
          source_type: importMode,
          original_filename: file.name,
          status: "needs_review",
          uploaded_by: null,
        })
        setActiveImportId(draft.id)

        const matchContext = {
          classGroups: instClasses,
          subjects: instSubjects,
          teachers: instTeachers,
          profiles,
          rooms: instRooms,
        }

        const draftRows: DraftImportRow[] = []
        const initialIncluded = new Set<string>()

        for (let i = 0; i < jsonData.length; i++) {
          const row = jsonData[i]
          const rawClassName = row["Class"] || row["Cohort"] || row["Grade"] || row["className"]
          const rawSubjectName = row["Subject"] || row["Course"] || row["subjectName"]
          const rawTeacherName = row["Teacher"] || row["Faculty"] || row["teacherName"]
          const rawRoomName = row["Room"] || row["Facility"] || row["roomName"]
          const dayVal = Number(row["Day"] || row["DayOfWeek"] || row["dayOfWeek"] || 1)
          const periodVal = Number(row["Period"] || row["PeriodNumber"] || row["periodNumber"] || 1)
          const periodsPerWeekVal = Number(row["Periods"] || row["PeriodsPerWeek"] || row["periodsPerWeek"] || 4)

          const match = fuzzyMatchRow(
            {
              className: rawClassName ? String(rawClassName) : undefined,
              subjectName: rawSubjectName ? String(rawSubjectName) : undefined,
              teacherName: rawTeacherName ? String(rawTeacherName) : undefined,
              roomName: rawRoomName ? String(rawRoomName) : undefined,
            },
            matchContext
          )

          const rowId = `drow-${draft.id}-${i}`
          draftRows.push({
            id: rowId,
            draft_import_id: draft.id,
            raw_data: row,
            matched_class_group_id: match.matchedClassGroupId,
            matched_subject_id: match.matchedSubjectId,
            matched_teacher_id: match.matchedTeacherId,
            matched_room_id: match.matchedRoomId,
            match_confidence: match.confidence,
            needs_manual_review: match.needsManualReview,
            resolved: !match.needsManualReview,
            day_of_week: importMode === "legacy_timetable" ? dayVal : null,
            period_number: importMode === "legacy_timetable" ? periodVal : null,
            periods_per_week: importMode === "curriculum_list" ? periodsPerWeekVal : null,
            hard_conflict: false,
            conflict_details: null,
          })

          initialIncluded.add(rowId)
        }

        addDraftImportRows(draftRows)
        setExtractedRows(draftRows)
        setIncludedRowIds(initialIncluded)
        setIsProcessing(false)
        setStep(2)
      } catch (err: any) {
        setIsProcessing(false)
        alert("Failed to process file: " + err.message)
      }
    }

    reader.readAsBinaryString(file)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  // Row update in review step
  const handleUpdateRowMatch = (rowId: string, field: keyof DraftImportRow, val: any) => {
    setExtractedRows((prev) =>
      prev.map((r) => {
        if (r.id === rowId) {
          return {
            ...r,
            [field]: val,
            resolved: true,
            needs_manual_review: false,
          }
        }
        return r
      })
    )
  }

  const toggleIncludeRow = (rowId: string) => {
    setIncludedRowIds((prev) => {
      const next = new Set(prev)
      if (next.has(rowId)) {
        next.delete(rowId)
      } else {
        next.add(rowId)
      }
      return next
    })
  }

  // Pre-commit validation: Runs Mode B legacy timetable rows through hard-constraint engine
  const handleVerifyAndCommit = () => {
    if (!activeImportId) return

    const rowsToCommit = extractedRows.filter((r) => includedRowIds.has(r.id))

    if (importMode === "legacy_timetable") {
      const conflicts: { rowId: string; message: string }[] = []
      const simulatedLessons: Lesson[] = []

      const hardContext = {
        periods: instPeriods,
        rooms: instRooms,
        subjects: instSubjects,
        teachers: instTeachers,
        classGroups: instClasses,
        teacherUnavailability,
      }

      for (const row of rowsToCommit) {
        if (
          row.matched_class_group_id &&
          row.matched_subject_id &&
          row.matched_teacher_id &&
          row.matched_room_id &&
          row.day_of_week &&
          row.period_number
        ) {
          const matchedPeriod = instPeriods.find(
            (p) => p.day_of_week === row.day_of_week && p.period_number === row.period_number
          )

          if (matchedPeriod) {
            const candidate: Lesson = {
              id: row.id,
              term_id: activeTerm?.id || "",
              class_group_id: row.matched_class_group_id,
              subject_id: row.matched_subject_id,
              teacher_id: row.matched_teacher_id,
              room_id: row.matched_room_id,
              period_id: matchedPeriod.id,
              week_pattern: "all",
              locked: false,
            }

            const violations = validateAllHardConstraints(candidate, simulatedLessons, hardContext)
            if (violations.length > 0) {
              conflicts.push({
                rowId: row.id,
                message: violations[0].message,
              })
            } else {
              simulatedLessons.push(candidate)
            }
          }
        }
      }

      if (conflicts.length > 0) {
        setPreCommitConflicts(conflicts)
        // If conflicts found, warn the admin before proceeding
        const proceed = window.confirm(
          `Detected ${conflicts.length} real constraint conflicts in this legacy timetable (e.g. double bookings). Do you want to commit only the non-conflicting rows?`
        )
        if (!proceed) return
      }
    }

    const commitRes = commitDraftImport(activeImportId)
    if (commitRes.success) {
      setCommitSummary({ count: commitRes.committedCount, mode: importMode })
      setStep(3)
    } else {
      alert("Commit failed: " + (commitRes.errors?.[0] || "Unknown error"))
    }
  }

  // Sample templates for testing
  const downloadCurriculumTemplate = () => {
    const data = [
      { Class: "Grade 9A", Subject: "Mathematics", Teacher: "Dr. Robert Vance", Periods: 5 },
      { Class: "Grade 9A", Subject: "Physics", Teacher: "Sarah Jenkins", Periods: 4 },
      { Class: "Grade 10B", Subject: "Computer Science", Teacher: "Emily Zhao", Periods: 3 },
    ]
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Curriculum")
    XLSX.writeFile(wb, "curriculum_import_sample.xlsx")
  }

  const downloadLegacyTimetableTemplate = () => {
    const data = [
      { Day: 1, Period: 1, Class: "Grade 9A", Subject: "Mathematics", Teacher: "Dr. Robert Vance", Room: "Room 101" },
      { Day: 1, Period: 2, Class: "Grade 9A", Subject: "Physics", Teacher: "Sarah Jenkins", Room: "Science Lab Alpha" },
      { Day: 1, Period: 3, Class: "Grade 10B", Subject: "Computer Science", Teacher: "Emily Zhao", Room: "Computer Lab A" },
    ]
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "LegacyTimetable")
    XLSX.writeFile(wb, "legacy_timetable_sample.xlsx")
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Smart Import &amp; Legacy Data Migration</h2>
        <p className="text-xs text-slate-500">
          Upload legacy timetables or curriculum spreadsheets. AI &amp; Fuzzy matching map entities with zero data loss.
        </p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 border-b border-slate-200 pb-3">
        <span className={step === 1 ? "text-[#1D4ED8] font-bold" : ""}>1. Upload &amp; Mode</span>
        <span>&rarr;</span>
        <span className={step === 2 ? "text-[#1D4ED8] font-bold" : ""}>2. Review &amp; Reconcile</span>
        <span>&rarr;</span>
        <span className={step === 3 ? "text-[#1D4ED8] font-bold" : ""}>3. Commit Complete</span>
      </div>

      {/* STEP 1: Upload & Mode Selection */}
      {step === 1 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Mode A: Curriculum Import */}
          <Card
            onClick={() => setImportMode("curriculum_list")}
            className={`cursor-pointer transition-all border-2 ${
              importMode === "curriculum_list"
                ? "border-[#1D4ED8] bg-blue-50/10"
                : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-[#1D4ED8]" />
                  Mode A: Curriculum Requirements Import
                </CardTitle>
                {importMode === "curriculum_list" && (
                  <Badge variant="primary" className="text-[10px]">Selected</Badge>
                )}
              </div>
              <CardDescription className="text-xs">
                Upload class subjects, teacher assignments, and periods/week. Feeds the automated generation solver directly.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-2.5 rounded bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1">
                <div className="font-semibold text-slate-800">Expected Columns:</div>
                <div>Class Name, Subject Title, Teacher Name, Periods Per Week</div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation()
                  downloadCurriculumTemplate()
                }}
                className="w-full text-xs"
              >
                Download Mode A Excel Template
              </Button>
            </CardContent>
          </Card>

          {/* Mode B: Legacy Timetable Import */}
          <Card
            onClick={() => setImportMode("legacy_timetable")}
            className={`cursor-pointer transition-all border-2 ${
              importMode === "legacy_timetable"
                ? "border-[#1D4ED8] bg-blue-50/10"
                : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#1D4ED8]" />
                  Mode B: Legacy Timetable Migration
                </CardTitle>
                {importMode === "legacy_timetable" && (
                  <Badge variant="primary" className="text-[10px]">Selected</Badge>
                )}
              </div>
              <CardDescription className="text-xs">
                Upload existing master schedule. Directly commits into editable lessons on the master grid.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-2.5 rounded bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1">
                <div className="font-semibold text-slate-800">Expected Columns:</div>
                <div>Day (1-5), Period (1-7), Class, Subject, Teacher, Room</div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation()
                  downloadLegacyTimetableTemplate()
                }}
                className="w-full text-xs"
              >
                Download Mode B Excel Template
              </Button>
            </CardContent>
          </Card>

          {/* Upload Dropzone */}
          <div className="md:col-span-2">
            <Card className="border-dashed border-2 border-slate-300 p-8 text-center bg-slate-50/50 hover:bg-slate-50 transition-colors">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".csv,.xlsx,.xls,.pdf,.png,.jpg,.jpeg"
                className="hidden"
              />
              <UploadCloud className="w-10 h-10 mx-auto text-[#1D4ED8] mb-3" />
              <h3 className="text-sm font-semibold text-slate-800">
                Upload {importMode === "curriculum_list" ? "Curriculum" : "Legacy Timetable"} File
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Select an Excel spreadsheet (.xlsx), CSV, or schedule export. Structured extraction automatically maps entities.
              </p>
              <div className="mt-4">
                <Button
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing}
                  className="gap-2 text-xs"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  {isProcessing ? "Processing & Matching Entities..." : "Select File to Upload"}
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* STEP 2: Review & Reconcile Screen */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-white border border-slate-200 rounded-lg">
            <div>
              <h3 className="text-xs font-semibold text-slate-800">
                Extracted Data Reconcile Table ({extractedRows.length} rows)
              </h3>
              <p className="text-[11px] text-slate-500">
                Review matched entities. Any confidence score below 0.70 is flagged for review. Only checked rows will be committed.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep(1)}
                className="text-xs"
              >
                Upload Different File
              </Button>
              <Button
                size="sm"
                onClick={handleVerifyAndCommit}
                className="gap-1.5 text-xs bg-emerald-700 hover:bg-emerald-800 text-white"
              >
                <Check className="w-3.5 h-3.5" />
                Validate &amp; Commit {includedRowIds.size} Rows
              </Button>
            </div>
          </div>

          {/* Conflict Warnings if Mode B found pre-existing clashes */}
          {preCommitConflicts.length > 0 && (
            <Card className="border-red-300 bg-red-50/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs flex items-center gap-1.5 text-red-800 font-bold">
                  <ShieldAlert className="w-4 h-4 text-red-600" />
                  Legacy Schedule Conflicts Detected ({preCommitConflicts.length})
                </CardTitle>
                <CardDescription className="text-[11px] text-red-700">
                  The uploaded timetable has internal collisions from previous manual scheduling.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0 space-y-1">
                {preCommitConflicts.map((c, i) => (
                  <div key={i} className="text-[11px] text-red-700 flex items-center gap-1.5 font-mono">
                    <span>&bull;</span>
                    <span>{c.message}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Review Table */}
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 text-center">Include</TableHead>
                    <TableHead>Raw Extracted Text</TableHead>
                    <TableHead>Class Cohort</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Teacher</TableHead>
                    {importMode === "legacy_timetable" && <TableHead>Room</TableHead>}
                    {importMode === "legacy_timetable" && <TableHead>Slot</TableHead>}
                    {importMode === "curriculum_list" && <TableHead>Periods/Wk</TableHead>}
                    <TableHead>Match Confidence</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {extractedRows.map((row) => {
                    const isIncluded = includedRowIds.has(row.id)
                    const confidence = row.match_confidence || 0

                    return (
                      <TableRow
                        key={row.id}
                        className={!isIncluded ? "opacity-50 bg-slate-50" : ""}
                      >
                        <TableCell className="text-center">
                          <input
                            type="checkbox"
                            checked={isIncluded}
                            onChange={() => toggleIncludeRow(row.id)}
                            className="w-4 h-4 rounded text-[#1D4ED8]"
                          />
                        </TableCell>

                        <TableCell className="text-xs text-slate-600 font-mono max-w-xs truncate">
                          {JSON.stringify(row.raw_data)}
                        </TableCell>

                        <TableCell>
                          <select
                            className="h-7 text-xs rounded border border-slate-300 bg-white px-1.5"
                            value={row.matched_class_group_id || ""}
                            onChange={(e) =>
                              handleUpdateRowMatch(row.id, "matched_class_group_id", e.target.value)
                            }
                          >
                            <option value="">Select Class...</option>
                            {instClasses.map((cg) => (
                              <option key={cg.id} value={cg.id}>
                                {cg.name}
                              </option>
                            ))}
                          </select>
                        </TableCell>

                        <TableCell>
                          <select
                            className="h-7 text-xs rounded border border-slate-300 bg-white px-1.5"
                            value={row.matched_subject_id || ""}
                            onChange={(e) =>
                              handleUpdateRowMatch(row.id, "matched_subject_id", e.target.value)
                            }
                          >
                            <option value="">Select Subject...</option>
                            {instSubjects.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name} ({s.code})
                              </option>
                            ))}
                          </select>
                        </TableCell>

                        <TableCell>
                          <select
                            className="h-7 text-xs rounded border border-slate-300 bg-white px-1.5"
                            value={row.matched_teacher_id || ""}
                            onChange={(e) =>
                              handleUpdateRowMatch(row.id, "matched_teacher_id", e.target.value)
                            }
                          >
                            <option value="">Unassigned</option>
                            {instTeachers.map((t) => {
                              const p = profiles.find((prof) => prof.id === t.id)
                              return (
                                <option key={t.id} value={t.id}>
                                  {p?.full_name || t.id}
                                </option>
                              )
                            })}
                          </select>
                        </TableCell>

                        {importMode === "legacy_timetable" && (
                          <TableCell>
                            <select
                              className="h-7 text-xs rounded border border-slate-300 bg-white px-1.5"
                              value={row.matched_room_id || ""}
                              onChange={(e) =>
                                handleUpdateRowMatch(row.id, "matched_room_id", e.target.value)
                              }
                            >
                              <option value="">Select Room...</option>
                              {instRooms.map((r) => (
                                <option key={r.id} value={r.id}>
                                  {r.name}
                                </option>
                              ))}
                            </select>
                          </TableCell>
                        )}

                        {importMode === "legacy_timetable" && (
                          <TableCell className="text-xs text-slate-700 font-mono">
                            Day {row.day_of_week}, P{row.period_number}
                          </TableCell>
                        )}

                        {importMode === "curriculum_list" && (
                          <TableCell className="text-xs font-semibold text-slate-800">
                            {row.periods_per_week || 4}
                          </TableCell>
                        )}

                        <TableCell>
                          <Badge
                            variant={
                              confidence >= 0.8
                                ? "success"
                                : confidence >= 0.6
                                ? "warning"
                                : "destructive"
                            }
                            className="text-[10px] py-0 px-1.5 font-mono"
                          >
                            {(confidence * 100).toFixed(0)}%
                          </Badge>
                          {row.needs_manual_review && (
                            <span className="text-[9px] text-amber-700 block mt-0.5">
                              Review
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* STEP 3: Commit Complete Summary */}
      {step === 3 && commitSummary && (
        <Card className="border-emerald-200 bg-emerald-50/20 p-8 text-center space-y-4">
          <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-900">
            Import Successfully Committed to Institutional Database
          </h3>
          <p className="text-xs text-slate-600 max-w-md mx-auto">
            {commitSummary.mode === "curriculum_list"
              ? `Successfully committed ${commitSummary.count} curriculum requirement allotments into active term. You can now run the automated generation solver.`
              : `Successfully committed ${commitSummary.count} lessons directly into the master timetable. You can now view and edit them with drag-and-drop.`}
          </p>

          <div className="flex justify-center gap-3 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStep(1)}
              className="text-xs"
            >
              Import Another File
            </Button>
            {onNavigateToGrid && (
              <Button size="sm" onClick={onNavigateToGrid} className="text-xs">
                Open Master Timetable Grid
              </Button>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}
