import type { Lesson, Period, Subject, Room, Profile } from "@/types/database"

/**
 * Generates an RFC 5545 compliant iCalendar (.ics) string from timetable lessons.
 */
export function generateIcsCalendar({
  lessons,
  periods,
  subjects,
  rooms,
  profiles,
  calendarTitle = "Timetable Schedule",
  startDate = new Date(),
}: {
  lessons: Lesson[]
  periods: Period[]
  subjects: Subject[]
  rooms: Room[]
  profiles: Profile[]
  calendarTitle?: string
  startDate?: Date
}): string {
  const periodMap = new Map(periods.map((p) => [p.id, p]))
  const subjectMap = new Map(subjects.map((s) => [s.id, s]))
  const roomMap = new Map(rooms.map((r) => [r.id, r]))
  const profileMap = new Map(profiles.map((p) => [p.id, p]))

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TimetableOS//Institutional Scheduler//EN",
    `X-WR-CALNAME:${calendarTitle}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ]

  // Find Monday of the current or target week
  const monday = new Date(startDate)
  const day = monday.getDay()
  const diff = monday.getDate() - day + (day === 0 ? -6 : 1) // adjust when day is sunday
  monday.setDate(diff)
  monday.setHours(0, 0, 0, 0)

  for (const lesson of lessons) {
    const p = periodMap.get(lesson.period_id)
    if (!p) continue

    const subj = subjectMap.get(lesson.subject_id)
    const room = roomMap.get(lesson.room_id)
    const teacherProfile = profileMap.get(lesson.teacher_id)

    // Calculate event date for this lesson's day of week (day_of_week 1 = Monday)
    const eventDate = new Date(monday)
    eventDate.setDate(monday.getDate() + (p.day_of_week - 1))

    const [startH, startM] = p.start_time.split(":").map(Number)
    const [endH, endM] = p.end_time.split(":").map(Number)

    const dtStart = new Date(eventDate)
    dtStart.setHours(startH, startM, 0, 0)

    const dtEnd = new Date(eventDate)
    dtEnd.setHours(endH, endM, 0, 0)

    const formatIcsTime = (d: Date) =>
      d
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}/, "")

    lines.push("BEGIN:VEVENT")
    lines.push(`UID:lesson-${lesson.id}@timetableos.org`)
    lines.push(`DTSTAMP:${formatIcsTime(new Date())}`)
    lines.push(`DTSTART:${formatIcsTime(dtStart)}`)
    lines.push(`DTEND:${formatIcsTime(dtEnd)}`)
    lines.push(`RRULE:FREQ=WEEKLY;COUNT=16`) // Repeat throughout semester
    lines.push(`SUMMARY:${subj?.name || "Lesson"} (${subj?.code || "SUBJ"})`)
    lines.push(
      `DESCRIPTION:Instructor: ${teacherProfile?.full_name || "Faculty"}\\nRoom: ${
        room?.name || "TBA"
      }`
    )
    lines.push(`LOCATION:${room?.name || "Classroom"}`)
    lines.push("END:VEVENT")
  }

  lines.push("END:VCALENDAR")
  return lines.join("\r\n")
}

/**
 * Triggers a browser download of an .ics calendar file
 */
export function downloadIcsFile(filename: string, icsContent: string) {
  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename.endsWith(".ics") ? filename : `${filename}.ics`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
