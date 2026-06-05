import { useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import { LIVE_STATUSES } from "@/types/sports"
import type { DbMatch } from "@/types/sports"

const POLL_INTERVAL_MS = 60_000 // sync every 60 seconds while live matches exist

export function useLiveScores() {
  const [matches, setMatches] = useState<DbMatch[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const matchesRef = useRef(matches)
  matchesRef.current = matches

  useEffect(() => {
    // Initial fetch — only currently live matches
    supabase
      .from("matches")
      .select("*")
      .eq("is_live", true)
      .order("fixture_date", { ascending: true })
      .returns<DbMatch[]>()
      .then(({ data }) => {
        setMatches(data ?? [])
        setIsLoading(false)
      })

    const channel = supabase
      .channel("live-matches")
      .on<DbMatch>(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "matches",
        },
        (payload) => {
          const updated = payload.new as DbMatch

          setMatches(prev => {
            const exists = prev.some(m => m.id === updated.id)

            if (!exists && updated.is_live) {
              return [...prev, updated].sort(
                (a, b) =>
                  new Date(a.fixture_date).getTime() -
                  new Date(b.fixture_date).getTime()
              )
            }

            if (exists) {
              const stillLive = updated.is_live || LIVE_STATUSES.includes(updated.status)
              if (!stillLive) {
                return prev.filter(m => m.id !== updated.id)
              }
              return prev.map(m => (m.id === updated.id ? updated : m))
            }

            return prev
          })
        }
      )
      .subscribe()

    // Poll /api/sync-live every 60 s to keep elapsed + scores current.
    // The API write triggers Realtime, which updates the state above.
    const poll = setInterval(() => {
      fetch("/api/sync-live").catch(() => {/* silent — Realtime handles UI */})
    }, POLL_INTERVAL_MS)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(poll)
    }
  }, [])

  return { matches, isLoading }
}