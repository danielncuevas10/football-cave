import { countriesResponseSchema, matchesResponseSchema, scorersResponseSchema, standingsResponseSchema, matchDetailsResponseSchema } from "@/lib/schemas"
import { z } from "zod"

const BASE = "https://v3.football.api-sports.io"

async function apiFetch<T extends z.ZodTypeAny>(
  endpoint: string,
  schema: T,
  retries = 2
): Promise<z.infer<T> | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)

    try {
      const res = await fetch(`${BASE}${endpoint}`, {
        headers: {
          "x-apisports-key": process.env.API_FOOTBALL_KEY!,
          Accept: "application/json",
        },
        signal: controller.signal,
        cache: "no-store",
      })

      clearTimeout(timeout)

      if (res.status === 429) {
        console.error("API-Football quota exceeded")
        return null
      }

      if (!res.ok) {
        console.error(`API-Football ${res.status} on ${endpoint}`)

        if (attempt < retries) {
          await sleep(1000 * 2 ** attempt)
          continue
        }

        return null
      }

      const raw = await res.json()

      // Zod validation
      const parsed = schema.safeParse(raw)

      if (!parsed.success) {
        console.error(
          "ZOD ERROR:",
          JSON.stringify(parsed.error.format(), null, 2)
        )
        return null
      }

      return parsed.data
    } catch (e) {
      clearTimeout(timeout)

      if (e instanceof Error && e.name === "AbortError") {
        console.error(`API-Football timeout on ${endpoint}`)
      } else {
        console.error(`API-Football exception on ${endpoint}:`, e)
      }

      if (attempt < retries) {
        await sleep(1000 * 2 ** attempt)
      }
    }
  }

  return null
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export const footballApi = {
  // FIX: Only append season if it's explicitly passed as an argument
  liveMatches: (season?: number) => {
    const endpoint = season ? `/fixtures?live=all&season=${season}` : "/fixtures?live=all"
    return apiFetch(endpoint, matchesResponseSchema)
  },

  fixtures: (leagueId: number, season: number) =>
    apiFetch(
      `/fixtures?league=${leagueId}&season=${season}`,
      matchesResponseSchema
    ),


  fixturesByLeague: (params: { league: number; season: number; next?: number; last?: number }) => {
    let endpoint = `/fixtures?league=${params.league}&season=${params.season}`

    if (params.next) endpoint += `&next=${params.next}`
    if (params.last) endpoint += `&last=${params.last}`

    return apiFetch(endpoint, matchesResponseSchema)
  },

  standings: (leagueId: number, season: number) =>
    apiFetch(`/standings?league=${leagueId}&season=${season}`, standingsResponseSchema),

  topScorers: (leagueId: number, season: number) =>
    apiFetch(
      `/players/topscorers?league=${leagueId}&season=${season}`,
      scorersResponseSchema
    ),

    getMatchById: (fixtureId: number) =>
      apiFetch(`/fixtures?id=${fixtureId}`, matchesResponseSchema

      ),


allFixturesForSeason: (leagueId: number, season: number) =>
  apiFetch(`/fixtures?league=${leagueId}&season=${season}`, matchesResponseSchema

  ),


  getMatchDetails: async (fixtureId: number) => {
    try {
      const data = await apiFetch(`/fixtures?id=${fixtureId}`, matchDetailsResponseSchema);
      
      if (!data || !data.response || data.response.length === 0) {
        return null;
      }
      
      return data.response[0];
    } catch (error) {
      console.error("❌ Zod Validation Error Details:", error);
      return null;
    }
  },

  countries: (filters?: { name?: string; code?: string; search?: string }) => {
    const query = new URLSearchParams()
    
    if (filters?.name) query.append("name", filters.name)
    if (filters?.code) query.append("code", filters.code)
    if (filters?.search) query.append("search", filters.search)

    const endpoint = query.toString() ? `/countries?${query.toString()}` : "/countries"
    
    return apiFetch(endpoint, countriesResponseSchema)
  }
}