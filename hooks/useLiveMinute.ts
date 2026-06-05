// src/hooks/useLiveMinute.ts
import { useState, useEffect, useRef } from "react"
import type { FixtureStatus } from "@/types/sports"

export function useLiveMinute(
  status: FixtureStatus,
  initialElapsed: number | null,
  fixtureDate: string
) {
  const [elapsed, setElapsed] = useState<number>(initialElapsed ?? 0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    // Always reset to the latest DB value when it arrives (cron update via Realtime)
    setElapsed(initialElapsed ?? 0)

    const isRunning = status === "1H" || status === "2H" || status === "ET"
    if (!isRunning) return

    // Safety: stop if fixture is more than 4 hours old
    const kickoff = new Date(fixtureDate).getTime()
    const ageHours = (Date.now() - kickoff) / (1000 * 60 * 60)
    if (ageHours > 4) return

    const tick = () =>
      setElapsed(prev => {
        if (status === "1H" && prev >= 45) return prev
        if (status === "2H" && prev >= 90) return prev
        return prev + 1
      })

    // Align first tick to the next real-world minute boundary so increments
    // stay in sync with the actual clock between cron DB updates
    const msUntilNextMinute = 60000 - (Date.now() % 60000)

    const timeout = setTimeout(() => {
      tick()
      intervalRef.current = setInterval(tick, 60000)
    }, msUntilNextMinute)

    return () => {
      clearTimeout(timeout)
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  // fixtureDate never changes for a given match, safe to omit
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, initialElapsed])

  return elapsed
}
