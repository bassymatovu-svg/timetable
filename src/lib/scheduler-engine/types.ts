import type {
  Lesson,
  Period,
  Room,
  Subject,
  Teacher,
  ClassGroup,
  CurriculumRequirement,
  TeacherUnavailability,
  ConstraintsConfig,
} from "@/types/database"

export interface ConstraintViolation {
  code: string
  message: string
  severity: "hard" | "soft"
  lessonId?: string
  conflictingLessonId?: string
  entityType?: "teacher" | "room" | "class" | "period"
  entityId?: string
}

export interface EngineInputData {
  termId: string
  periods: Period[]
  rooms: Room[]
  subjects: Subject[]
  teachers: Teacher[]
  classGroups: ClassGroup[]
  curriculumRequirements: CurriculumRequirement[]
  teacherUnavailability: TeacherUnavailability[]
  constraintsConfig: ConstraintsConfig[]
  existingLessons?: Lesson[] // locked lessons to preserve
}

export interface ScheduledLessonSlot {
  id: string
  curriculumRequirementId: string
  termId: string
  classGroupId: string
  subjectId: string
  teacherId: string
  roomId?: string
  periodId?: string
  dayOfWeek?: number
  periodNumber?: number
  isDoublePart?: 1 | 2
  pairedSlotId?: string
  locked?: boolean
}

export interface EngineProgress {
  phase: "expanding" | "constructive" | "optimizing" | "completed" | "failed"
  percentage: number
  placedCount: number
  totalCount: number
  hardViolations: number
  softScore: number
  iteration?: number
  message: string
}

export interface EngineProgressCallback {
  (progress: EngineProgress): void
}

export interface EngineResult {
  success: boolean
  lessons: Lesson[]
  hardViolations: ConstraintViolation[]
  softViolations: ConstraintViolation[]
  softScore: number
  totalLessonsToPlace: number
  placedLessonsCount: number
  durationMs: number
  log: Record<string, unknown>
}
