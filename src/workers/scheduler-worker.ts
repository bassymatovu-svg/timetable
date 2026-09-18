import { generateTimetable } from "@/lib/scheduler-engine"
import type { EngineInputData } from "@/lib/scheduler-engine/types"

self.onmessage = (event: MessageEvent<EngineInputData>) => {
  const inputData = event.data

  try {
    const result = generateTimetable(inputData, (progress) => {
      self.postMessage({ type: "PROGRESS", payload: progress })
    })

    self.postMessage({ type: "COMPLETE", payload: result })
  } catch (error: any) {
    self.postMessage({
      type: "ERROR",
      payload: { message: error?.message || "Unknown error during timetable generation" },
    })
  }
}
