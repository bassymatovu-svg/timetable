import type { Lesson } from "@/types/database"
import type { EngineInputData, EngineResult, EngineProgressCallback, ConstraintViolation } from "./types"
import { runSchedulingEngine } from "./generator"
import {
  validateAllHardConstraints,
  type HardConstraintContext,
} from "./validators/hard-constraints"
import {
  evaluateTotalSoftScore,
  type SoftConstraintContext,
} from "./validators/soft-constraints"

export * from "./types"
export * from "./validators/hard-constraints"
export * from "./validators/soft-constraints"
export * from "./requirement-expander"
export * from "./generator"

/**
 * Main public entrypoint for generating a complete timetable
 */
export function generateTimetable(
  input: EngineInputData,
  onProgress?: EngineProgressCallback
): EngineResult {
  return runSchedulingEngine(input, onProgress)
}

/**
 * Validates a single candidate lesson placement against current timetable.
 * Reused directly by the Drag-and-Drop master grid and "Move to" dialog.
 */
export function validatePlacement(
  candidate: Lesson,
  currentLessons: Lesson[],
  context: HardConstraintContext
): { isValid: boolean; violations: ConstraintViolation[] } {
  const violations = validateAllHardConstraints(candidate, currentLessons, context)
  return {
    isValid: violations.length === 0,
    violations,
  }
}
