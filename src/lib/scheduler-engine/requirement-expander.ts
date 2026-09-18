import type {
  CurriculumRequirement,
  Lesson,
  Teacher,
  Subject,
} from "@/types/database"
import type { ScheduledLessonSlot } from "./types"

/**
 * Expands curriculum_requirements into individual lesson slots to place.
 * Accounts for double periods and locked existing lessons.
 */
export function expandCurriculumRequirements(
  requirements: CurriculumRequirement[],
  teachers: Teacher[],
  subjects: Subject[],
  existingLockedLessons: Lesson[] = []
): {
  slotsToPlace: ScheduledLessonSlot[]
  lockedSlots: ScheduledLessonSlot[]
} {
  const slotsToPlace: ScheduledLessonSlot[] = []
  const lockedSlots: ScheduledLessonSlot[] = []

  // Track how many locked lessons exist per requirement
  const lockedCountPerReq = new Map<string, number>()
  for (const locked of existingLockedLessons) {
    lockedSlots.push({
      id: locked.id,
      curriculumRequirementId: "", // from existing
      termId: locked.term_id,
      classGroupId: locked.class_group_id,
      subjectId: locked.subject_id,
      teacherId: locked.teacher_id,
      roomId: locked.room_id,
      periodId: locked.period_id,
      locked: true,
    })
  }

  for (const req of requirements) {
    let teacherId = req.teacher_id

    // Fallback: If teacher is not pre-assigned, assign first qualified teacher
    if (!teacherId) {
      const qualified = teachers.find((t) =>
        t.qualified_subject_ids.includes(req.subject_id)
      )
      teacherId = qualified ? qualified.id : teachers[0]?.id || "unassigned"
    }

    let periodsRemaining = req.periods_per_week

    // Handle linked double period if enabled and >= 2 periods
    if (req.double_period && periodsRemaining >= 2) {
      const pairId1 = `slot-${req.id}-dp1`
      const pairId2 = `slot-${req.id}-dp2`

      slotsToPlace.push({
        id: pairId1,
        curriculumRequirementId: req.id,
        termId: req.term_id,
        classGroupId: req.class_group_id,
        subjectId: req.subject_id,
        teacherId,
        isDoublePart: 1,
        pairedSlotId: pairId2,
        locked: false,
      })

      slotsToPlace.push({
        id: pairId2,
        curriculumRequirementId: req.id,
        termId: req.term_id,
        classGroupId: req.class_group_id,
        subjectId: req.subject_id,
        teacherId,
        isDoublePart: 2,
        pairedSlotId: pairId1,
        locked: false,
      })

      periodsRemaining -= 2
    }

    // Remaining single periods
    for (let i = 1; i <= periodsRemaining; i++) {
      slotsToPlace.push({
        id: `slot-${req.id}-s${i}`,
        curriculumRequirementId: req.id,
        termId: req.term_id,
        classGroupId: req.class_group_id,
        subjectId: req.subject_id,
        teacherId,
        locked: false,
      })
    }
  }

  return { slotsToPlace, lockedSlots }
}
