import * as XLSX from "xlsx"
import type { Lesson, Period, Room, Subject, ClassGroup, Profile } from "@/types/database"

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]

interface ExportGridContext {
  title: string
  subtitle: string
  institutionName: string
  periods: Period[]
  lessons: Lesson[]
  rooms: Room[]
  subjects: Subject[]
  classGroups: ClassGroup[]
  profiles: Profile[]
}

/**
 * 1. Download Master Timetable Grid as Excel Spreadsheet (.xlsx)
 * Formats the exact Day × Period matrix table.
 */
export function downloadGridAsExcel({
  title,
  subtitle,
  institutionName,
  periods,
  lessons,
  rooms,
  subjects,
  classGroups,
  profiles,
}: ExportGridContext) {
  const periodMap = new Map(periods.map((p) => [p.id, p]))
  const roomMap = new Map(rooms.map((r) => [r.id, r]))
  const subjectMap = new Map(subjects.map((s) => [s.id, s]))
  const classMap = new Map(classGroups.map((c) => [c.id, c]))
  const profileMap = new Map(profiles.map((p) => [p.id, p]))

  const periodNumbers = Array.from(new Set(periods.map((p) => p.period_number))).sort(
    (a, b) => a - b
  )

  // Header row
  const matrixData: Record<string, string>[] = []

  for (let dayIdx = 1; dayIdx <= 5; dayIdx++) {
    const rowObj: Record<string, string> = {
      Day: DAY_NAMES[dayIdx - 1],
    }

    for (const pNum of periodNumbers) {
      const p = periods.find((period) => period.day_of_week === dayIdx && period.period_number === pNum)
      const colHeader = `Period ${pNum} (${p?.start_time.substring(0, 5) || ""} - ${p?.end_time.substring(0, 5) || ""})`

      if (p?.is_break) {
        rowObj[colHeader] = "BREAK / LUNCH"
      } else if (p) {
        const matchingLessons = lessons.filter((l) => l.period_id === p.id)
        if (matchingLessons.length === 0) {
          rowObj[colHeader] = "—"
        } else {
          rowObj[colHeader] = matchingLessons
            .map((l) => {
              const s = subjectMap.get(l.subject_id)
              const r = roomMap.get(l.room_id)
              const c = classMap.get(l.class_group_id)
              const prof = profileMap.get(l.teacher_id)
              return `${s?.name || "Subject"} (${c?.name || "Class"}, ${r?.name || "Room"}, ${prof?.full_name || "Teacher"})`
            })
            .join(" | ")
        }
      }
    }

    matrixData.push(rowObj)
  }

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(matrixData)

  // Set column widths
  ws["!cols"] = [{ wch: 12 }, ...periodNumbers.map(() => ({ wch: 32 }))]

  XLSX.utils.book_append_sheet(wb, ws, "Timetable Matrix")
  const filename = `${title.toLowerCase().replace(/[^a-z0-9]/g, "_")}_timetable.xlsx`
  XLSX.writeFile(wb, filename)
}

/**
 * 2. Download Master Timetable Grid as Word Document (.doc)
 * Generates an MSOffice-compliant HTML/XML document that opens cleanly in MS Word and Google Docs.
 */
export function downloadGridAsWord({
  title,
  subtitle,
  institutionName,
  periods,
  lessons,
  rooms,
  subjects,
  classGroups,
  profiles,
}: ExportGridContext) {
  const roomMap = new Map(rooms.map((r) => [r.id, r]))
  const subjectMap = new Map(subjects.map((s) => [s.id, s]))
  const classMap = new Map(classGroups.map((c) => [c.id, c]))
  const profileMap = new Map(profiles.map((p) => [p.id, p]))

  const periodNumbers = Array.from(new Set(periods.map((p) => p.period_number))).sort(
    (a, b) => a - b
  )

  let tableHtml = `
    <table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse; width: 100%; font-family: Calibri, sans-serif; font-size: 11pt; border: 1px solid #94a3b8;">
      <thead>
        <tr style="background-color: #f1f5f9; text-align: center;">
          <th style="padding: 8px; width: 100px; text-align: left;">Day / Slot</th>
  `

  for (const pNum of periodNumbers) {
    const p = periods.find((period) => period.period_number === pNum)
    tableHtml += `
      <th style="padding: 8px; ${p?.is_break ? "background-color: #fef3c7;" : ""}">
        <strong>Period ${pNum}</strong><br/>
        <span style="font-size: 9pt; color: #64748b;">${p?.start_time.substring(0, 5)} - ${p?.end_time.substring(0, 5)}</span>
      </th>
    `
  }
  tableHtml += `</tr></thead><tbody>`

  for (let dayIdx = 1; dayIdx <= 5; dayIdx++) {
    tableHtml += `<tr><td style="padding: 8px; font-weight: bold; background-color: #f8fafc;">${DAY_NAMES[dayIdx - 1]}</td>`

    for (const pNum of periodNumbers) {
      const p = periods.find((period) => period.day_of_week === dayIdx && period.period_number === pNum)

      if (p?.is_break) {
        tableHtml += `<td style="padding: 8px; text-align: center; background-color: #fffbeb; color: #b45309; font-style: italic;">Break</td>`
      } else if (p) {
        const cellLessons = lessons.filter((l) => l.period_id === p.id)
        if (cellLessons.length === 0) {
          tableHtml += `<td style="padding: 8px; text-align: center; color: #cbd5e1;">—</td>`
        } else {
          tableHtml += `<td style="padding: 8px; vertical-align: top;">`
          for (const l of cellLessons) {
            const s = subjectMap.get(l.subject_id)
            const r = roomMap.get(l.room_id)
            const c = classMap.get(l.class_group_id)
            const prof = profileMap.get(l.teacher_id)

            tableHtml += `
              <div style="margin-bottom: 4px; border-left: 3px solid ${s?.color || "#1D4ED8"}; padding-left: 4px;">
                <strong style="color: #0f172a;">${s?.name || "Subject"} (${s?.code || ""})</strong><br/>
                <span style="font-size: 9.5pt; color: #334155;">${c?.name || "Class"} &bull; ${r?.name || "Room"}</span><br/>
                <span style="font-size: 9pt; color: #64748b;">${prof?.full_name || "Faculty"}</span>
              </div>
            `
          }
          tableHtml += `</td>`
        }
      }
    }
    tableHtml += `</tr>`
  }

  tableHtml += `</tbody></table>`

  const docContent = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <style>
        body { font-family: Calibri, Arial, sans-serif; margin: 20px; }
        h1 { color: #1D4ED8; font-size: 18pt; margin-bottom: 2px; }
        h2 { color: #0f172a; font-size: 14pt; margin-top: 0; margin-bottom: 4px; }
        p { color: #64748b; font-size: 10pt; margin-top: 0; margin-bottom: 16px; }
      </style>
    </head>
    <body>
      <h1>${institutionName}</h1>
      <h2>${title}</h2>
      <p>${subtitle} &bull; Generated on ${new Date().toLocaleDateString()}</p>
      ${tableHtml}
    </body>
    </html>
  `

  const blob = new Blob(["\ufeff" + docContent], { type: "application/msword;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${title.toLowerCase().replace(/[^a-z0-9]/g, "_")}_timetable.doc`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * 3. Download / Print Master Timetable Grid as PDF
 * Triggers native window.print() with print CSS for clean PDF export.
 */
export function downloadGridAsPdf() {
  window.print()
}
