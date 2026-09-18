export type UserRole =
  | "super_admin"
  | "school_admin"
  | "dept_head"
  | "teacher"
  | "viewer"

export interface Institution {
  id: string
  name: string
  timezone: string
  settings: Record<string, unknown>
  created_at: string
}

export interface Profile {
  id: string
  institution_id: string | null
  role: UserRole
  full_name: string
  email: string
  created_at: string
}

export interface Term {
  id: string
  institution_id: string
  name: string
  start_date: string
  end_date: string
  weeks_per_cycle: number // 1 = single week, 2 = A/B
}

export interface Period {
  id: string
  institution_id: string
  day_of_week: number // 1 (Mon) to 7 (Sun)
  period_number: number
  start_time: string // HH:mm or HH:mm:ss
  end_time: string
  is_break: boolean
}

export interface Room {
  id: string
  institution_id: string
  name: string
  capacity: number
  room_type: string // classroom, lab, gym, auditorium, etc.
  features: string[]
}

export interface Subject {
  id: string
  institution_id: string
  name: string
  code: string
  color: string // Hex code default '#475569'
  required_room_type: string | null
}

export interface Teacher {
  id: string // references Profile.id
  institution_id: string
  max_periods_per_day: number
  max_periods_per_week: number
  qualified_subject_ids: string[]
  // Joined field for convenience
  profile?: Profile
}

export interface TeacherUnavailability {
  id: string
  teacher_id: string
  period_id: string
  reason?: string | null
}

export interface ClassGroup {
  id: string
  institution_id: string
  name: string
  year_level: number | null
  size: number
}

export interface CurriculumRequirement {
  id: string
  term_id: string
  class_group_id: string
  subject_id: string
  teacher_id: string | null
  periods_per_week: number
  double_period: boolean
  // Populated fields
  class_group?: ClassGroup
  subject?: Subject
  teacher?: Teacher & { profile?: Profile }
}

export type ConstraintType = "hard" | "soft"

export interface ConstraintsConfig {
  id: string
  institution_id: string
  constraint_key: string
  constraint_type: ConstraintType
  enabled: boolean
  weight: number // 1-10, soft only
}

export interface Lesson {
  id: string
  term_id: string
  class_group_id: string
  subject_id: string
  teacher_id: string
  room_id: string
  period_id: string
  week_pattern: "all" | "A" | "B"
  locked: boolean
  // Populated references
  class_group?: ClassGroup
  subject?: Subject
  teacher?: Teacher & { profile?: Profile }
  room?: Room
  period?: Period
}

export type ImportSourceType = "curriculum_list" | "legacy_timetable"
export type ImportStatus = "processing" | "needs_review" | "committed" | "discarded"

export interface DraftImport {
  id: string
  institution_id: string
  term_id: string | null
  source_type: ImportSourceType
  original_filename: string
  status: ImportStatus
  uploaded_by: string | null
  created_at: string
}

export interface DraftImportRow {
  id: string
  draft_import_id: string
  raw_data: Record<string, unknown>
  matched_class_group_id: string | null
  matched_subject_id: string | null
  matched_teacher_id: string | null
  matched_room_id: string | null
  match_confidence: number | null // 0-1
  needs_manual_review: boolean
  resolved: boolean
  day_of_week: number | null
  period_number: number | null
  periods_per_week: number | null
  hard_conflict: boolean
  conflict_details: Record<string, unknown> | null
}

export type SubstitutionStatus = "pending" | "assigned" | "declined"

export interface Substitution {
  id: string
  lesson_id: string
  date: string // YYYY-MM-DD
  absent_teacher_id: string
  substitute_teacher_id: string | null
  status: SubstitutionStatus
  reason: string | null
  created_at: string
  // Populated fields
  lesson?: Lesson
  absent_teacher?: Teacher & { profile?: Profile }
  substitute_teacher?: (Teacher & { profile?: Profile }) | null
}

export interface GenerationRun {
  id: string
  term_id: string
  status: "running" | "completed" | "failed"
  hard_violations: number
  soft_score: number | null
  started_at: string
  completed_at: string | null
  log: Record<string, unknown> | null
}

export interface AuditLog {
  id: string
  institution_id: string
  user_id: string | null
  action: string
  entity: string
  entity_id: string | null
  diff: Record<string, unknown> | null
  created_at: string
}
