import * as XLSX from "xlsx"
import type { Lesson, Period, Room, Subject, Teacher, ClassGroup, Profile } from "@/types/database"

export function exportTimetableToExcel({
  lessons,
  periods,
  rooms,
  subjects,
  teachers,
  profiles,
  classGroups,
  institutionName = "Institution",
}: {
  lessons: Lesson[]
  periods: Period[]
  rooms: Room[]
  subjects: Subject[]
  teachers: Teacher[]
  profiles: Profile[]
  classGroups: ClassGroup[]
  institutionName?: string
}) {
  const periodMap = new Map(periods.map((p) => [p.id, p]))
  const roomMap = new Map(rooms.map((r) => [r.id, r]))
  const subjectMap = new Map(subjects.map((s) => [s.id, s]))
  const classMap = new Map(classGroups.map((c) => [c.id, c]))
  const profileMap = new Map(profiles.map((p) => [p.id, p]))

  const DAY_NAMES = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

  // Sheet 1: Master Schedule Rows
  const masterRows = lessons.map((l) => {
    const p = periodMap.get(l.period_id)
    const s = subjectMap.get(l.subject_id)
    const r = roomMap.get(l.room_id)
    const c = classMap.get(l.class_group_id)
    const prof = profileMap.get(l.teacher_id)

    return {
      Day: p ? DAY_NAMES[p.day_of_week] : "",
      "Period Number": p ? p.period_number : "",
      "Start Time": p ? p.start_time.substring(0, 5) : "",
      "End Time": p ? p.end_time.substring(0, 5) : "",
      "Class Cohort": c ? c.name : "",
      "Subject Code": s ? s.code : "",
      "Subject Name": s ? s.name : "",
      "Faculty Instructor": prof ? prof.full_name : "",
      "Room / Facility": r ? r.name : "",
      "Room Type": r ? r.room_type : "",
      Locked: l.locked ? "Yes" : "No",
    }
  })

  // Sort by Day and Period
  masterRows.sort((a, b) => {
    if (a.Day !== b.Day) return a.Day.localeCompare(b.Day)
    return Number(a["Period Number"]) - Number(b["Period Number"])
  })

  // Sheet 2: Teacher Workload
  const teacherRows = teachers.map((t) => {
    const prof = profileMap.get(t.id)
    const assignedCount = lessons.filter((l) => l.teacher_id === t.id).length
    const utilRate = t.max_periods_per_week > 0
      ? Math.round((assignedCount / t.max_periods_per_week) * 100)
      : 0

    return {
      "Faculty Name": prof ? prof.full_name : t.id,
      Email: prof ? prof.email : "",
      "Assigned Periods / Week": assignedCount,
      "Weekly Load Limit": t.max_periods_per_week,
      "Daily Load Limit": t.max_periods_per_day,
      "Utilization Rate": `${utilRate}%`,
    }
  })

  // Sheet 3: Room Utilization
  const instructionalPeriodCount = periods.filter((p) => !p.is_break).length
  const roomRows = rooms.map((r) => {
    const bookedCount = lessons.filter((l) => l.room_id === r.id).length
    const utilRate = instructionalPeriodCount > 0
      ? Math.round((bookedCount / instructionalPeriodCount) * 100)
      : 0

    return {
      "Room Name": r.name,
      Classification: r.room_type,
      "Seating Capacity": r.capacity,
      "Periods Booked": bookedCount,
      "Available Periods": instructionalPeriodCount,
      "Utilization Rate": `${utilRate}%`,
    }
  })

  // Build Workbook
  const wb = XLSX.utils.book_new()
  const wsMaster = XLSX.utils.json_to_sheet(masterRows)
  const wsTeachers = XLSX.utils.json_to_sheet(teacherRows)
  const wsRooms = XLSX.utils.json_to_sheet(roomRows)

  XLSX.utils.book_append_sheet(wb, wsMaster, "Master Schedule")
  XLSX.utils.book_append_sheet(wb, wsTeachers, "Teacher Workload")
  XLSX.utils.book_append_sheet(wb, wsRooms, "Room Utilization")

  const filename = `${institutionName.toLowerCase().replace(/\s+/g, "_")}_timetable_${new Date().toISOString().substring(0, 10)}.xlsx`
  XLSX.writeFile(wb, filename)
}
