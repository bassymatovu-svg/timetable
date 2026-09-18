import { describe, it, expect } from "vitest"
import { generateTimetable } from "../index"
import type { EngineInputData } from "../types"

describe("Scheduling Engine Generator Integration", () => {
  it("should generate a complete timetable with zero hard-constraint violations", () => {
    // 5 days x 5 periods = 25 periods (period 3 is lunch break)
    const periods = []
    for (let day = 1; day <= 5; day++) {
      for (let p = 1; p <= 5; p++) {
        periods.push({
          id: `p-d${day}-p${p}`,
          institution_id: "inst1",
          day_of_week: day,
          period_number: p,
          start_time: `0${7 + p}:00`,
          end_time: `0${7 + p}:45`,
          is_break: p === 3, // Lunch
        })
      }
    }

    const rooms = [
      { id: "r1", institution_id: "inst1", name: "Room 101", capacity: 32, room_type: "classroom", features: [] },
      { id: "r2", institution_id: "inst1", name: "Room 102", capacity: 32, room_type: "classroom", features: [] },
      { id: "r_lab", institution_id: "inst1", name: "Science Lab", capacity: 30, room_type: "lab", features: [] },
    ]

    const subjects = [
      { id: "s_math", institution_id: "inst1", name: "Math", code: "MATH", color: "#1e40af", required_room_type: "classroom" },
      { id: "s_sci", institution_id: "inst1", name: "Science", code: "SCI", color: "#0891b2", required_room_type: "lab" },
      { id: "s_eng", institution_id: "inst1", name: "English", code: "ENG", color: "#b45309", required_room_type: "classroom" },
    ]

    const teachers = [
      { id: "t_math", institution_id: "inst1", max_periods_per_day: 4, max_periods_per_week: 15, qualified_subject_ids: ["s_math"] },
      { id: "t_sci", institution_id: "inst1", max_periods_per_day: 4, max_periods_per_week: 15, qualified_subject_ids: ["s_sci"] },
      { id: "t_eng", institution_id: "inst1", max_periods_per_day: 4, max_periods_per_week: 15, qualified_subject_ids: ["s_eng"] },
    ]

    const classGroups = [
      { id: "cg_9a", institution_id: "inst1", name: "Grade 9A", year_level: 9, size: 25 },
      { id: "cg_9b", institution_id: "inst1", name: "Grade 9B", year_level: 9, size: 24 },
    ]

    const curriculumRequirements = [
      // 9A: Math 4, Science 3 (with double period), English 3
      { id: "cr1", term_id: "term1", class_group_id: "cg_9a", subject_id: "s_math", teacher_id: "t_math", periods_per_week: 4, double_period: false },
      { id: "cr2", term_id: "term1", class_group_id: "cg_9a", subject_id: "s_sci", teacher_id: "t_sci", periods_per_week: 3, double_period: true },
      { id: "cr3", term_id: "term1", class_group_id: "cg_9a", subject_id: "s_eng", teacher_id: "t_eng", periods_per_week: 3, double_period: false },

      // 9B: Math 4, Science 3, English 3
      { id: "cr4", term_id: "term1", class_group_id: "cg_9b", subject_id: "s_math", teacher_id: "t_math", periods_per_week: 4, double_period: false },
      { id: "cr5", term_id: "term1", class_group_id: "cg_9b", subject_id: "s_sci", teacher_id: "t_sci", periods_per_week: 3, double_period: false },
      { id: "cr6", term_id: "term1", class_group_id: "cg_9b", subject_id: "s_eng", teacher_id: "t_eng", periods_per_week: 3, double_period: false },
    ]

    const input: EngineInputData = {
      termId: "term1",
      periods,
      rooms,
      subjects,
      teachers,
      classGroups,
      curriculumRequirements,
      teacherUnavailability: [],
      constraintsConfig: [
        { id: "c1", institution_id: "inst1", constraint_key: "minimize_teacher_gaps", constraint_type: "soft", enabled: true, weight: 8 },
        { id: "c2", institution_id: "inst1", constraint_key: "minimize_student_gaps", constraint_type: "soft", enabled: true, weight: 9 },
      ],
    }

    const progressUpdates: any[] = []
    const result = generateTimetable(input, (p) => progressUpdates.push(p))

    expect(result.success).toBe(true)
    expect(result.hardViolations.length).toBe(0)
    expect(result.placedLessonsCount).toBe(20) // 10 periods for 9A + 10 periods for 9B
    expect(progressUpdates.length).toBeGreaterThan(0)
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
  })
})
