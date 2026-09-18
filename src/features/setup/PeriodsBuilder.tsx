import React, { useState } from "react"
import { Clock, Coffee, Plus, Save, RotateCcw } from "lucide-react"
import { useDataStore } from "@/stores/useDataStore"
import type { Period } from "@/types/database"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

export function PeriodsBuilder() {
  const { currentInstitutionId, periods, savePeriods } = useDataStore()
  const instPeriods = periods.filter((p) => p.institution_id === currentInstitutionId)

  // Find unique period numbers (e.g., 1, 2, 3, 4, 5, 6, 7)
  const periodNumbers = Array.from(new Set(instPeriods.map((p) => p.period_number))).sort(
    (a, b) => a - b
  )

  const [localPeriods, setLocalPeriods] = useState<Period[]>(instPeriods)
  const [dirty, setDirty] = useState(false)

  // Synchronize when store changes
  React.useEffect(() => {
    setLocalPeriods(periods.filter((p) => p.institution_id === currentInstitutionId))
    setDirty(false)
  }, [periods, currentInstitutionId])

  const handleTimeChange = (periodNumber: number, field: "start_time" | "end_time", value: string) => {
    setLocalPeriods((prev) =>
      prev.map((p) => (p.period_number === periodNumber ? { ...p, [field]: value } : p))
    )
    setDirty(true)
  }

  const handleToggleBreak = (periodNumber: number) => {
    setLocalPeriods((prev) =>
      prev.map((p) => (p.period_number === periodNumber ? { ...p, is_break: !p.is_break } : p))
    )
    setDirty(true)
  }

  const handleAddPeriodToAllDays = () => {
    const nextNum = (periodNumbers[periodNumbers.length - 1] || 0) + 1
    const newPeriods: Period[] = []
    const workingDays = [1, 2, 3, 4, 5]

    for (const day of workingDays) {
      newPeriods.push({
        id: `period-d${day}-p${nextNum}-${Date.now()}`,
        institution_id: currentInstitutionId,
        day_of_week: day,
        period_number: nextNum,
        start_time: "14:20",
        end_time: "15:10",
        is_break: false,
      })
    }

    setLocalPeriods((prev) => [...prev, ...newPeriods])
    setDirty(true)
  }

  const handleSave = () => {
    savePeriods(localPeriods)
    setDirty(false)
  }

  const handleReset = () => {
    setLocalPeriods(instPeriods)
    setDirty(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Period &amp; Bell Schedule Builder</h2>
          <p className="text-xs text-slate-500">
            Define daily instructional periods, start/end times, and designate breaks/lunch intervals.
          </p>
        </div>
        <div className="flex gap-2">
          {dirty && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="gap-1 text-xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Discard Changes
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleAddPeriodToAllDays}
            variant="outline"
            className="gap-1.5 text-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Period #{periodNumbers.length + 1}
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!dirty}
            className="gap-1.5 text-xs"
          >
            <Save className="w-3.5 h-3.5" />
            Save Structure
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <Card>
          <CardHeader className="pb-3 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#1D4ED8]" />
                Daily Bell Times &amp; Break Definition
              </CardTitle>
              <span className="text-xs text-slate-400">
                Applies across instructional weekdays (Mon–Fri)
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0 divide-y divide-slate-100">
            {periodNumbers.map((pNum) => {
              // Find sample period representation for this period number
              const sample = localPeriods.find((p) => p.period_number === pNum)
              if (!sample) return null

              return (
                <div
                  key={pNum}
                  className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 px-5 gap-3 transition-colors ${
                    sample.is_break ? "bg-amber-50/40" : "hover:bg-slate-50/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-7 h-7 rounded-md flex items-center justify-center font-bold text-xs ${
                        sample.is_break
                          ? "bg-amber-100 text-amber-800"
                          : "bg-slate-100 text-slate-800"
                      }`}
                    >
                      P{pNum}
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-slate-800">
                        {sample.is_break ? `Period ${pNum} — Designated Break / Lunch` : `Period ${pNum}`}
                      </span>
                      <p className="text-[10px] text-slate-400">
                        {sample.is_break
                          ? "Lessons cannot be scheduled into this period"
                          : "Standard instructional block"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-500">Time:</span>
                      <Input
                        type="time"
                        value={sample.start_time.substring(0, 5)}
                        onChange={(e) => handleTimeChange(pNum, "start_time", e.target.value)}
                        className="h-8 w-24 text-xs font-mono"
                      />
                      <span className="text-slate-400 text-xs">&rarr;</span>
                      <Input
                        type="time"
                        value={sample.end_time.substring(0, 5)}
                        onChange={(e) => handleTimeChange(pNum, "end_time", e.target.value)}
                        className="h-8 w-24 text-xs font-mono"
                      />
                    </div>

                    <Button
                      size="sm"
                      variant={sample.is_break ? "default" : "outline"}
                      onClick={() => handleToggleBreak(pNum)}
                      className={`h-8 text-xs gap-1.5 ${
                        sample.is_break
                          ? "bg-amber-600 hover:bg-amber-700 text-white"
                          : "text-slate-600 border-slate-300"
                      }`}
                    >
                      <Coffee className="w-3.5 h-3.5" />
                      {sample.is_break ? "Is Break" : "Mark as Break"}
                    </Button>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        {/* Visual Weekly Grid Preview */}
        <Card>
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-sm">Weekly Grid Matrix</CardTitle>
            <CardDescription className="text-xs">
              Preview of weekly slot matrix used by the scheduling engine and master grid.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 overflow-x-auto">
            <table className="w-full border-collapse text-center text-xs">
              <thead>
                <tr>
                  <th className="p-2 border border-slate-200 bg-slate-50 text-slate-500 font-medium w-24 text-left">
                    Day / Slot
                  </th>
                  {periodNumbers.map((pNum) => {
                    const sample = localPeriods.find((p) => p.period_number === pNum)
                    return (
                      <th
                        key={pNum}
                        className={`p-2 border border-slate-200 font-medium ${
                          sample?.is_break ? "bg-amber-100/60 text-amber-900" : "bg-slate-50 text-slate-700"
                        }`}
                      >
                        <div>P{pNum}</div>
                        <div className="text-[10px] font-normal text-slate-400">
                          {sample?.start_time.substring(0, 5)}
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4, 5].map((dayIdx) => (
                  <tr key={dayIdx}>
                    <td className="p-2 border border-slate-200 font-medium text-slate-800 bg-slate-50/50 text-left">
                      {DAY_NAMES[dayIdx - 1]}
                    </td>
                    {periodNumbers.map((pNum) => {
                      const p = localPeriods.find(
                        (period) => period.day_of_week === dayIdx && period.period_number === pNum
                      )
                      return (
                        <td
                          key={pNum}
                          className={`p-2 border border-slate-200 text-xs ${
                            p?.is_break
                              ? "bg-amber-50 text-amber-800 font-medium"
                              : "text-slate-500 hover:bg-blue-50/30"
                          }`}
                        >
                          {p?.is_break ? (
                            <span className="flex items-center justify-center gap-1">
                              <Coffee className="w-3 h-3 text-amber-600" />
                              Break
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">Available</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
