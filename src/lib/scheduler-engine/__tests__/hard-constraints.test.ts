import { describe, it, expect } from "vitest"
import {
  validateTeacherNoDoubleBooking,
  validateRoomNoDoubleBooking,
  validateClassNoDoubleBooking,
  validateTeacherAvailability,
  validateRoomTypeAndCapacity,
  validatePeriodNotBreak,
  validateTeacherLoadLimits,
  type HardConstraintContext,
} from "../validators/hard-constraints"
import type { Lesson, Period, Room, Subject, Teacher, ClassGroup, TeacherUnavailability } from "@/types/database"

describe("Hard Constraint Validators", () => {
  const mockPeriods: Period[] = [
    { id: "p1", institution_id: "inst1", day_of_week: 1, period_number: 1, start_time: "08:00", end_time: "08:50", is_break: false },
    { id: "p2", institution_id: "inst1", day_of_week: 1, period_number: 2, start_time: "08:55", end_time: "09:45", is_break: false },
    { id: "p3_break", institution_id: "inst1", day_of_week: 1, period_number: 3, start_time: "09:50", end_time: "10:30", is_break: true },
  ]

  const mockRooms: Room[] = [
    { id: "r_standard", institution_id: "inst1", name: "Room 101", capacity: 30, room_type: "classroom", features: [] },
    { id: "r_small", institution_id: "inst1", name: "Small Room", capacity: 20, room_type: "classroom", features: [] },
    { id: "r_lab", institution_id: "inst1", name: "Science Lab", capacity: 30, room_type: "lab", features: [] },
  ]

  const mockSubjects: Subject[] = [
    { id: "s_math", institution_id: "inst1", name: "Math", code: "MATH", color: "#000", required_room_type: "classroom" },
    { id: "s_phys", institution_id: "inst1", name: "Physics", code: "PHYS", color: "#000", required_room_type: "lab" },
  ]

  const mockTeachers: Teacher[] = [
    { id: "t1", institution_id: "inst1", max_periods_per_day: 2, max_periods_per_week: 5, qualified_subject_ids: ["s_math"] },
  ]

  const mockClassGroups: ClassGroup[] = [
    { id: "cg_large", institution_id: "inst1", name: "Class 10A", year_level: 10, size: 28 },
    { id: "cg_small", institution_id: "inst1", name: "Class 10B", year_level: 10, size: 18 },
  ]

  const mockContext: HardConstraintContext = {
    periods: mockPeriods,
    rooms: mockRooms,
    subjects: mockSubjects,
    teachers: mockTeachers,
    classGroups: mockClassGroups,
    teacherUnavailability: [],
  }

  it("1. should flag teacher double-booking", () => {
    const existing: Lesson[] = [
      {
        id: "l1",
        term_id: "t1",
        class_group_id: "cg_small",
        subject_id: "s_math",
        teacher_id: "t1",
        room_id: "r_standard",
        period_id: "p1",
        week_pattern: "all",
        locked: false,
      },
    ]

    // Attempt to schedule same teacher in same period
    const candidate: Lesson = {
      id: "l2",
      term_id: "t1",
      class_group_id: "cg_large",
      subject_id: "s_math",
      teacher_id: "t1",
      room_id: "r_lab",
      period_id: "p1",
      week_pattern: "all",
      locked: false,
    }

    const violations = validateTeacherNoDoubleBooking(candidate, existing)
    expect(violations.length).toBe(1)
    expect(violations[0].code).toBe("TEACHER_DOUBLE_BOOKED")

    // In different period, should be legal
    const validCandidate = { ...candidate, period_id: "p2" }
    expect(validateTeacherNoDoubleBooking(validCandidate, existing).length).toBe(0)
  })

  it("2. should flag room double-booking", () => {
    const existing: Lesson[] = [
      {
        id: "l1",
        term_id: "t1",
        class_group_id: "cg_small",
        subject_id: "s_math",
        teacher_id: "t1",
        room_id: "r_standard",
        period_id: "p1",
        week_pattern: "all",
        locked: false,
      },
    ]

    const candidate: Lesson = {
      id: "l2",
      term_id: "t1",
      class_group_id: "cg_large",
      subject_id: "s_phys",
      teacher_id: "t2_other",
      room_id: "r_standard", // Same room
      period_id: "p1", // Same period
      week_pattern: "all",
      locked: false,
    }

    const violations = validateRoomNoDoubleBooking(candidate, existing)
    expect(violations.length).toBe(1)
    expect(violations[0].code).toBe("ROOM_DOUBLE_BOOKED")
  })

  it("3. should flag class cohort double-booking", () => {
    const existing: Lesson[] = [
      {
        id: "l1",
        term_id: "t1",
        class_group_id: "cg_large",
        subject_id: "s_math",
        teacher_id: "t1",
        room_id: "r_standard",
        period_id: "p1",
        week_pattern: "all",
        locked: false,
      },
    ]

    const candidate: Lesson = {
      id: "l2",
      term_id: "t1",
      class_group_id: "cg_large", // Same class
      subject_id: "s_phys",
      teacher_id: "t2",
      room_id: "r_lab",
      period_id: "p1", // Same period
      week_pattern: "all",
      locked: false,
    }

    const violations = validateClassNoDoubleBooking(candidate, existing)
    expect(violations.length).toBe(1)
    expect(violations[0].code).toBe("CLASS_DOUBLE_BOOKED")
  })

  it("4. should enforce declared teacher unavailability", () => {
    const unavail: TeacherUnavailability[] = [
      { id: "u1", teacher_id: "t1", period_id: "p1", reason: "Medical leave" },
    ]

    const candidate: Lesson = {
      id: "l1",
      term_id: "t1",
      class_group_id: "cg_large",
      subject_id: "s_math",
      teacher_id: "t1",
      room_id: "r_standard",
      period_id: "p1", // Blocked period
      week_pattern: "all",
      locked: false,
    }

    const violations = validateTeacherAvailability(candidate, unavail)
    expect(violations.length).toBe(1)
    expect(violations[0].code).toBe("TEACHER_UNAVAILABLE")

    const validCandidate = { ...candidate, period_id: "p2" }
    expect(validateTeacherAvailability(validCandidate, unavail).length).toBe(0)
  })

  it("5. should reject room with insufficient capacity or wrong type", () => {
    // Insufficient capacity: class size 28 in room of 20
    const candidateTooSmall: Lesson = {
      id: "l1",
      term_id: "t1",
      class_group_id: "cg_large", // size 28
      subject_id: "s_math",
      teacher_id: "t1",
      room_id: "r_small", // capacity 20
      period_id: "p1",
      week_pattern: "all",
      locked: false,
    }

    const capacityViolations = validateRoomTypeAndCapacity(candidateTooSmall, mockContext)
    expect(capacityViolations.some((v) => v.code === "INSUFFICIENT_ROOM_CAPACITY")).toBe(true)

    // Wrong room type: Physics requires 'lab', standard is 'classroom'
    const candidateWrongType: Lesson = {
      id: "l2",
      term_id: "t1",
      class_group_id: "cg_small",
      subject_id: "s_phys", // requires lab
      teacher_id: "t1",
      room_id: "r_standard", // is classroom
      period_id: "p1",
      week_pattern: "all",
      locked: false,
    }

    const typeViolations = validateRoomTypeAndCapacity(candidateWrongType, mockContext)
    expect(typeViolations.some((v) => v.code === "INCOMPATIBLE_ROOM_TYPE")).toBe(true)
  })

  it("6. should reject placing lessons into designated breaks", () => {
    const candidateInBreak: Lesson = {
      id: "l1",
      term_id: "t1",
      class_group_id: "cg_small",
      subject_id: "s_math",
      teacher_id: "t1",
      room_id: "r_standard",
      period_id: "p3_break",
      week_pattern: "all",
      locked: false,
    }

    const violations = validatePeriodNotBreak(candidateInBreak, mockPeriods)
    expect(violations.length).toBe(1)
    expect(violations[0].code).toBe("CANNOT_SCHEDULE_IN_BREAK")
  })

  it("7. should enforce teacher daily and weekly load limits", () => {
    // Teacher t1 has max 2 periods/day
    const existingLessonsOnDay1: Lesson[] = [
      { id: "e1", term_id: "t1", class_group_id: "cg_small", subject_id: "s_math", teacher_id: "t1", room_id: "r_standard", period_id: "p1", week_pattern: "all", locked: false },
      { id: "e2", term_id: "t1", class_group_id: "cg_small", subject_id: "s_math", teacher_id: "t1", room_id: "r_standard", period_id: "p2", week_pattern: "all", locked: false },
    ]

    // Attempting 3rd period on day 1
    const extraPeriod: Period = {
      id: "p4_day1",
      institution_id: "inst1",
      day_of_week: 1,
      period_number: 4,
      start_time: "11:00",
      end_time: "11:50",
      is_break: false,
    }
    const contextWithP4 = {
      ...mockContext,
      periods: [...mockPeriods, extraPeriod],
    }

    const candidateExceeding: Lesson = {
      id: "l3",
      term_id: "t1",
      class_group_id: "cg_small",
      subject_id: "s_math",
      teacher_id: "t1",
      room_id: "r_standard",
      period_id: "p4_day1",
      week_pattern: "all",
      locked: false,
    }

    const violations = validateTeacherLoadLimits(candidateExceeding, existingLessonsOnDay1, contextWithP4)
    expect(violations.length).toBe(1)
    expect(violations[0].code).toBe("TEACHER_DAILY_LIMIT_EXCEEDED")
  })
})
