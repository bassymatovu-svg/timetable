import { describe, it, expect } from "vitest"
import {
  timeToMinutes,
  minutesToTime,
  calculateEndTime,
  doTimesOverlap,
  validateAssessmentSession,
} from "../assessment-validator"
import type {
  AssessmentSession,
  Room,
  Teacher,
  Profile,
  ClassGroup,
} from "@/types/database"

describe("Assessment Validator & Helper Functions", () => {
  describe("Time utilities", () => {
    it("should convert time string to minutes from midnight", () => {
      expect(timeToMinutes("00:00")).toBe(0)
      expect(timeToMinutes("09:00")).toBe(540)
      expect(timeToMinutes("14:30")).toBe(870)
    })

    it("should convert minutes to formatted time string", () => {
      expect(minutesToTime(0)).toBe("00:00")
      expect(minutesToTime(540)).toBe("09:00")
      expect(minutesToTime(870)).toBe("14:30")
    })

    it("should calculate end time from start time and duration", () => {
      expect(calculateEndTime("09:00", 60)).toBe("10:00")
      expect(calculateEndTime("09:00", 90)).toBe("10:30")
      expect(calculateEndTime("09:00", 120)).toBe("11:00")
      expect(calculateEndTime("13:30", 45)).toBe("14:15")
    })

    it("should correctly detect time overlaps", () => {
      // Overlapping intervals
      expect(doTimesOverlap("09:00", "11:00", "10:00", "12:00")).toBe(true)
      expect(doTimesOverlap("09:00", "11:00", "09:30", "10:30")).toBe(true)
      expect(doTimesOverlap("09:30", "10:30", "09:00", "11:00")).toBe(true)

      // Adjacent (contiguous) intervals do NOT overlap
      expect(doTimesOverlap("09:00", "10:00", "10:00", "11:00")).toBe(false)
      expect(doTimesOverlap("11:00", "12:00", "09:00", "10:00")).toBe(false)
    })
  })

  describe("validateAssessmentSession", () => {
    const mockRooms: Room[] = [
      { id: "r1", institution_id: "inst1", name: "Hall A", capacity: 50, room_type: "auditorium", features: [] },
      { id: "r2", institution_id: "inst1", name: "Room 101", capacity: 25, room_type: "classroom", features: [] },
    ]

    const mockProfiles: Profile[] = [
      { id: "t1", institution_id: "inst1", role: "teacher", full_name: "Dr. Vance", email: "vance@oakwood.edu", created_at: "" },
      { id: "t2", institution_id: "inst1", role: "teacher", full_name: "Sarah Jenkins", email: "jenkins@oakwood.edu", created_at: "" },
    ]

    const mockTeachers: Teacher[] = [
      { id: "t1", institution_id: "inst1", max_periods_per_day: 5, max_periods_per_week: 20, qualified_subject_ids: [] },
      { id: "t2", institution_id: "inst1", max_periods_per_day: 5, max_periods_per_week: 20, qualified_subject_ids: [] },
    ]

    const mockClassGroups: ClassGroup[] = [
      { id: "cg1", institution_id: "inst1", name: "Grade 9A", year_level: 9, size: 30 },
      { id: "cg2", institution_id: "inst1", name: "Grade 9B", year_level: 9, size: 25 },
    ]

    const existingSessions: AssessmentSession[] = [
      {
        id: "sess1",
        institution_id: "inst1",
        term_id: "term1",
        type: "exam",
        title: "Existing Exam",
        subject_id: "sub1",
        class_group_ids: ["cg1"],
        date: "2026-10-15",
        start_time: "09:00",
        duration_minutes: 120,
        end_time: "11:00",
        room_ids: ["r1"],
        supervisor_ids: ["t1"],
        chief_supervisor_id: "t1",
        status: "scheduled",
        created_at: "",
      },
    ]

    const context = {
      existingSessions,
      rooms: mockRooms,
      teachers: mockTeachers,
      profiles: mockProfiles,
      classGroups: mockClassGroups,
    }

    it("should flag room double-booking clash on the same date and overlapping time", () => {
      const candidate: Partial<AssessmentSession> = {
        id: "candidate-1",
        type: "exam",
        title: "Clashing Exam",
        date: "2026-10-15",
        start_time: "10:00",
        duration_minutes: 60,
        end_time: "11:00",
        room_ids: ["r1"], // Same room!
        supervisor_ids: ["t2"],
        class_group_ids: ["cg2"],
      }

      const { isValid, conflicts } = validateAssessmentSession(candidate, context)
      expect(isValid).toBe(false)
      expect(conflicts.some((c) => c.type === "room_clash")).toBe(true)
    })

    it("should allow same room on same date if times do not overlap", () => {
      const candidate: Partial<AssessmentSession> = {
        id: "candidate-2",
        type: "exam",
        title: "Afternoon Exam",
        date: "2026-10-15",
        start_time: "11:30", // After 11:00
        duration_minutes: 60,
        end_time: "12:30",
        room_ids: ["r1"],
        supervisor_ids: ["t2"],
        class_group_ids: ["cg2"],
      }

      const { isValid, conflicts } = validateAssessmentSession(candidate, context)
      expect(isValid).toBe(true)
      expect(conflicts.some((c) => c.type === "room_clash")).toBe(false)
    })

    it("should flag supervisor double-booking clash on overlapping time", () => {
      const candidate: Partial<AssessmentSession> = {
        id: "candidate-3",
        type: "test",
        title: "Clashing Test",
        date: "2026-10-15",
        start_time: "09:30",
        duration_minutes: 45,
        end_time: "10:15",
        room_ids: ["r2"], // Different room
        supervisor_ids: ["t1"], // Same supervisor!
        class_group_ids: ["cg2"],
      }

      const { isValid, conflicts } = validateAssessmentSession(candidate, context)
      expect(isValid).toBe(false)
      expect(conflicts.some((c) => c.type === "supervisor_clash")).toBe(true)
    })

    it("should warn when class enrollment exceeds booked room capacity", () => {
      const candidate: Partial<AssessmentSession> = {
        id: "candidate-4",
        type: "exam",
        title: "Overcapacity Exam",
        date: "2026-10-20",
        start_time: "09:00",
        duration_minutes: 90,
        end_time: "10:30",
        room_ids: ["r2"], // Room 101 capacity = 25
        supervisor_ids: ["t2"],
        class_group_ids: ["cg1"], // Class 9A size = 30 > 25
      }

      const { conflicts } = validateAssessmentSession(candidate, context)
      expect(conflicts.some((c) => c.type === "capacity_exceeded")).toBe(true)
    })
  })
})
