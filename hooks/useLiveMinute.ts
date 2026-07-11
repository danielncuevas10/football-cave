import { useState, useEffect } from "react"
import type { DbMatch, FixtureStatus } from "@/types/sports"

export function formatMinute(minute: number, status: FixtureStatus): string {
  if (status === "1H" && minute > 45) return `45+${minute - 45}`
  if (status === "2H" && minute > 90) return `90+${minute - 90}`
  if (status === "ET" && minute > 120) return `120+${minute - 120}`
  return `${minute}`
}

function deriveMinute(match: DbMatch): number {
  const now = Date.now()

  switch (match.status) {
    case "1H": {
      if (!match.first_half_started_at) return match.elapsed ?? 1
      const elapsed = Math.floor(
        (now - new Date(match.first_half_started_at).getTime()) / 60000
      )
      return Math.max(elapsed + 1, 1)
    }

    case "2H": {
      if (!match.second_half_started_at) return match.elapsed ?? 46
      const elapsed = Math.floor(
        (now - new Date(match.second_half_started_at).getTime()) / 60000
      )
      return Math.max(45 + elapsed + 1, 46)
    }

    case "ET":
      return match.elapsed ?? 91

    case "HT":
      return 45

    default:
      return match.elapsed ?? 0
  }
}

export function useLiveMinute(match: DbMatch): number {
  const [minute, setMinute] = useState(() => deriveMinute(match))

  useEffect(() => {
    setMinute(deriveMinute(match))

    const isRunning =
      match.status === "1H" ||
      match.status === "2H" ||
      match.status === "ET"

    if (!isRunning) return

    const interval = setInterval(() => {
      setMinute(deriveMinute(match))
    }, 30_000)

    return () => clearInterval(interval)
  }, [
    match.status,
    match.first_half_started_at,
    match.second_half_started_at,
    match.elapsed,
  ])

  return minute
}
