import { create } from "zustand"
import { persist } from "zustand/middleware"
import type {
  Institution,
  Profile,
  Term,
  Period,
  Room,
  Subject,
  Teacher,
  TeacherUnavailability,
  ClassGroup,
  CurriculumRequirement,
  ConstraintsConfig,
  Lesson,
  DraftImport,
  DraftImportRow,
  Substitution,
  GenerationRun,
  AuditLog,
  UserRole,
  AssessmentSession,
} from "@/types/database"

interface DataStoreState {
  // Current active institution and session
  currentInstitutionId: string
  currentProfile: Profile
  availableInstitutions: Institution[]

  // Core entities
  institutions: Institution[]
  profiles: Profile[]
  terms: Term[]
  periods: Period[]
  rooms: Room[]
  subjects: Subject[]
  teachers: Teacher[]
  teacherUnavailability: TeacherUnavailability[]
  classGroups: ClassGroup[]
  curriculumRequirements: CurriculumRequirement[]
  constraintsConfig: ConstraintsConfig[]
  lessons: Lesson[]
  draftImports: DraftImport[]
  draftImportRows: DraftImportRow[]
  substitutions: Substitution[]
  generationRuns: GenerationRun[]
  auditLogs: AuditLog[]
  assessmentSessions: AssessmentSession[]

  // Actions
  switchInstitution: (institutionId: string) => void
  switchRole: (role: UserRole) => void

  // Institution & Term actions
  addInstitution: (inst: Omit<Institution, "id" | "created_at">) => Institution
  updateInstitution: (id: string, updates: Partial<Institution>) => void
  addTerm: (term: Omit<Term, "id">) => Term
  updateTerm: (id: string, updates: Partial<Term>) => void
  deleteTerm: (id: string) => void

  // Periods
  savePeriods: (periods: Period[]) => void
  addPeriod: (period: Omit<Period, "id">) => Period
  updatePeriod: (id: string, updates: Partial<Period>) => void
  deletePeriod: (id: string) => void

  // Rooms
  addRoom: (room: Omit<Room, "id">) => Room
  updateRoom: (id: string, updates: Partial<Room>) => void
  deleteRoom: (id: string) => void

  // Subjects
  addSubject: (subj: Omit<Subject, "id">) => Subject
  updateSubject: (id: string, updates: Partial<Subject>) => void
  deleteSubject: (id: string) => void

  // Teachers
  addTeacher: (teacher: Omit<Teacher, "id"> & { fullName: string; email: string }) => Teacher
  updateTeacher: (id: string, updates: Partial<Teacher> & { fullName?: string; email?: string }) => void
  deleteTeacher: (id: string) => void
  setTeacherUnavailability: (teacherId: string, periodIds: string[], reason?: string) => void

  // Class Groups
  addClassGroup: (cg: Omit<ClassGroup, "id">) => ClassGroup
  updateClassGroup: (id: string, updates: Partial<ClassGroup>) => void
  deleteClassGroup: (id: string) => void

  // Curriculum Requirements
  saveCurriculumRequirements: (reqs: CurriculumRequirement[]) => void
  addCurriculumRequirement: (req: Omit<CurriculumRequirement, "id">) => CurriculumRequirement
  updateCurriculumRequirement: (id: string, updates: Partial<CurriculumRequirement>) => void
  deleteCurriculumRequirement: (id: string) => void

  // Constraints Config
  updateConstraintConfig: (key: string, updates: Partial<ConstraintsConfig>) => void

  // Lessons
  setLessons: (lessons: Lesson[]) => void
  addLesson: (lesson: Omit<Lesson, "id">) => Lesson
  updateLesson: (id: string, updates: Partial<Lesson>) => void
  deleteLesson: (id: string) => void
  toggleLessonLock: (id: string) => void

  // Substitutions
  createSubstitution: (sub: Omit<Substitution, "id" | "created_at">) => Substitution
  updateSubstitution: (id: string, updates: Partial<Substitution>) => void

  // Assessment Sessions (Exams & Tests)
  addAssessmentSession: (session: Omit<AssessmentSession, "id" | "created_at">) => AssessmentSession
  updateAssessmentSession: (id: string, updates: Partial<AssessmentSession>) => void
  deleteAssessmentSession: (id: string) => void

  // Generation Runs
  addGenerationRun: (run: Omit<GenerationRun, "id">) => GenerationRun

  // Audit Logs
  logAction: (action: string, entity: string, entityId?: string, diff?: Record<string, unknown>) => void

  // Draft Imports (Phase 6)
  addDraftImport: (importData: Omit<DraftImport, "id" | "created_at">) => DraftImport
  addDraftImportRows: (rows: Omit<DraftImportRow, "id">[]) => void
  updateDraftImportRow: (id: string, updates: Partial<DraftImportRow>) => void
  commitDraftImport: (draftImportId: string) => { success: boolean; committedCount: number; errors?: string[] }

  // Reset demo data
  resetToDefaultSeed: () => void
}

const DEFAULT_INSTITUTIONS: Institution[] = [
  {
    id: "00000000-0000-0000-0000-000000000001",
    name: "Oakwood High School",
    timezone: "America/New_York",
    settings: { working_days: [1, 2, 3, 4, 5] },
    created_at: new Date().toISOString(),
  },
  {
    id: "00000000-0000-0000-0000-000000000002",
    name: "St. Jude University College",
    timezone: "America/Chicago",
    settings: { working_days: [1, 2, 3, 4, 5] },
    created_at: new Date().toISOString(),
  },
]

const DEFAULT_PROFILE: Profile = {
  id: "profile-super-admin",
  institution_id: "00000000-0000-0000-0000-000000000001",
  role: "super_admin",
  full_name: "Eleanor Vance (Administrator)",
  email: "admin@oakwood.edu",
  created_at: new Date().toISOString(),
}

const DEFAULT_TERMS: Term[] = [
  {
    id: "10000000-0000-0000-0000-000000000001",
    institution_id: "00000000-0000-0000-0000-000000000001",
    name: "Fall Semester 2026",
    start_date: "2026-09-01",
    end_date: "2027-01-22",
    weeks_per_cycle: 1,
  },
  {
    id: "10000000-0000-0000-0000-000000000002",
    institution_id: "00000000-0000-0000-0000-000000000001",
    name: "Spring Semester 2027",
    start_date: "2027-02-01",
    end_date: "2027-06-25",
    weeks_per_cycle: 1,
  },
]

// Generate 5 days x 7 periods = 35 periods (Period 4 is Lunch)
function generateDefaultPeriods(instId: string): Period[] {
  const periods: Period[] = []
  const timeSlots = [
    { num: 1, start: "08:00", end: "08:50", isBreak: false },
    { num: 2, start: "08:55", end: "09:45", isBreak: false },
    { num: 3, start: "09:50", end: "10:40", isBreak: false },
    { num: 4, start: "10:45", end: "11:30", isBreak: true }, // Break / Lunch
    { num: 5, start: "11:35", end: "12:25", isBreak: false },
    { num: 6, start: "12:30", end: "13:20", isBreak: false },
    { num: 7, start: "13:25", end: "14:15", isBreak: false },
  ]

  for (let day = 1; day <= 5; day++) {
    for (const slot of timeSlots) {
      periods.push({
        id: `period-d${day}-p${slot.num}`,
        institution_id: instId,
        day_of_week: day,
        period_number: slot.num,
        start_time: slot.start,
        end_time: slot.end,
        is_break: slot.isBreak,
      })
    }
  }
  return periods
}

const DEFAULT_ROOMS: Room[] = [
  {
    id: "20000000-0000-0000-0000-000000000001",
    institution_id: "00000000-0000-0000-0000-000000000001",
    name: "Room 101",
    capacity: 32,
    room_type: "classroom",
    features: ["projector", "whiteboard"],
  },
  {
    id: "20000000-0000-0000-0000-000000000002",
    institution_id: "00000000-0000-0000-0000-000000000001",
    name: "Room 102",
    capacity: 32,
    room_type: "classroom",
    features: ["projector", "whiteboard"],
  },
  {
    id: "20000000-0000-0000-0000-000000000003",
    institution_id: "00000000-0000-0000-0000-000000000001",
    name: "Room 103",
    capacity: 30,
    room_type: "classroom",
    features: ["whiteboard"],
  },
  {
    id: "20000000-0000-0000-0000-000000000004",
    institution_id: "00000000-0000-0000-0000-000000000001",
    name: "Science Lab Alpha",
    capacity: 28,
    room_type: "lab",
    features: ["fume_hood", "gas_taps", "sinks"],
  },
  {
    id: "20000000-0000-0000-0000-000000000005",
    institution_id: "00000000-0000-0000-0000-000000000001",
    name: "Science Lab Beta",
    capacity: 28,
    room_type: "lab",
    features: ["fume_hood", "microscopes", "sinks"],
  },
  {
    id: "20000000-0000-0000-0000-000000000006",
    institution_id: "00000000-0000-0000-0000-000000000001",
    name: "Computer Lab A",
    capacity: 30,
    room_type: "computer_lab",
    features: ["30_workstations", "network_switches"],
  },
  {
    id: "20000000-0000-0000-0000-000000000007",
    institution_id: "00000000-0000-0000-0000-000000000001",
    name: "Main Gymnasium",
    capacity: 120,
    room_type: "gym",
    features: ["indoor_court", "scoreboard"],
  },
  {
    id: "20000000-0000-0000-0000-000000000008",
    institution_id: "00000000-0000-0000-0000-000000000001",
    name: "Fine Arts Studio",
    capacity: 26,
    room_type: "art_studio",
    features: ["easels", "kiln", "wash_basins"],
  },
]

const DEFAULT_SUBJECTS: Subject[] = [
  {
    id: "30000000-0000-0000-0000-000000000001",
    institution_id: "00000000-0000-0000-0000-000000000001",
    name: "Mathematics",
    code: "MATH",
    color: "#1e40af", // deep blue
    required_room_type: "classroom",
  },
  {
    id: "30000000-0000-0000-0000-000000000002",
    institution_id: "00000000-0000-0000-0000-000000000001",
    name: "Physics",
    code: "PHYS",
    color: "#0891b2", // cyan-700
    required_room_type: "lab",
  },
  {
    id: "30000000-0000-0000-0000-000000000003",
    institution_id: "00000000-0000-0000-0000-000000000001",
    name: "Chemistry",
    code: "CHEM",
    color: "#0d9488", // teal-700
    required_room_type: "lab",
  },
  {
    id: "30000000-0000-0000-0000-000000000004",
    institution_id: "00000000-0000-0000-0000-000000000001",
    name: "English Literature",
    code: "ENG",
    color: "#b45309", // amber-700
    required_room_type: "classroom",
  },
  {
    id: "30000000-0000-0000-0000-000000000005",
    institution_id: "00000000-0000-0000-0000-000000000001",
    name: "World History",
    code: "HIST",
    color: "#854d0e", // yellow-800
    required_room_type: "classroom",
  },
  {
    id: "30000000-0000-0000-0000-000000000006",
    institution_id: "00000000-0000-0000-0000-000000000001",
    name: "Computer Science",
    code: "CS",
    color: "#4338ca", // indigo-700
    required_room_type: "computer_lab",
  },
  {
    id: "30000000-0000-0000-0000-000000000007",
    institution_id: "00000000-0000-0000-0000-000000000001",
    name: "Physical Education",
    code: "PE",
    color: "#15803d", // green-700
    required_room_type: "gym",
  },
  {
    id: "30000000-0000-0000-0000-000000000008",
    institution_id: "00000000-0000-0000-0000-000000000001",
    name: "Visual Arts",
    code: "ART",
    color: "#be185d", // pink-700
    required_room_type: "art_studio",
  },
]

const DEFAULT_PROFILES: Profile[] = [
  DEFAULT_PROFILE,
  {
    id: "teacher-dr-vance",
    institution_id: "00000000-0000-0000-0000-000000000001",
    role: "teacher",
    full_name: "Dr. Robert Vance",
    email: "rvance@oakwood.edu",
    created_at: new Date().toISOString(),
  },
  {
    id: "teacher-sarah-jenkins",
    institution_id: "00000000-0000-0000-0000-000000000001",
    role: "teacher",
    full_name: "Sarah Jenkins",
    email: "sjenkins@oakwood.edu",
    created_at: new Date().toISOString(),
  },
  {
    id: "teacher-david-miller",
    institution_id: "00000000-0000-0000-0000-000000000001",
    role: "teacher",
    full_name: "David Miller",
    email: "dmiller@oakwood.edu",
    created_at: new Date().toISOString(),
  },
  {
    id: "teacher-emily-zhao",
    institution_id: "00000000-0000-0000-0000-000000000001",
    role: "teacher",
    full_name: "Emily Zhao",
    email: "ezhao@oakwood.edu",
    created_at: new Date().toISOString(),
  },
  {
    id: "teacher-michael-brooks",
    institution_id: "00000000-0000-0000-0000-000000000001",
    role: "teacher",
    full_name: "Michael Brooks",
    email: "mbrooks@oakwood.edu",
    created_at: new Date().toISOString(),
  },
  {
    id: "teacher-clara-oswald",
    institution_id: "00000000-0000-0000-0000-000000000001",
    role: "teacher",
    full_name: "Clara Oswald",
    email: "coswald@oakwood.edu",
    created_at: new Date().toISOString(),
  },
]

const DEFAULT_TEACHERS: Teacher[] = [
  {
    id: "teacher-dr-vance",
    institution_id: "00000000-0000-0000-0000-000000000001",
    max_periods_per_day: 5,
    max_periods_per_week: 22,
    qualified_subject_ids: ["30000000-0000-0000-0000-000000000001"], // Math
  },
  {
    id: "teacher-sarah-jenkins",
    institution_id: "00000000-0000-0000-0000-000000000001",
    max_periods_per_day: 5,
    max_periods_per_week: 20,
    qualified_subject_ids: [
      "30000000-0000-0000-0000-000000000002",
      "30000000-0000-0000-0000-000000000003",
    ], // Physics & Chemistry
  },
  {
    id: "teacher-david-miller",
    institution_id: "00000000-0000-0000-0000-000000000001",
    max_periods_per_day: 5,
    max_periods_per_week: 22,
    qualified_subject_ids: ["30000000-0000-0000-0000-000000000004"], // English
  },
  {
    id: "teacher-emily-zhao",
    institution_id: "00000000-0000-0000-0000-000000000001",
    max_periods_per_day: 5,
    max_periods_per_week: 20,
    qualified_subject_ids: ["30000000-0000-0000-0000-000000000006"], // CS
  },
  {
    id: "teacher-michael-brooks",
    institution_id: "00000000-0000-0000-0000-000000000001",
    max_periods_per_day: 6,
    max_periods_per_week: 24,
    qualified_subject_ids: ["30000000-0000-0000-0000-000000000007"], // PE
  },
  {
    id: "teacher-clara-oswald",
    institution_id: "00000000-0000-0000-0000-000000000001",
    max_periods_per_day: 5,
    max_periods_per_week: 20,
    qualified_subject_ids: [
      "30000000-0000-0000-0000-000000000005",
      "30000000-0000-0000-0000-000000000008",
    ], // History & Art
  },
]

const DEFAULT_CLASS_GROUPS: ClassGroup[] = [
  {
    id: "40000000-0000-0000-0000-000000000001",
    institution_id: "00000000-0000-0000-0000-000000000001",
    name: "Grade 9A",
    year_level: 9,
    size: 28,
  },
  {
    id: "40000000-0000-0000-0000-000000000002",
    institution_id: "00000000-0000-0000-0000-000000000001",
    name: "Grade 9B",
    year_level: 9,
    size: 26,
  },
  {
    id: "40000000-0000-0000-0000-000000000003",
    institution_id: "00000000-0000-0000-0000-000000000001",
    name: "Grade 10A",
    year_level: 10,
    size: 29,
  },
  {
    id: "40000000-0000-0000-0000-000000000004",
    institution_id: "00000000-0000-0000-0000-000000000001",
    name: "Grade 10B",
    year_level: 10,
    size: 27,
  },
]

const DEFAULT_CURRICULUM_REQUIREMENTS: CurriculumRequirement[] = [
  // Grade 9A
  {
    id: "req-9a-math",
    term_id: "10000000-0000-0000-0000-000000000001",
    class_group_id: "40000000-0000-0000-0000-000000000001",
    subject_id: "30000000-0000-0000-0000-000000000001", // Math
    teacher_id: "teacher-dr-vance",
    periods_per_week: 5,
    double_period: false,
  },
  {
    id: "req-9a-phys",
    term_id: "10000000-0000-0000-0000-000000000001",
    class_group_id: "40000000-0000-0000-0000-000000000001",
    subject_id: "30000000-0000-0000-0000-000000000002", // Physics
    teacher_id: "teacher-sarah-jenkins",
    periods_per_week: 4,
    double_period: true, // One double period
  },
  {
    id: "req-9a-eng",
    term_id: "10000000-0000-0000-0000-000000000001",
    class_group_id: "40000000-0000-0000-0000-000000000001",
    subject_id: "30000000-0000-0000-0000-000000000004", // English
    teacher_id: "teacher-david-miller",
    periods_per_week: 4,
    double_period: false,
  },
  {
    id: "req-9a-cs",
    term_id: "10000000-0000-0000-0000-000000000001",
    class_group_id: "40000000-0000-0000-0000-000000000001",
    subject_id: "30000000-0000-0000-0000-000000000006", // CS
    teacher_id: "teacher-emily-zhao",
    periods_per_week: 3,
    double_period: false,
  },
  {
    id: "req-9a-pe",
    term_id: "10000000-0000-0000-0000-000000000001",
    class_group_id: "40000000-0000-0000-0000-000000000001",
    subject_id: "30000000-0000-0000-0000-000000000007", // PE
    teacher_id: "teacher-michael-brooks",
    periods_per_week: 2,
    double_period: false,
  },
  {
    id: "req-9a-hist",
    term_id: "10000000-0000-0000-0000-000000000001",
    class_group_id: "40000000-0000-0000-0000-000000000001",
    subject_id: "30000000-0000-0000-0000-000000000005", // History
    teacher_id: "teacher-clara-oswald",
    periods_per_week: 3,
    double_period: false,
  },

  // Grade 9B
  {
    id: "req-9b-math",
    term_id: "10000000-0000-0000-0000-000000000001",
    class_group_id: "40000000-0000-0000-0000-000000000002",
    subject_id: "30000000-0000-0000-0000-000000000001",
    teacher_id: "teacher-dr-vance",
    periods_per_week: 5,
    double_period: false,
  },
  {
    id: "req-9b-chem",
    term_id: "10000000-0000-0000-0000-000000000001",
    class_group_id: "40000000-0000-0000-0000-000000000002",
    subject_id: "30000000-0000-0000-0000-000000000003",
    teacher_id: "teacher-sarah-jenkins",
    periods_per_week: 4,
    double_period: true,
  },
  {
    id: "req-9b-eng",
    term_id: "10000000-0000-0000-0000-000000000001",
    class_group_id: "40000000-0000-0000-0000-000000000002",
    subject_id: "30000000-0000-0000-0000-000000000004",
    teacher_id: "teacher-david-miller",
    periods_per_week: 4,
    double_period: false,
  },
]

const DEFAULT_CONSTRAINTS_CONFIG: ConstraintsConfig[] = [
  {
    id: "c-1",
    institution_id: "00000000-0000-0000-0000-000000000001",
    constraint_key: "teacher_no_double_book",
    constraint_type: "hard",
    enabled: true,
    weight: 10,
  },
  {
    id: "c-2",
    institution_id: "00000000-0000-0000-0000-000000000001",
    constraint_key: "room_no_double_book",
    constraint_type: "hard",
    enabled: true,
    weight: 10,
  },
  {
    id: "c-3",
    institution_id: "00000000-0000-0000-0000-000000000001",
    constraint_key: "class_no_double_book",
    constraint_type: "hard",
    enabled: true,
    weight: 10,
  },
  {
    id: "c-4",
    institution_id: "00000000-0000-0000-0000-000000000001",
    constraint_key: "teacher_availability",
    constraint_type: "hard",
    enabled: true,
    weight: 10,
  },
  {
    id: "c-5",
    institution_id: "00000000-0000-0000-0000-000000000001",
    constraint_key: "room_type_and_capacity",
    constraint_type: "hard",
    enabled: true,
    weight: 10,
  },
  {
    id: "c-6",
    institution_id: "00000000-0000-0000-0000-000000000001",
    constraint_key: "curriculum_periods_fulfillment",
    constraint_type: "hard",
    enabled: true,
    weight: 10,
  },
  {
    id: "c-7",
    institution_id: "00000000-0000-0000-0000-000000000001",
    constraint_key: "double_period_consecutive",
    constraint_type: "hard",
    enabled: true,
    weight: 10,
  },
  {
    id: "c-8",
    institution_id: "00000000-0000-0000-0000-000000000001",
    constraint_key: "teacher_max_load_limits",
    constraint_type: "hard",
    enabled: true,
    weight: 10,
  },
  // Soft constraints
  {
    id: "sc-1",
    institution_id: "00000000-0000-0000-0000-000000000001",
    constraint_key: "minimize_teacher_gaps",
    constraint_type: "soft",
    enabled: true,
    weight: 8,
  },
  {
    id: "sc-2",
    institution_id: "00000000-0000-0000-0000-000000000001",
    constraint_key: "minimize_student_gaps",
    constraint_type: "soft",
    enabled: true,
    weight: 9,
  },
  {
    id: "sc-3",
    institution_id: "00000000-0000-0000-0000-000000000001",
    constraint_key: "spread_subject_evenly",
    constraint_type: "soft",
    enabled: true,
    weight: 7,
  },
  {
    id: "sc-4",
    institution_id: "00000000-0000-0000-0000-000000000001",
    constraint_key: "avoid_demanding_subject_last",
    constraint_type: "soft",
    enabled: true,
    weight: 5,
  },
  {
    id: "sc-5",
    institution_id: "00000000-0000-0000-0000-000000000001",
    constraint_key: "respect_time_preferences",
    constraint_type: "soft",
    enabled: true,
    weight: 6,
  },
  {
    id: "sc-6",
    institution_id: "00000000-0000-0000-0000-000000000001",
    constraint_key: "balance_teacher_workload",
    constraint_type: "soft",
    enabled: true,
    weight: 6,
  },
  {
    id: "sc-7",
    institution_id: "00000000-0000-0000-0000-000000000001",
    constraint_key: "minimize_room_changes",
    constraint_type: "soft",
    enabled: true,
    weight: 4,
  },
  {
    id: "sc-8",
    institution_id: "00000000-0000-0000-0000-000000000001",
    constraint_key: "avoid_isolated_single_free_period",
    constraint_type: "soft",
    enabled: true,
    weight: 7,
  },
]

const DEFAULT_ASSESSMENT_SESSIONS: AssessmentSession[] = [
  {
    id: "assess-exam-math-midterm",
    institution_id: "00000000-0000-0000-0000-000000000001",
    term_id: "10000000-0000-0000-0000-000000000001",
    type: "exam",
    title: "Fall Midterm: Mathematics Paper 1 (Calculus & Algebra)",
    subject_id: "30000000-0000-0000-0000-000000000001", // Math
    class_group_ids: [
      "40000000-0000-0000-0000-000000000001", // Grade 9A
      "40000000-0000-0000-0000-000000000002", // Grade 9B
    ],
    date: "2026-10-15",
    start_time: "09:00",
    duration_minutes: 120,
    end_time: "11:00",
    room_ids: ["20000000-0000-0000-0000-000000000007"], // Main Gymnasium (capacity 120)
    supervisor_ids: ["teacher-dr-vance", "teacher-sarah-jenkins"],
    chief_supervisor_id: "teacher-dr-vance",
    instructions: "Scientific non-programmable calculators permitted. Formula sheets provided.",
    status: "scheduled",
    created_at: new Date().toISOString(),
  },
  {
    id: "assess-exam-phys-midterm",
    institution_id: "00000000-0000-0000-0000-000000000001",
    term_id: "10000000-0000-0000-0000-000000000001",
    type: "exam",
    title: "Fall Midterm: Physics Theory & Mechanics",
    subject_id: "30000000-0000-0000-0000-000000000002", // Physics
    class_group_ids: ["40000000-0000-0000-0000-000000000001"], // Grade 9A
    date: "2026-10-16",
    start_time: "09:30",
    duration_minutes: 90,
    end_time: "11:00",
    room_ids: ["20000000-0000-0000-0000-000000000004"], // Science Lab Alpha
    supervisor_ids: ["teacher-sarah-jenkins", "teacher-david-miller"],
    chief_supervisor_id: "teacher-sarah-jenkins",
    instructions: "Strict lab safety protocols apply. No smart watches allowed.",
    status: "scheduled",
    created_at: new Date().toISOString(),
  },
  {
    id: "assess-test-cs-quiz",
    institution_id: "00000000-0000-0000-0000-000000000001",
    term_id: "10000000-0000-0000-0000-000000000001",
    type: "test",
    title: "Unit 2 Practical Test: Python Data Structures",
    subject_id: "30000000-0000-0000-0000-000000000006", // CS
    class_group_ids: ["40000000-0000-0000-0000-000000000001"], // Grade 9A
    date: "2026-10-21",
    start_time: "10:00",
    duration_minutes: 45,
    end_time: "10:45",
    room_ids: ["20000000-0000-0000-0000-000000000006"], // Computer Lab A
    supervisor_ids: ["teacher-emily-zhao"],
    chief_supervisor_id: "teacher-emily-zhao",
    instructions: "Hands-on terminal assessment. Internet disabled during testing.",
    status: "scheduled",
    created_at: new Date().toISOString(),
  },
  {
    id: "assess-test-eng-vocab",
    institution_id: "00000000-0000-0000-0000-000000000001",
    term_id: "10000000-0000-0000-0000-000000000001",
    type: "test",
    title: "Literature Progress Test: Shakespeare & Poetry Analysis",
    subject_id: "30000000-0000-0000-0000-000000000004", // English
    class_group_ids: ["40000000-0000-0000-0000-000000000002"], // Grade 9B
    date: "2026-10-22",
    start_time: "11:35",
    duration_minutes: 50,
    end_time: "12:25",
    room_ids: ["20000000-0000-0000-0000-000000000002"], // Room 102
    supervisor_ids: ["teacher-david-miller"],
    chief_supervisor_id: "teacher-david-miller",
    instructions: "Closed book written test.",
    status: "scheduled",
    created_at: new Date().toISOString(),
  },
]

export const useDataStore = create<DataStoreState>()(
  persist(
    (set, get) => ({
      currentInstitutionId: "00000000-0000-0000-0000-000000000001",
      currentProfile: DEFAULT_PROFILE,
      availableInstitutions: DEFAULT_INSTITUTIONS,

      institutions: DEFAULT_INSTITUTIONS,
      profiles: DEFAULT_PROFILES,
      terms: DEFAULT_TERMS,
      periods: generateDefaultPeriods("00000000-0000-0000-0000-000000000001"),
      rooms: DEFAULT_ROOMS,
      subjects: DEFAULT_SUBJECTS,
      teachers: DEFAULT_TEACHERS,
      teacherUnavailability: [],
      classGroups: DEFAULT_CLASS_GROUPS,
      curriculumRequirements: DEFAULT_CURRICULUM_REQUIREMENTS,
      constraintsConfig: DEFAULT_CONSTRAINTS_CONFIG,
      lessons: [],
      draftImports: [],
      draftImportRows: [],
      substitutions: [],
      generationRuns: [],
      auditLogs: [],
      assessmentSessions: DEFAULT_ASSESSMENT_SESSIONS,

      switchInstitution: (institutionId: string) => {
        set({ currentInstitutionId: institutionId })
        get().logAction("switch_institution", "institution", institutionId)
      },

      switchRole: (role: UserRole) => {
        set((state) => ({
          currentProfile: { ...state.currentProfile, role },
        }))
      },

      addInstitution: (instData) => {
        const newInst: Institution = {
          ...instData,
          id: crypto.randomUUID ? crypto.randomUUID() : `inst-${Date.now()}`,
          created_at: new Date().toISOString(),
        }
        set((state) => ({
          institutions: [...state.institutions, newInst],
          availableInstitutions: [...state.availableInstitutions, newInst],
        }))
        get().logAction("create", "institution", newInst.id, { name: newInst.name })
        return newInst
      },

      updateInstitution: (id, updates) => {
        set((state) => ({
          institutions: state.institutions.map((i) => (i.id === id ? { ...i, ...updates } : i)),
          availableInstitutions: state.availableInstitutions.map((i) =>
            i.id === id ? { ...i, ...updates } : i
          ),
        }))
        get().logAction("update", "institution", id, updates)
      },

      addTerm: (termData) => {
        const newTerm: Term = {
          ...termData,
          id: crypto.randomUUID ? crypto.randomUUID() : `term-${Date.now()}`,
        }
        set((state) => ({ terms: [...state.terms, newTerm] }))
        get().logAction("create", "term", newTerm.id, { name: newTerm.name })
        return newTerm
      },

      updateTerm: (id, updates) => {
        set((state) => ({
          terms: state.terms.map((t) => (t.id === id ? { ...t, ...updates } : t)),
        }))
        get().logAction("update", "term", id, updates)
      },

      deleteTerm: (id) => {
        set((state) => ({
          terms: state.terms.filter((t) => t.id !== id),
        }))
        get().logAction("delete", "term", id)
      },

      savePeriods: (periods) => {
        set({ periods })
        get().logAction("batch_update", "periods", undefined, { count: periods.length })
      },

      addPeriod: (periodData) => {
        const newP: Period = {
          ...periodData,
          id: crypto.randomUUID ? crypto.randomUUID() : `p-${Date.now()}`,
        }
        set((state) => ({ periods: [...state.periods, newP] }))
        return newP
      },

      updatePeriod: (id, updates) => {
        set((state) => ({
          periods: state.periods.map((p) => (p.id === id ? { ...p, ...updates } : p)),
        }))
      },

      deletePeriod: (id) => {
        set((state) => ({
          periods: state.periods.filter((p) => p.id !== id),
        }))
      },

      addRoom: (roomData) => {
        const newRoom: Room = {
          ...roomData,
          id: crypto.randomUUID ? crypto.randomUUID() : `room-${Date.now()}`,
        }
        set((state) => ({ rooms: [...state.rooms, newRoom] }))
        get().logAction("create", "room", newRoom.id, { name: newRoom.name })
        return newRoom
      },

      updateRoom: (id, updates) => {
        set((state) => ({
          rooms: state.rooms.map((r) => (r.id === id ? { ...r, ...updates } : r)),
        }))
        get().logAction("update", "room", id, updates)
      },

      deleteRoom: (id) => {
        set((state) => ({
          rooms: state.rooms.filter((r) => r.id !== id),
        }))
        get().logAction("delete", "room", id)
      },

      addSubject: (subjData) => {
        const newSubj: Subject = {
          ...subjData,
          id: crypto.randomUUID ? crypto.randomUUID() : `subj-${Date.now()}`,
        }
        set((state) => ({ subjects: [...state.subjects, newSubj] }))
        get().logAction("create", "subject", newSubj.id, { code: newSubj.code })
        return newSubj
      },

      updateSubject: (id, updates) => {
        set((state) => ({
          subjects: state.subjects.map((s) => (s.id === id ? { ...s, ...updates } : s)),
        }))
        get().logAction("update", "subject", id, updates)
      },

      deleteSubject: (id) => {
        set((state) => ({
          subjects: state.subjects.filter((s) => s.id !== id),
        }))
        get().logAction("delete", "subject", id)
      },

      addTeacher: ({ fullName, email, ...tData }) => {
        const teacherId = crypto.randomUUID ? crypto.randomUUID() : `t-${Date.now()}`
        const newProfile: Profile = {
          id: teacherId,
          institution_id: tData.institution_id,
          role: "teacher",
          full_name: fullName,
          email,
          created_at: new Date().toISOString(),
        }
        const newTeacher: Teacher = {
          ...tData,
          id: teacherId,
        }
        set((state) => ({
          profiles: [...state.profiles, newProfile],
          teachers: [...state.teachers, newTeacher],
        }))
        get().logAction("create", "teacher", teacherId, { fullName, email })
        return newTeacher
      },

      updateTeacher: (id, updates) => {
        set((state) => ({
          teachers: state.teachers.map((t) => (t.id === id ? { ...t, ...updates } : t)),
          profiles: state.profiles.map((p) => {
            if (p.id === id) {
              return {
                ...p,
                full_name: updates.fullName !== undefined ? updates.fullName : p.full_name,
                email: updates.email !== undefined ? updates.email : p.email,
              }
            }
            return p
          }),
        }))
        get().logAction("update", "teacher", id, updates)
      },

      deleteTeacher: (id) => {
        set((state) => ({
          teachers: state.teachers.filter((t) => t.id !== id),
          profiles: state.profiles.filter((p) => p.id !== id),
        }))
        get().logAction("delete", "teacher", id)
      },

      setTeacherUnavailability: (teacherId, periodIds, reason) => {
        set((state) => {
          const filtered = state.teacherUnavailability.filter((u) => u.teacher_id !== teacherId)
          const newEntries: TeacherUnavailability[] = periodIds.map((pId) => ({
            id: `unavail-${teacherId}-${pId}`,
            teacher_id: teacherId,
            period_id: pId,
            reason: reason || null,
          }))
          return { teacherUnavailability: [...filtered, ...newEntries] }
        })
      },

      addClassGroup: (cgData) => {
        const newCg: ClassGroup = {
          ...cgData,
          id: crypto.randomUUID ? crypto.randomUUID() : `cg-${Date.now()}`,
        }
        set((state) => ({ classGroups: [...state.classGroups, newCg] }))
        get().logAction("create", "class_group", newCg.id, { name: newCg.name })
        return newCg
      },

      updateClassGroup: (id, updates) => {
        set((state) => ({
          classGroups: state.classGroups.map((cg) => (cg.id === id ? { ...cg, ...updates } : cg)),
        }))
        get().logAction("update", "class_group", id, updates)
      },

      deleteClassGroup: (id) => {
        set((state) => ({
          classGroups: state.classGroups.filter((cg) => cg.id !== id),
        }))
        get().logAction("delete", "class_group", id)
      },

      saveCurriculumRequirements: (reqs) => {
        set({ curriculumRequirements: reqs })
        get().logAction("batch_update", "curriculum_requirements", undefined, { count: reqs.length })
      },

      addCurriculumRequirement: (reqData) => {
        const newReq: CurriculumRequirement = {
          ...reqData,
          id: crypto.randomUUID ? crypto.randomUUID() : `req-${Date.now()}`,
        }
        set((state) => ({
          curriculumRequirements: [...state.curriculumRequirements, newReq],
        }))
        get().logAction("create", "curriculum_requirement", newReq.id)
        return newReq
      },

      updateCurriculumRequirement: (id, updates) => {
        set((state) => ({
          curriculumRequirements: state.curriculumRequirements.map((r) =>
            r.id === id ? { ...r, ...updates } : r
          ),
        }))
        get().logAction("update", "curriculum_requirement", id, updates)
      },

      deleteCurriculumRequirement: (id) => {
        set((state) => ({
          curriculumRequirements: state.curriculumRequirements.filter((r) => r.id !== id),
        }))
        get().logAction("delete", "curriculum_requirement", id)
      },

      updateConstraintConfig: (key, updates) => {
        set((state) => ({
          constraintsConfig: state.constraintsConfig.map((c) =>
            c.constraint_key === key ? { ...c, ...updates } : c
          ),
        }))
        get().logAction("update", "constraints_config", key, updates)
      },

      setLessons: (lessons) => {
        set({ lessons })
        get().logAction("set_lessons", "lessons", undefined, { count: lessons.length })
      },

      addLesson: (lessonData) => {
        const newLesson: Lesson = {
          ...lessonData,
          id: crypto.randomUUID ? crypto.randomUUID() : `lesson-${Date.now()}`,
        }
        set((state) => ({ lessons: [...state.lessons, newLesson] }))
        get().logAction("create", "lesson", newLesson.id)
        return newLesson
      },

      updateLesson: (id, updates) => {
        set((state) => ({
          lessons: state.lessons.map((l) => (l.id === id ? { ...l, ...updates } : l)),
        }))
        get().logAction("update", "lesson", id, updates)
      },

      deleteLesson: (id) => {
        set((state) => ({
          lessons: state.lessons.filter((l) => l.id !== id),
        }))
        get().logAction("delete", "lesson", id)
      },

      toggleLessonLock: (id) => {
        set((state) => ({
          lessons: state.lessons.map((l) => (l.id === id ? { ...l, locked: !l.locked } : l)),
        }))
      },

      createSubstitution: (subData) => {
        const newSub: Substitution = {
          ...subData,
          id: crypto.randomUUID ? crypto.randomUUID() : `sub-${Date.now()}`,
          created_at: new Date().toISOString(),
        }
        set((state) => ({ substitutions: [...state.substitutions, newSub] }))
        get().logAction("create", "substitution", newSub.id, {
          absent_teacher_id: newSub.absent_teacher_id,
          substitute_teacher_id: newSub.substitute_teacher_id,
        })
        return newSub
      },

      updateSubstitution: (id, updates) => {
        set((state) => ({
          substitutions: state.substitutions.map((s) => (s.id === id ? { ...s, ...updates } : s)),
        }))
        get().logAction("update", "substitution", id, updates)
      },

      addGenerationRun: (runData) => {
        const newRun: GenerationRun = {
          ...runData,
          id: crypto.randomUUID ? crypto.randomUUID() : `run-${Date.now()}`,
        }
        set((state) => ({ generationRuns: [newRun, ...state.generationRuns] }))
        return newRun
      },

      addAssessmentSession: (sessionData) => {
        const newSession: AssessmentSession = {
          ...sessionData,
          id: crypto.randomUUID ? crypto.randomUUID() : `assess-${Date.now()}`,
          created_at: new Date().toISOString(),
        }
        set((state) => ({ assessmentSessions: [...state.assessmentSessions, newSession] }))
        get().logAction("create", "assessment_session", newSession.id, {
          title: newSession.title,
          type: newSession.type,
          date: newSession.date,
        })
        return newSession
      },

      updateAssessmentSession: (id, updates) => {
        set((state) => ({
          assessmentSessions: state.assessmentSessions.map((s) =>
            s.id === id ? { ...s, ...updates } : s
          ),
        }))
        get().logAction("update", "assessment_session", id, updates)
      },

      deleteAssessmentSession: (id) => {
        set((state) => ({
          assessmentSessions: state.assessmentSessions.filter((s) => s.id !== id),
        }))
        get().logAction("delete", "assessment_session", id)
      },

      logAction: (action, entity, entityId, diff) => {
        const log: AuditLog = {
          id: crypto.randomUUID ? crypto.randomUUID() : `audit-${Date.now()}`,
          institution_id: get().currentInstitutionId,
          user_id: get().currentProfile.id,
          action,
          entity,
          entity_id: entityId || null,
          diff: diff || null,
          created_at: new Date().toISOString(),
        }
        set((state) => ({ auditLogs: [log, ...state.auditLogs.slice(0, 200)] }))
      },

      addDraftImport: (importData) => {
        const di: DraftImport = {
          ...importData,
          id: crypto.randomUUID ? crypto.randomUUID() : `draft-${Date.now()}`,
          created_at: new Date().toISOString(),
        }
        set((state) => ({ draftImports: [di, ...state.draftImports] }))
        return di
      },

      addDraftImportRows: (rows) => {
        const newRows: DraftImportRow[] = rows.map((r) => ({
          ...r,
          id: crypto.randomUUID ? crypto.randomUUID() : `row-${Date.now()}-${Math.random()}`,
        }))
        set((state) => ({ draftImportRows: [...state.draftImportRows, ...newRows] }))
      },

      updateDraftImportRow: (id, updates) => {
        set((state) => ({
          draftImportRows: state.draftImportRows.map((r) => (r.id === id ? { ...r, ...updates } : r)),
        }))
      },

      commitDraftImport: (draftImportId) => {
        const state = get()
        const draft = state.draftImports.find((d) => d.id === draftImportId)
        if (!draft) return { success: false, committedCount: 0, errors: ["Draft import not found"] }

        const rows = state.draftImportRows.filter(
          (r) => r.draft_import_id === draftImportId && !r.needs_manual_review
        )

        if (draft.source_type === "curriculum_list") {
          const newReqs: CurriculumRequirement[] = []
          for (const row of rows) {
            if (row.matched_class_group_id && row.matched_subject_id) {
              newReqs.push({
                id: crypto.randomUUID ? crypto.randomUUID() : `req-imp-${Date.now()}-${Math.random()}`,
                term_id: draft.term_id || state.terms[0]?.id || "",
                class_group_id: row.matched_class_group_id,
                subject_id: row.matched_subject_id,
                teacher_id: row.matched_teacher_id,
                periods_per_week: row.periods_per_week || 4,
                double_period: false,
              })
            }
          }
          set((s) => ({
            curriculumRequirements: [...s.curriculumRequirements, ...newReqs],
            draftImports: s.draftImports.map((d) =>
              d.id === draftImportId ? { ...d, status: "committed" } : d
            ),
          }))
          return { success: true, committedCount: newReqs.length }
        } else {
          // Mode B: legacy timetable import into lessons
          const newLessons: Lesson[] = []
          for (const row of rows) {
            if (
              row.matched_class_group_id &&
              row.matched_subject_id &&
              row.matched_teacher_id &&
              row.matched_room_id &&
              row.day_of_week &&
              row.period_number
            ) {
              const matchedPeriod = state.periods.find(
                (p) => p.day_of_week === row.day_of_week && p.period_number === row.period_number
              )
              if (matchedPeriod) {
                newLessons.push({
                  id: crypto.randomUUID ? crypto.randomUUID() : `les-imp-${Date.now()}-${Math.random()}`,
                  term_id: draft.term_id || state.terms[0]?.id || "",
                  class_group_id: row.matched_class_group_id,
                  subject_id: row.matched_subject_id,
                  teacher_id: row.matched_teacher_id,
                  room_id: row.matched_room_id,
                  period_id: matchedPeriod.id,
                  week_pattern: "all",
                  locked: false,
                })
              }
            }
          }
          set((s) => ({
            lessons: [...s.lessons, ...newLessons],
            draftImports: s.draftImports.map((d) =>
              d.id === draftImportId ? { ...d, status: "committed" } : d
            ),
          }))
          return { success: true, committedCount: newLessons.length }
        }
      },

      resetToDefaultSeed: () => {
        set({
          currentInstitutionId: "00000000-0000-0000-0000-000000000001",
          currentProfile: DEFAULT_PROFILE,
          availableInstitutions: DEFAULT_INSTITUTIONS,
          institutions: DEFAULT_INSTITUTIONS,
          profiles: DEFAULT_PROFILES,
          terms: DEFAULT_TERMS,
          periods: generateDefaultPeriods("00000000-0000-0000-0000-000000000001"),
          rooms: DEFAULT_ROOMS,
          subjects: DEFAULT_SUBJECTS,
          teachers: DEFAULT_TEACHERS,
          teacherUnavailability: [],
          classGroups: DEFAULT_CLASS_GROUPS,
          curriculumRequirements: DEFAULT_CURRICULUM_REQUIREMENTS,
          constraintsConfig: DEFAULT_CONSTRAINTS_CONFIG,
          lessons: [],
          draftImports: [],
          draftImportRows: [],
          substitutions: [],
          generationRuns: [],
          auditLogs: [],
          assessmentSessions: DEFAULT_ASSESSMENT_SESSIONS,
        })
      },
    }),
    {
      name: "timetableos-data-store",
    }
  )
)
