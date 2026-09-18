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
 * Generates an MSOffice-compliant Landscape XML/HTML document that opens
 * cleanly, centered, and fully scaled in Microsoft Word and Google Docs.
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

  const dayColWidth = 11 // 11%
  const periodColWidth = ((100 - dayColWidth) / Math.max(1, periodNumbers.length)).toFixed(2)

  let colgroupHtml = `<colgroup><col style="width: ${dayColWidth}%;" />`
  for (let i = 0; i < periodNumbers.length; i++) {
    colgroupHtml += `<col style="width: ${periodColWidth}%;" />`
  }
  colgroupHtml += `</colgroup>`

  let tableHtml = `
    <table align="center" border="1" cellpadding="0" cellspacing="0" style="border-collapse: collapse; width: 100%; max-width: 100%; margin-left: auto; margin-right: auto; table-layout: fixed; font-family: 'Segoe UI', Calibri, Arial, sans-serif; font-size: 8.5pt; border: 1.5px solid #0f172a;">
      ${colgroupHtml}
      <thead>
        <tr style="background-color: #1e3a8a; color: #ffffff; text-align: center;">
          <th style="padding: 8px 4px; background-color: #1e3a8a; color: #ffffff; font-size: 9pt; font-weight: bold; border: 1px solid #334155; text-align: center; vertical-align: middle;">
            Day / Period
          </th>
  `

  for (const pNum of periodNumbers) {
    const p = periods.find((period) => period.period_number === pNum)
    const isBreak = p?.is_break
    tableHtml += `
      <th style="padding: 6px 3px; background-color: ${isBreak ? "#78350f" : "#1e3a8a"}; color: #ffffff; border: 1px solid #334155; text-align: center; vertical-align: middle;">
        <div style="font-size: 9pt; font-weight: bold; color: #ffffff;">Period ${pNum}</div>
        <div style="font-size: 7.5pt; color: #cbd5e1; margin-top: 1px; font-weight: normal;">
          ${p?.start_time.substring(0, 5)} - ${p?.end_time.substring(0, 5)}
        </div>
      </th>
    `
  }
  tableHtml += `</tr></thead><tbody>`

  for (let dayIdx = 1; dayIdx <= 5; dayIdx++) {
    tableHtml += `
      <tr style="page-break-inside: avoid;">
        <td style="padding: 6px 4px; font-weight: bold; font-size: 9pt; background-color: #f8fafc; color: #0f172a; text-align: center; vertical-align: middle; border: 1px solid #94a3b8;">
          ${DAY_NAMES[dayIdx - 1]}
        </td>
    `

    for (const pNum of periodNumbers) {
      const p = periods.find((period) => period.day_of_week === dayIdx && period.period_number === pNum)

      if (p?.is_break) {
        tableHtml += `
          <td style="padding: 6px 2px; text-align: center; background-color: #fef3c7; color: #92400e; font-size: 8pt; font-weight: bold; vertical-align: middle; border: 1px solid #cbd5e1;">
            BREAK
          </td>
        `
      } else if (p) {
        const cellLessons = lessons.filter((l) => l.period_id === p.id)
        if (cellLessons.length === 0) {
          tableHtml += `
            <td style="padding: 6px 2px; text-align: center; color: #cbd5e1; font-size: 9pt; background-color: #ffffff; vertical-align: middle; border: 1px solid #e2e8f0;">
              &mdash;
            </td>
          `
        } else {
          tableHtml += `<td style="padding: 4px; vertical-align: top; background-color: #ffffff; border: 1px solid #cbd5e1;">`
          for (const l of cellLessons) {
            const s = subjectMap.get(l.subject_id)
            const r = roomMap.get(l.room_id)
            const c = classMap.get(l.class_group_id)
            const prof = profileMap.get(l.teacher_id)
            const borderCol = s?.color || "#1D4ED8"

            tableHtml += `
              <div style="margin-bottom: 3px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 3.5px solid ${borderCol}; padding: 3px 4px; text-align: left;">
                <div style="font-weight: bold; font-size: 8.5pt; color: #0f172a; line-height: 1.1;">${s?.code || "SUBJ"} <span style="font-weight: normal; color: #475569; font-size: 7.5pt;">(${s?.name || ""})</span></div>
                <div style="font-size: 7.5pt; font-weight: 600; color: #1e293b; margin-top: 1.5px;">${c?.name || "Class"} &bull; ${r?.name || "Room"}</div>
                <div style="font-size: 7pt; color: #64748b; margin-top: 1px;">${prof?.full_name || "Faculty"}</div>
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
    <html xmlns:o='urn:schemas-microsoft-com:office:office'
          xmlns:w='urn:schemas-microsoft-com:office:word'
          xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <!--[if gte mso 9]>
      <xml>
        <w:WordDocument>
          <w:View>Print</w:View>
          <w:Zoom>100</w:Zoom>
          <w:DoNotOptimizeForBrowser/>
        </w:WordDocument>
      </xml>
      <![endif]-->
      <style>
        @page Section1 {
          size: 11.69in 8.27in;
          mso-page-orientation: landscape;
          margin: 0.4in 0.4in 0.4in 0.4in;
          mso-header-margin: 0.25in;
          mso-footer-margin: 0.25in;
        }
        div.Section1 {
          page: Section1;
          width: 100%;
          margin: 0 auto;
        }
        body {
          font-family: 'Segoe UI', Calibri, Arial, sans-serif;
          margin: 0;
          padding: 0;
          background-color: #ffffff;
        }
      </style>
    </head>
    <body>
      <div class="Section1">
        <!-- Institutional Header Banner -->
        <table align="center" border="0" cellpadding="0" cellspacing="0" style="width: 100%; margin-bottom: 12px; border-bottom: 2.5px solid #1D4ED8; padding-bottom: 6px;">
          <tr>
            <td style="vertical-align: top; text-align: left;">
              <div style="font-size: 10.5pt; font-weight: bold; color: #1D4ED8; text-transform: uppercase; letter-spacing: 0.5px;">${institutionName}</div>
              <div style="font-size: 15pt; font-weight: bold; color: #0f172a; margin-top: 1px;">${title}</div>
              <div style="font-size: 9pt; color: #475569; margin-top: 1px;">${subtitle}</div>
            </td>
            <td style="vertical-align: top; text-align: right;">
              <div style="font-size: 9pt; font-weight: bold; color: #0f172a;">Official Academic Timetable</div>
              <div style="font-size: 8pt; color: #64748b; margin-top: 2px;">Generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</div>
              <div style="font-size: 7.5pt; color: #94a3b8; margin-top: 1px;">TimetableOS Scheduler</div>
            </td>
          </tr>
        </table>

        <!-- Table Matrix -->
        ${tableHtml}
      </div>
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
