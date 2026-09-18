import type {
  Lesson,
  Period,
  Room,
  Subject,
  Teacher,
  ClassGroup,
  TeacherUnavailability,
} from "@/types/database"
import type { ConstraintViolation } from "../types"

export interface HardConstraintContext {
  periods: Period[]
  rooms: Room[]
  subjects: Subject[]
  teachers: Teacher[]
  classGroups: ClassGroup[]
  teacherUnavailability: TeacherUnavailability[]
}

/**
 * 1. A teacher cannot be scheduled in two places in the same period.
 */
export function validateTeacherNoDoubleBooking(
  candidate: Pick<Lesson, "id" | "teacher_id" | "period_id" | "week_pattern">,
  currentLessons: Lesson[]
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = []
  if (!candidate.teacher_id || !candidate.period_id) return violations

  const conflict = currentLessons.find(
    (l) =>
      l.id !== candidate.id &&
      l.teacher_id === candidate.teacher_id &&
      l.period_id === candidate.period_id &&
      (l.week_pattern === "all" ||
        candidate.week_pattern === "all" ||
        l.week_pattern === candidate.week_pattern)
  )

  if (conflict) {
    violations.push({
      code: "TEACHER_DOUBLE_BOOKED",
      message: "Teacher is already scheduled to teach another class in this period.",
      severity: "hard",
      lessonId: candidate.id,
      conflictingLessonId: conflict.id,
      entityType: "teacher",
      entityId: candidate.teacher_id,
    })
  }

  return violations
}

/**
 * 2. A room cannot be double-booked in the same period.
 */
export function validateRoomNoDoubleBooking(
  candidate: Pick<Lesson, "id" | "room_id" | "period_id" | "week_pattern">,
  currentLessons: Lesson[]
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = []
  if (!candidate.room_id || !candidate.period_id) return violations

  const conflict = currentLessons.find(
    (l) =>
      l.id !== candidate.id &&
      l.room_id === candidate.room_id &&
      l.period_id === candidate.period_id &&
      (l.week_pattern === "all" ||
        candidate.week_pattern === "all" ||
        l.week_pattern === candidate.week_pattern)
  )

  if (conflict) {
    violations.push({
      code: "ROOM_DOUBLE_BOOKED",
      message: "Room is already booked by another class in this period.",
      severity: "hard",
      lessonId: candidate.id,
      conflictingLessonId: conflict.id,
      entityType: "room",
      entityId: candidate.room_id,
    })
  }

  return violations
}

/**
 * 3. A class group cannot have two lessons in the same period.
 */
export function validateClassNoDoubleBooking(
  candidate: Pick<Lesson, "id" | "class_group_id" | "period_id" | "week_pattern">,
  currentLessons: Lesson[]
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = []
  if (!candidate.class_group_id || !candidate.period_id) return violations

  const conflict = currentLessons.find(
    (l) =>
      l.id !== candidate.id &&
      l.class_group_id === candidate.class_group_id &&
      l.period_id === candidate.period_id &&
      (l.week_pattern === "all" ||
        candidate.week_pattern === "all" ||
        l.week_pattern === candidate.week_pattern)
  )

  if (conflict) {
    violations.push({
      code: "CLASS_DOUBLE_BOOKED",
      message: "This class group already has another lesson scheduled in this period.",
      severity: "hard",
      lessonId: candidate.id,
      conflictingLessonId: conflict.id,
      entityType: "class",
      entityId: candidate.class_group_id,
    })
  }

  return violations
}

/**
 * 4. A teacher cannot be scheduled outside their declared availability.
 */
export function validateTeacherAvailability(
  candidate: Pick<Lesson, "id" | "teacher_id" | "period_id">,
  unavailabilityList: TeacherUnavailability[]
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = []
  if (!candidate.teacher_id || !candidate.period_id) return violations

  const isUnavailable = unavailabilityList.some(
    (u) => u.teacher_id === candidate.teacher_id && u.period_id === candidate.period_id
  )

  if (isUnavailable) {
    violations.push({
      code: "TEACHER_UNAVAILABLE",
      message: "Teacher is marked as unavailable during this period.",
      severity: "hard",
      lessonId: candidate.id,
      entityType: "teacher",
      entityId: candidate.teacher_id,
    })
  }

  return violations
}

/**
 * 5. A room must satisfy the subject's required room type and have sufficient capacity for class size.
 */
export function validateRoomTypeAndCapacity(
  candidate: Pick<Lesson, "id" | "room_id" | "subject_id" | "class_group_id">,
  context: HardConstraintContext
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = []
  if (!candidate.room_id) return violations

  const room = context.rooms.find((r) => r.id === candidate.room_id)
  const subject = context.subjects.find((s) => s.id === candidate.subject_id)
  const classGroup = context.classGroups.find((c) => c.id === candidate.class_group_id)

  if (!room) return violations

  // Capacity check
  if (classGroup && room.capacity < classGroup.size) {
    violations.push({
      code: "INSUFFICIENT_ROOM_CAPACITY",
      message: `Room capacity (${room.capacity}) is smaller than class size (${classGroup.size}).`,
      severity: "hard",
      lessonId: candidate.id,
      entityType: "room",
      entityId: candidate.room_id,
    })
  }

  // Specialist room type check
  if (subject?.required_room_type && subject.required_room_type !== "classroom") {
    if (room.room_type !== subject.required_room_type) {
      violations.push({
        code: "INCOMPATIBLE_ROOM_TYPE",
        message: `Subject ${subject.name} requires ${subject.required_room_type}, but room is ${room.room_type}.`,
        severity: "hard",
        lessonId: candidate.id,
        entityType: "room",
        entityId: candidate.room_id,
      })
    }
  }

  return violations
}

/**
 * 6. Break periods cannot have instructional lessons scheduled.
 */
export function validatePeriodNotBreak(
  candidate: Pick<Lesson, "id" | "period_id">,
  periods: Period[]
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = []
  const period = periods.find((p) => p.id === candidate.period_id)

  if (period?.is_break) {
    violations.push({
      code: "CANNOT_SCHEDULE_IN_BREAK",
      message: "Lessons cannot be scheduled into a break / lunch interval.",
      severity: "hard",
      lessonId: candidate.id,
      entityType: "period",
      entityId: candidate.period_id,
    })
  }

  return violations
}

/**
 * 7. A teacher cannot exceed their max periods per day or per week.
 */
export function validateTeacherLoadLimits(
  candidate: Pick<Lesson, "id" | "teacher_id" | "period_id">,
  currentLessons: Lesson[],
  context: HardConstraintContext
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = []
  if (!candidate.teacher_id || !candidate.period_id) return violations

  const teacher = context.teachers.find((t) => t.id === candidate.teacher_id)
  if (!teacher) return violations

  const candidatePeriod = context.periods.find((p) => p.id === candidate.period_id)
  if (!candidatePeriod) return violations

  // Lessons taught by this teacher (excluding candidate if it's an update)
  const teacherLessons = currentLessons.filter(
    (l) => l.id !== candidate.id && l.teacher_id === candidate.teacher_id
  )

  // Check weekly limit
  if (teacherLessons.length + 1 > teacher.max_periods_per_week) {
    violations.push({
      code: "TEACHER_WEEKLY_LIMIT_EXCEEDED",
      message: `Teacher exceeds maximum weekly teaching load (${teacher.max_periods_per_week} periods).`,
      severity: "hard",
      lessonId: candidate.id,
      entityType: "teacher",
      entityId: candidate.teacher_id,
    })
  }

  // Check daily limit
  const sameDayPeriodIds = new Set(
    context.periods
      .filter((p) => p.day_of_week === candidatePeriod.day_of_week)
      .map((p) => p.id)
  )

  const lessonsOnSameDay = teacherLessons.filter((l) => sameDayPeriodIds.has(l.period_id))
  if (lessonsOnSameDay.length + 1 > teacher.max_periods_per_day) {
    violations.push({
      code: "TEACHER_DAILY_LIMIT_EXCEEDED",
      message: `Teacher exceeds maximum daily teaching load (${teacher.max_periods_per_day} periods on day ${candidatePeriod.day_of_week}).`,
      severity: "hard",
      lessonId: candidate.id,
      entityType: "teacher",
      entityId: candidate.teacher_id,
    })
  }

  return violations
}

/**
 * Comprehensive master validator that checks ALL hard constraints simultaneously.
 * Used for both live drag-and-drop validation and constructive algorithm pruning.
 */
export function validateAllHardConstraints(
  candidate: Lesson,
  currentLessons: Lesson[],
  context: HardConstraintContext
): ConstraintViolation[] {
  return [
    ...validatePeriodNotBreak(candidate, context.periods),
    ...validateTeacherNoDoubleBooking(candidate, currentLessons),
    ...validateRoomNoDoubleBooking(candidate, currentLessons),
    ...validateClassNoDoubleBooking(candidate, currentLessons),
    ...validateTeacherAvailability(candidate, context.teacherUnavailability),
    ...validateRoomTypeAndCapacity(candidate, context),
    ...validateTeacherLoadLimits(candidate, currentLessons, context),
  ]
}
