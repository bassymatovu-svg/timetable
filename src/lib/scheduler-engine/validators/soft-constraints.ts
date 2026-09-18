import type {
  Lesson,
  Period,
  Subject,
  Teacher,
  ClassGroup,
  ConstraintsConfig,
} from "@/types/database"
import type { ConstraintViolation } from "../types"

export interface SoftConstraintContext {
  periods: Period[]
  subjects: Subject[]
  teachers: Teacher[]
  classGroups: ClassGroup[]
  constraintsConfig: ConstraintsConfig[]
}

/**
 * Helper to group lessons by day
 */
function getLessonsByDay(lessons: Lesson[], periods: Period[]): Map<number, Lesson[]> {
  const periodMap = new Map(periods.map((p) => [p.id, p]))
  const dayMap = new Map<number, Lesson[]>()

  for (const l of lessons) {
    const p = periodMap.get(l.period_id)
    if (p) {
      const list = dayMap.get(p.day_of_week) || []
      list.push(l)
      dayMap.set(p.day_of_week, list)
    }
  }

  return dayMap
}

/**
 * 1. Minimize gaps/free periods in teacher schedules.
 */
export function scoreTeacherGaps(
  lessons: Lesson[],
  context: SoftConstraintContext
): number {
  let penalty = 0
  const periodMap = new Map(context.periods.map((p) => [p.id, p]))

  for (const teacher of context.teachers) {
    const tLessons = lessons.filter((l) => l.teacher_id === teacher.id)
    const dayMap = getLessonsByDay(tLessons, context.periods)

    for (const [day, dLessons] of dayMap.entries()) {
      if (dLessons.length <= 1) continue
      const sortedPeriods = dLessons
        .map((l) => periodMap.get(l.period_id)?.period_number || 0)
        .sort((a, b) => a - b)

      const minPeriod = sortedPeriods[0]
      const maxPeriod = sortedPeriods[sortedPeriods.length - 1]
      const span = maxPeriod - minPeriod + 1
      const gaps = span - sortedPeriods.length
      if (gaps > 0) {
        penalty += gaps * 10
      }
    }
  }

  return penalty
}

/**
 * 2. Minimize gaps in student/class schedules.
 */
export function scoreStudentGaps(
  lessons: Lesson[],
  context: SoftConstraintContext
): number {
  let penalty = 0
  const periodMap = new Map(context.periods.map((p) => [p.id, p]))

  for (const cg of context.classGroups) {
    const cLessons = lessons.filter((l) => l.class_group_id === cg.id)
    const dayMap = getLessonsByDay(cLessons, context.periods)

    for (const [day, dLessons] of dayMap.entries()) {
      if (dLessons.length <= 1) continue
      const sortedPeriods = dLessons
        .map((l) => periodMap.get(l.period_id)?.period_number || 0)
        .sort((a, b) => a - b)

      const minPeriod = sortedPeriods[0]
      const maxPeriod = sortedPeriods[sortedPeriods.length - 1]
      const span = maxPeriod - minPeriod + 1
      const gaps = span - sortedPeriods.length
      if (gaps > 0) {
        penalty += gaps * 15 // Student gaps are heavily discouraged
      }
    }
  }

  return penalty
}

/**
 * 3. Spread a subject's periods evenly across the week rather than clustering.
 */
export function scoreSubjectSpread(
  lessons: Lesson[],
  context: SoftConstraintContext
): number {
  let penalty = 0
  const periodMap = new Map(context.periods.map((p) => [p.id, p]))

  for (const cg of context.classGroups) {
    for (const subj of context.subjects) {
      const match = lessons.filter(
        (l) => l.class_group_id === cg.id && l.subject_id === subj.id
      )
      if (match.length <= 1) continue

      // Count occurrences per day
      const dayCounts = new Map<number, number>()
      for (const l of match) {
        const p = periodMap.get(l.period_id)
        if (p) {
          dayCounts.set(p.day_of_week, (dayCounts.get(p.day_of_week) || 0) + 1)
        }
      }

      // If a subject occurs more than 2 times on the same day, penalize
      for (const [day, count] of dayCounts.entries()) {
        if (count > 2) {
          penalty += (count - 1) * 20
        }
      }
    }
  }

  return penalty
}

/**
 * 4. Avoid placing demanding subjects (e.g. Math, Physics, Chemistry) in the last period of the day.
 */
export function scoreDemandingSubjectLast(
  lessons: Lesson[],
  context: SoftConstraintContext
): number {
  let penalty = 0
  const demandingCodes = new Set(["MATH", "PHYS", "CHEM"])
  const demandingSubjectIds = new Set(
    context.subjects.filter((s) => demandingCodes.has(s.code)).map((s) => s.id)
  )

  const periodMap = new Map(context.periods.map((p) => [p.id, p]))
  const maxPeriodNumber = Math.max(...context.periods.map((p) => p.period_number))

  for (const l of lessons) {
    if (demandingSubjectIds.has(l.subject_id)) {
      const p = periodMap.get(l.period_id)
      if (p && p.period_number === maxPeriodNumber) {
        penalty += 15
      }
    }
  }

  return penalty
}

/**
 * 5. Balance each teacher's workload across the week.
 */
export function scoreTeacherWorkloadBalance(
  lessons: Lesson[],
  context: SoftConstraintContext
): number {
  let penalty = 0
  const periodMap = new Map(context.periods.map((p) => [p.id, p]))

  for (const teacher of context.teachers) {
    const tLessons = lessons.filter((l) => l.teacher_id === teacher.id)
    if (tLessons.length < 5) continue

    const dayCounts = [0, 0, 0, 0, 0]
    for (const l of tLessons) {
      const p = periodMap.get(l.period_id)
      if (p && p.day_of_week >= 1 && p.day_of_week <= 5) {
        dayCounts[p.day_of_week - 1]++
      }
    }

    const min = Math.min(...dayCounts)
    const max = Math.max(...dayCounts)
    if (max - min >= 3) {
      penalty += (max - min) * 8
    }
  }

  return penalty
}

/**
 * 6. Minimize room hopping across consecutive periods.
 */
export function scoreRoomChanges(
  lessons: Lesson[],
  context: SoftConstraintContext
): number {
  let penalty = 0
  const periodMap = new Map(context.periods.map((p) => [p.id, p]))

  for (const cg of context.classGroups) {
    const cLessons = lessons.filter((l) => l.class_group_id === cg.id)
    const dayMap = getLessonsByDay(cLessons, context.periods)

    for (const [day, dLessons] of dayMap.entries()) {
      if (dLessons.length <= 1) continue
      const sorted = [...dLessons].sort(
        (a, b) =>
          (periodMap.get(a.period_id)?.period_number || 0) -
          (periodMap.get(b.period_id)?.period_number || 0)
      )

      for (let i = 0; i < sorted.length - 1; i++) {
        const p1 = periodMap.get(sorted[i].period_id)
        const p2 = periodMap.get(sorted[i + 1].period_id)
        // If consecutive periods
        if (p1 && p2 && p2.period_number === p1.period_number + 1) {
          if (sorted[i].room_id !== sorted[i + 1].room_id) {
            penalty += 5
          }
        }
      }
    }
  }

  return penalty
}

/**
 * Comprehensive soft constraint evaluator that returns a weighted overall score.
 * Lower total score is better.
 */
export function evaluateTotalSoftScore(
  lessons: Lesson[],
  context: SoftConstraintContext
): { totalScore: number; breakdown: Record<string, number> } {
  const weights = new Map(
    context.constraintsConfig.map((c) => [c.constraint_key, c.enabled ? c.weight : 0])
  )

  const rawScores: Record<string, number> = {
    minimize_teacher_gaps: scoreTeacherGaps(lessons, context),
    minimize_student_gaps: scoreStudentGaps(lessons, context),
    spread_subject_evenly: scoreSubjectSpread(lessons, context),
    avoid_demanding_subject_last: scoreDemandingSubjectLast(lessons, context),
    balance_teacher_workload: scoreTeacherWorkloadBalance(lessons, context),
    minimize_room_changes: scoreRoomChanges(lessons, context),
  }

  let totalScore = 0
  const weightedBreakdown: Record<string, number> = {}

  for (const [key, raw] of Object.entries(rawScores)) {
    const weight = weights.get(key) ?? 5
    const weighted = raw * (weight / 5)
    weightedBreakdown[key] = Math.round(weighted)
    totalScore += weighted
  }

  return { totalScore: Math.round(totalScore), breakdown: weightedBreakdown }
}
