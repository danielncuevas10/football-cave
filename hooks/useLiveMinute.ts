// src/hooks/useLiveMinute.ts
import { useState, useEffect, useRef } from "react"
import type { FixtureStatus } from "@/types/sports"

export function useLiveMinute(
  status: FixtureStatus,
  initialElapsed: number | null,
  fixtureDate: string
): string {
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

    // No cap — elapsed is allowed to go past 45/90 so added time shows as "45+2"
    const tick = () => setElapsed(prev => prev + 1)

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

  if (status === "1H" && elapsed > 45) return `45+${elapsed - 45}`
  if (status === "2H" && elapsed > 90) return `90+${elapsed - 90}`
  return String(elapsed)
}
