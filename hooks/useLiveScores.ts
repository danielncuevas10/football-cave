import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { LIVE_STATUSES } from "@/types/sports"
import type { DbMatch } from "@/types/sports"

export function useLiveScores() {
  const [matches, setMatches] = useState<DbMatch[]>([])
  const [isLoading, setIsLoading] = useState(true)

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

    // Supabase Realtime delivers every DB write from the cron directly to
    // connected clients — no browser polling needed.
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
              return [...prev, updated].sort((a, b) => {
                const d = new Date(a.fixture_date).getTime() - new Date(b.fixture_date).getTime();
                return d !== 0 ? d : a.id - b.id;
              })
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

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return { matches, isLoading }
}