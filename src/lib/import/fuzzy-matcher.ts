import Fuse from "fuse.js"
import type { ClassGroup, Subject, Teacher, Room, Profile } from "@/types/database"

export interface FuzzyMatchContext {
  classGroups: ClassGroup[]
  subjects: Subject[]
  teachers: Teacher[]
  profiles: Profile[]
  rooms: Room[]
}

export interface MatchResult {
  matchedClassGroupId: string | null
  matchedSubjectId: string | null
  matchedTeacherId: string | null
  matchedRoomId: string | null
  confidence: number
  needsManualReview: boolean
}

/**
 * Runs fuzzy string matching using Fuse.js on extracted raw text against existing institutional entities.
 * Automatically marks match as needing review if confidence < 0.7.
 */
export function fuzzyMatchRow(
  raw: {
    className?: string
    subjectName?: string
    teacherName?: string
    roomName?: string
  },
  context: FuzzyMatchContext
): MatchResult {
  let matchedClassGroupId: string | null = null
  let matchedSubjectId: string | null = null
  let matchedTeacherId: string | null = null
  let matchedRoomId: string | null = null

  const confidences: number[] = []

  // 1. Class Group matching
  if (raw.className && context.classGroups.length > 0) {
    const fuseClasses = new Fuse(context.classGroups, {
      keys: ["name"],
      includeScore: true,
      threshold: 0.4,
    })
    const res = fuseClasses.search(raw.className)
    if (res.length > 0 && res[0].score !== undefined) {
      matchedClassGroupId = res[0].item.id
      confidences.push(1 - res[0].score)
    }
  }

  // 2. Subject matching (by name or code)
  if (raw.subjectName && context.subjects.length > 0) {
    const fuseSubjects = new Fuse(context.subjects, {
      keys: ["name", "code"],
      includeScore: true,
      threshold: 0.4,
    })
    const res = fuseSubjects.search(raw.subjectName)
    if (res.length > 0 && res[0].score !== undefined) {
      matchedSubjectId = res[0].item.id
      confidences.push(1 - res[0].score)
    }
  }

  // 3. Teacher matching (by full_name)
  if (raw.teacherName && context.profiles.length > 0) {
    const teacherProfiles = context.profiles.filter((p) => p.role === "teacher")
    const fuseTeachers = new Fuse(teacherProfiles, {
      keys: ["full_name"],
      includeScore: true,
      threshold: 0.45,
    })
    const res = fuseTeachers.search(raw.teacherName)
    if (res.length > 0 && res[0].score !== undefined) {
      matchedTeacherId = res[0].item.id
      confidences.push(1 - res[0].score)
    }
  }

  // 4. Room matching
  if (raw.roomName && context.rooms.length > 0) {
    const fuseRooms = new Fuse(context.rooms, {
      keys: ["name"],
      includeScore: true,
      threshold: 0.4,
    })
    const res = fuseRooms.search(raw.roomName)
    if (res.length > 0 && res[0].score !== undefined) {
      matchedRoomId = res[0].item.id
      confidences.push(1 - res[0].score)
    }
  }

  // Average confidence score
  const avgConfidence =
    confidences.length > 0
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : 0.5

  const roundedConfidence = Math.round(avgConfidence * 100) / 100

  // As per Section 5.7: Anything below 0.7 confidence threshold is flagged needs_manual_review
  const needsManualReview =
    roundedConfidence < 0.7 ||
    (Boolean(raw.className) && !matchedClassGroupId) ||
    (Boolean(raw.subjectName) && !matchedSubjectId)

  return {
    matchedClassGroupId,
    matchedSubjectId,
    matchedTeacherId,
    matchedRoomId,
    confidence: roundedConfidence,
    needsManualReview,
  }
}
