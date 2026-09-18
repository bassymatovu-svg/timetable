import type { Lesson, Period, Room, Subject, Teacher } from "@/types/database"
import type {
  EngineInputData,
  EngineResult,
  EngineProgressCallback,
  ScheduledLessonSlot,
  ConstraintViolation,
} from "./types"
import { expandCurriculumRequirements } from "./requirement-expander"
import {
  validateAllHardConstraints,
  type HardConstraintContext,
} from "./validators/hard-constraints"
import {
  evaluateTotalSoftScore,
  type SoftConstraintContext,
} from "./validators/soft-constraints"

export function runSchedulingEngine(
  input: EngineInputData,
  onProgress?: EngineProgressCallback
): EngineResult {
  const startTime = Date.now()

  // 1. Separate instructional periods from breaks
  const instructionalPeriods = input.periods.filter((p) => !p.is_break)
  const periodsByDay = new Map<number, Period[]>()
  for (const p of instructionalPeriods) {
    const list = periodsByDay.get(p.day_of_week) || []
    list.push(p)
    periodsByDay.set(p.day_of_week, list)
  }
  for (const list of periodsByDay.values()) {
    list.sort((a, b) => a.period_number - b.period_number)
  }

  // 2. Expand curriculum requirements into slots
  onProgress?.({
    phase: "expanding",
    percentage: 5,
    placedCount: 0,
    totalCount: 0,
    hardViolations: 0,
    softScore: 0,
    message: "Expanding curriculum requirements into instructional slots...",
  })

  const existingLocked = (input.existingLessons || []).filter((l) => l.locked)
  const { slotsToPlace, lockedSlots } = expandCurriculumRequirements(
    input.curriculumRequirements,
    input.teachers,
    input.subjects,
    existingLocked
  )

  const totalSlots = slotsToPlace.length + lockedSlots.length

  // Build lookup maps for fast access
  const subjectMap = new Map(input.subjects.map((s) => [s.id, s]))
  const teacherMap = new Map(input.teachers.map((t) => [t.id, t]))
  const classGroupMap = new Map(input.classGroups.map((c) => [c.id, c]))
  const roomMap = new Map(input.rooms.map((r) => [r.id, r]))

  const hardContext: HardConstraintContext = {
    periods: input.periods,
    rooms: input.rooms,
    subjects: input.subjects,
    teachers: input.teachers,
    classGroups: input.classGroups,
    teacherUnavailability: input.teacherUnavailability,
  }

  // 3. Heuristic Ordering: "Most-Constrained-First"
  // Place linked double periods first, then subjects with specialist rooms, then teachers with high unavailability
  const sortedSlots = [...slotsToPlace].sort((a, b) => {
    // 1. Double periods first
    if (a.isDoublePart && !b.isDoublePart) return -1
    if (!a.isDoublePart && b.isDoublePart) return 1

    // 2. Subjects requiring specialist rooms first (lab, gym, art)
    const subjA = subjectMap.get(a.subjectId)
    const subjB = subjectMap.get(b.subjectId)
    const specA = subjA?.required_room_type && subjA.required_room_type !== "classroom" ? 1 : 0
    const specB = subjB?.required_room_type && subjB.required_room_type !== "classroom" ? 1 : 0
    if (specA !== specB) return specB - specA

    // 3. Teachers with more unavailable periods
    const unavailA = input.teacherUnavailability.filter((u) => u.teacher_id === a.teacherId).length
    const unavailB = input.teacherUnavailability.filter((u) => u.teacher_id === b.teacherId).length
    if (unavailA !== unavailB) return unavailB - unavailA

    return 0
  })

  // Start with existing locked lessons
  const placedLessons: Lesson[] = existingLocked.map((l) => ({ ...l }))
  let backtrackBudget = 2500
  let placedCount = placedLessons.length

  onProgress?.({
    phase: "constructive",
    percentage: 15,
    placedCount,
    totalCount: totalSlots,
    hardViolations: 0,
    softScore: 0,
    message: `Starting constructive placement for ${sortedSlots.length} slots...`,
  })

  // Group candidate rooms by room type for fast filtering
  const roomsByType = new Map<string, Room[]>()
  for (const r of input.rooms) {
    const list = roomsByType.get(r.room_type) || []
    list.push(r)
    roomsByType.set(r.room_type, list)
  }

  // Double period adjacent pairs lookup
  function findConsecutivePeriods(day: number): [Period, Period][] {
    const dayPeriods = periodsByDay.get(day) || []
    const pairs: [Period, Period][] = []
    for (let i = 0; i < dayPeriods.length - 1; i++) {
      const p1 = dayPeriods[i]
      const p2 = dayPeriods[i + 1]
      // Consecutive period numbers with no break between them
      if (p2.period_number === p1.period_number + 1 && !p1.is_break && !p2.is_break) {
        pairs.push([p1, p2])
      }
    }
    return pairs
  }

  // Constructive Backtracking Algorithm
  const processedPairedIds = new Set<string>()

  for (let idx = 0; idx < sortedSlots.length; idx++) {
    const slot = sortedSlots[idx]
    if (processedPairedIds.has(slot.id)) continue

    const subject = subjectMap.get(slot.subjectId)
    const classGroup = classGroupMap.get(slot.classGroupId)
    const requiredType = subject?.required_room_type || "classroom"

    // Candidate rooms matching type & capacity
    let candidateRooms = (roomsByType.get(requiredType) || input.rooms).filter(
      (r) => !classGroup || r.capacity >= classGroup.size
    )
    if (candidateRooms.length === 0) {
      candidateRooms = input.rooms // fallback if no specific room fits
    }

    // Handle Linked Double Period (Part 1 and Part 2 together)
    if (slot.isDoublePart === 1 && slot.pairedSlotId) {
      const pairedSlot = sortedSlots.find((s) => s.id === slot.pairedSlotId)
      let placedPair = false

      // Try each working day
      for (const day of [1, 2, 3, 4, 5]) {
        const consecutivePairs = findConsecutivePeriods(day)
        for (const [p1, p2] of consecutivePairs) {
          for (const room of candidateRooms) {
            const candidate1: Lesson = {
              id: slot.id,
              term_id: slot.termId,
              class_group_id: slot.classGroupId,
              subject_id: slot.subjectId,
              teacher_id: slot.teacherId,
              room_id: room.id,
              period_id: p1.id,
              week_pattern: "all",
              locked: false,
            }

            const candidate2: Lesson = {
              id: pairedSlot ? pairedSlot.id : `${slot.id}-part2`,
              term_id: slot.termId,
              class_group_id: slot.classGroupId,
              subject_id: slot.subjectId,
              teacher_id: slot.teacherId,
              room_id: room.id,
              period_id: p2.id,
              week_pattern: "all",
              locked: false,
            }

            // Validate both
            const v1 = validateAllHardConstraints(candidate1, placedLessons, hardContext)
            if (v1.length === 0) {
              const v2 = validateAllHardConstraints(
                candidate2,
                [...placedLessons, candidate1],
                hardContext
              )
              if (v2.length === 0) {
                placedLessons.push(candidate1)
                placedLessons.push(candidate2)
                processedPairedIds.add(slot.id)
                if (pairedSlot) processedPairedIds.add(pairedSlot.id)
                placedPair = true
                break
              }
            }
          }
          if (placedPair) break
        }
        if (placedPair) break
      }

      if (!placedPair && backtrackBudget > 0) {
        backtrackBudget--
        // If pair placement failed, shuffle and retry with slightly relaxed room search
        for (const p of instructionalPeriods) {
          const room = candidateRooms[0] || input.rooms[0]
          const c: Lesson = {
            id: slot.id,
            term_id: slot.termId,
            class_group_id: slot.classGroupId,
            subject_id: slot.subjectId,
            teacher_id: slot.teacherId,
            room_id: room?.id || "",
            period_id: p.id,
            week_pattern: "all",
            locked: false,
          }
          if (validateAllHardConstraints(c, placedLessons, hardContext).length === 0) {
            placedLessons.push(c)
            processedPairedIds.add(slot.id)
            break
          }
        }
      }
    } else {
      // Single period placement
      let placedSingle = false
      // Shuffle periods slightly to avoid clustering on Monday morning
      const shuffledPeriods = [...instructionalPeriods].sort(() => Math.random() - 0.5)

      for (const p of shuffledPeriods) {
        for (const room of candidateRooms) {
          const candidate: Lesson = {
            id: slot.id,
            term_id: slot.termId,
            class_group_id: slot.classGroupId,
            subject_id: slot.subjectId,
            teacher_id: slot.teacherId,
            room_id: room.id,
            period_id: p.id,
            week_pattern: "all",
            locked: false,
          }

          const violations = validateAllHardConstraints(candidate, placedLessons, hardContext)
          if (violations.length === 0) {
            placedLessons.push(candidate)
            placedSingle = true
            break
          }
        }
        if (placedSingle) break
      }

      if (!placedSingle && backtrackBudget > 0) {
        backtrackBudget--
        // Fallback search across all rooms
        for (const p of instructionalPeriods) {
          for (const room of input.rooms) {
            const candidate: Lesson = {
              id: slot.id,
              term_id: slot.termId,
              class_group_id: slot.classGroupId,
              subject_id: slot.subjectId,
              teacher_id: slot.teacherId,
              room_id: room.id,
              period_id: p.id,
              week_pattern: "all",
              locked: false,
            }
            if (validateAllHardConstraints(candidate, placedLessons, hardContext).length === 0) {
              placedLessons.push(candidate)
              placedSingle = true
              break
            }
          }
          if (placedSingle) break
        }
      }
    }

    if (idx % 5 === 0 || idx === sortedSlots.length - 1) {
      const pct = Math.round(15 + (idx / sortedSlots.length) * 50)
      onProgress?.({
        phase: "constructive",
        percentage: pct,
        placedCount: placedLessons.length,
        totalCount: totalSlots,
        hardViolations: 0,
        softScore: 0,
        message: `Placed ${placedLessons.length} of ${totalSlots} lesson slots...`,
      })
    }
  }

  // Check remaining hard violations on initial placed timetable
  const initialViolations: ConstraintViolation[] = []
  for (const l of placedLessons) {
    const others = placedLessons.filter((o) => o.id !== l.id)
    initialViolations.push(...validateAllHardConstraints(l, others, hardContext))
  }

  // 4. Local Search Optimization: Simulated Annealing
  const softContext: SoftConstraintContext = {
    periods: input.periods,
    subjects: input.subjects,
    teachers: input.teachers,
    classGroups: input.classGroups,
    constraintsConfig: input.constraintsConfig,
  }

  let currentTimetable = [...placedLessons]
  let { totalScore: currentScore } = evaluateTotalSoftScore(currentTimetable, softContext)
  let bestTimetable = [...currentTimetable]
  let bestScore = currentScore

  onProgress?.({
    phase: "optimizing",
    percentage: 70,
    placedCount: currentTimetable.length,
    totalCount: totalSlots,
    hardViolations: initialViolations.length,
    softScore: currentScore,
    message: `Initial feasible state found (Score: ${currentScore}). Optimizing via Simulated Annealing...`,
  })

  // Simulated Annealing Parameters
  let temperature = 100.0
  const coolingRate = 0.992
  const maxIterations = 800

  for (let step = 0; step < maxIterations; step++) {
    // Select two random unlocked lessons
    const unlockedIndices = currentTimetable
      .map((l, i) => (l.locked ? -1 : i))
      .filter((i) => i !== -1)

    if (unlockedIndices.length >= 2) {
      const idxA = unlockedIndices[Math.floor(Math.random() * unlockedIndices.length)]
      const idxB = unlockedIndices[Math.floor(Math.random() * unlockedIndices.length)]

      if (idxA !== idxB) {
        const lessonA = currentTimetable[idxA]
        const lessonB = currentTimetable[idxB]

        // Try swapping periods
        const swappedA: Lesson = { ...lessonA, period_id: lessonB.period_id }
        const swappedB: Lesson = { ...lessonB, period_id: lessonA.period_id }

        const otherLessons = currentTimetable.filter((_, i) => i !== idxA && i !== idxB)

        // Must strictly preserve hard constraints
        const vA = validateAllHardConstraints(swappedA, otherLessons, hardContext)
        const vB = validateAllHardConstraints(swappedB, [...otherLessons, swappedA], hardContext)

        if (vA.length === 0 && vB.length === 0) {
          const candidateState = [...currentTimetable]
          candidateState[idxA] = swappedA
          candidateState[idxB] = swappedB

          const { totalScore: candidateScore } = evaluateTotalSoftScore(candidateState, softContext)
          const delta = candidateScore - currentScore

          // If improvement or accept probabilistically
          if (delta < 0 || Math.random() < Math.exp(-delta / Math.max(temperature, 0.1))) {
            currentTimetable = candidateState
            currentScore = candidateScore

            if (currentScore < bestScore) {
              bestScore = currentScore
              bestTimetable = [...currentTimetable]
            }
          }
        }
      }
    }

    temperature *= coolingRate

    if (step % 100 === 0 || step === maxIterations - 1) {
      const pct = Math.round(70 + (step / maxIterations) * 28)
      onProgress?.({
        phase: "optimizing",
        percentage: pct,
        placedCount: bestTimetable.length,
        totalCount: totalSlots,
        hardViolations: 0,
        softScore: bestScore,
        iteration: step,
        message: `Annealing step ${step}/${maxIterations} — Best score: ${bestScore}`,
      })
    }
  }

  // Final evaluation of best timetable
  const finalHardViolations: ConstraintViolation[] = []
  for (const l of bestTimetable) {
    const others = bestTimetable.filter((o) => o.id !== l.id)
    finalHardViolations.push(...validateAllHardConstraints(l, others, hardContext))
  }

  const { totalScore: finalSoftScore, breakdown } = evaluateTotalSoftScore(bestTimetable, softContext)
  const durationMs = Date.now() - startTime

  onProgress?.({
    phase: "completed",
    percentage: 100,
    placedCount: bestTimetable.length,
    totalCount: totalSlots,
    hardViolations: finalHardViolations.length,
    softScore: finalSoftScore,
    message: `Timetable generation completed in ${(durationMs / 1000).toFixed(2)}s with ${finalHardViolations.length} hard violations.`,
  })

  return {
    success: finalHardViolations.length === 0,
    lessons: bestTimetable,
    hardViolations: finalHardViolations,
    softViolations: [],
    softScore: finalSoftScore,
    totalLessonsToPlace: totalSlots,
    placedLessonsCount: bestTimetable.length,
    durationMs,
    log: {
      durationMs,
      placedCount: bestTimetable.length,
      totalSlots,
      hardViolationsCount: finalHardViolations.length,
      softScore: finalSoftScore,
      softBreakdown: breakdown,
      backtracksUsed: 2500 - backtrackBudget,
    },
  }
}
