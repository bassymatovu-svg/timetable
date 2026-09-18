import type {
  AssessmentSession,
  AssessmentConflict,
  Room,
  Teacher,
  Profile,
  ClassGroup,
  Lesson,
  Period,
} from "@/types/database"

/**
 * Converts a "HH:mm" or "HH:mm:ss" time string to total minutes from midnight.
 */
export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0
  const parts = timeStr.split(":")
  const hours = parseInt(parts[0] || "0", 10)
  const minutes = parseInt(parts[1] || "0", 10)
  return hours * 60 + minutes
}

/**
 * Converts total minutes from midnight to a formatted "HH:mm" time string.
 */
export function minutesToTime(totalMinutes: number): string {
  const normalized = Math.max(0, Math.min(24 * 60 - 1, Math.floor(totalMinutes)))
  const hours = Math.floor(normalized / 60)
  const minutes = normalized % 60
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`
}

/**
 * Calculates end time from start time and duration in minutes.
 */
export function calculateEndTime(startTime: string, durationMinutes: number): string {
  const startMins = timeToMinutes(startTime)
  const endMins = startMins + durationMinutes
  return minutesToTime(endMins)
}

/**
 * Checks whether two time intervals [startA, endA) and [startB, endB) overlap.
 */
export function doTimesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  const sA = timeToMinutes(startA)
  const eA = timeToMinutes(endA)
  const sB = timeToMinutes(startB)
  const eB = timeToMinutes(endB)

  return sA < eB && sB < eA
}

export interface AssessmentValidationContext {
  existingSessions: AssessmentSession[]
  rooms: Room[]
  teachers: Teacher[]
  profiles: Profile[]
  classGroups: ClassGroup[]
  lessons?: Lesson[]
  periods?: Period[]
}

/**
 * Validates a candidate assessment session for:
 * 1. Room double-booking clashes
 * 2. Supervisor double-booking clashes
 * 3. Class group simultaneous assessment clashes
 * 4. Room seating capacity vs total class enrollment
 */
export function validateAssessmentSession(
  candidate: Partial<AssessmentSession>,
  context: AssessmentValidationContext
): { isValid: boolean; conflicts: AssessmentConflict[] } {
  const conflicts: AssessmentConflict[] = []

  const date = candidate.date
  const startTime = candidate.start_time
  const endTime = candidate.end_time || (candidate.start_time && candidate.duration_minutes
    ? calculateEndTime(candidate.start_time, candidate.duration_minutes)
    : "")

  if (!date || !startTime || !endTime) {
    return { isValid: true, conflicts: [] }
  }

  const otherSessions = context.existingSessions.filter(
    (s) => s.id !== candidate.id && s.date === date && s.status !== "cancelled"
  )

  // 1. Room Double-Booking Check
  const candidateRoomIds = candidate.room_ids || []
  for (const roomId of candidateRoomIds) {
    const room = context.rooms.find((r) => r.id === roomId)
    const roomName = room?.name || "Room"

    for (const other of otherSessions) {
      if (
        other.room_ids.includes(roomId) &&
        doTimesOverlap(startTime, endTime, other.start_time, other.end_time)
      ) {
        conflicts.push({
          type: "room_clash",
          severity: "error",
          message: `${roomName} is already booked for "${other.title}" (${other.start_time} - ${other.end_time}).`,
          entityId: roomId,
          entityName: roomName,
        })
      }
    }
  }

  // 2. Supervisor Double-Booking Check
  const candidateSupervisorIds = [
    ...(candidate.supervisor_ids || []),
    ...(candidate.chief_supervisor_id ? [candidate.chief_supervisor_id] : []),
  ]
  const uniqueCandidateSupervisorIds = Array.from(new Set(candidateSupervisorIds))

  for (const supId of uniqueCandidateSupervisorIds) {
    const profile = context.profiles.find((p) => p.id === supId)
    const supervisorName = profile?.full_name || "Supervisor"

    for (const other of otherSessions) {
      const otherSupervisors = [
        ...other.supervisor_ids,
        ...(other.chief_supervisor_id ? [other.chief_supervisor_id] : []),
      ]

      if (
        otherSupervisors.includes(supId) &&
        doTimesOverlap(startTime, endTime, other.start_time, other.end_time)
      ) {
        conflicts.push({
          type: "supervisor_clash",
          severity: "error",
          message: `${supervisorName} is already supervising "${other.title}" (${other.start_time} - ${other.end_time}).`,
          entityId: supId,
          entityName: supervisorName,
        })
      }
    }
  }

  // 3. Class Group Simultaneous Assessment Check
  const candidateClassGroupIds = candidate.class_group_ids || []
  for (const classId of candidateClassGroupIds) {
    const classGroup = context.classGroups.find((c) => c.id === classId)
    const className = classGroup?.name || "Class"

    for (const other of otherSessions) {
      if (
        other.class_group_ids.includes(classId) &&
        doTimesOverlap(startTime, endTime, other.start_time, other.end_time)
      ) {
        conflicts.push({
          type: "supervisor_clash", // reusing clash alert category
          severity: "error",
          message: `${className} is already scheduled for "${other.title}" (${other.start_time} - ${other.end_time}).`,
          entityId: classId,
          entityName: className,
        })
      }
    }
  }

  // 4. Room Capacity Check
  if (candidateRoomIds.length > 0 && candidateClassGroupIds.length > 0) {
    const totalStudentCount = candidateClassGroupIds.reduce((sum, classId) => {
      const cg = context.classGroups.find((c) => c.id === classId)
      return sum + (cg?.size || 0)
    }, 0)

    const totalRoomCapacity = candidateRoomIds.reduce((sum, roomId) => {
      const r = context.rooms.find((rm) => rm.id === roomId)
      return sum + (r?.capacity || 0)
    }, 0)

    if (totalStudentCount > totalRoomCapacity) {
      conflicts.push({
        type: "capacity_exceeded",
        severity: "warning",
        message: `Total student count (${totalStudentCount}) exceeds combined room capacity (${totalRoomCapacity}) by ${
          totalStudentCount - totalRoomCapacity
        } seats.`,
      })
    }
  }

  const hasErrors = conflicts.some((c) => c.severity === "error")
  return {
    isValid: !hasErrors,
    conflicts,
  }
}
