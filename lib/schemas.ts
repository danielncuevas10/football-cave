import { z } from "zod"

export const fixtureQuerySchema = z.object({
    leagueId: z.coerce.number().int().positive().max(9999),
    season: z.coerce.number().int().min(2020).max(2030),
    lang: z.enum(["en", "es", "pt", "bs", "gr", "ch", "kr", "fr", "jp", "tr"]).default("en"),
})

export const scorerQuerySchema = z.object({
    leagueId: z.coerce.number().int().positive().max(9999),
    season: z.coerce.number().int().min(2020).max(2030),
})

// API-Football - validating response

const apiTeamSchema = z.object({
    id: z.number(),
    name: z.string(),
    logo: z.string().optional().default(""),
})

const apiScoreSchema = z.object({
    home: z.number().nullable(),
    away: z.number().nullable(),
})

export const apiMatchSchema = z.object({
    fixture: z.object({
      id: z.number(),
      date: z.string(),
      timestamp: z.number(),
      status: z.object({
        long: z.string(),
        short: z.string(),
        elapsed: z.number().nullable(),
      }),
      venue: z.object({
        id: z.number().nullable().optional(),
        name: z.string().nullable().optional(),
        city: z.string().nullable().optional(),
      }).optional().nullable(),
      referee: z.string().nullable().optional(),
    }),
    league: z.object({
      id: z.number(),
      name: z.string(),
      country: z.string().optional().default(""),
      logo: z.string().optional().default(""),
      season: z.number(),
      round: z.string().optional().default(""),
    }),
    teams: z.object({
      home: apiTeamSchema,
      away: apiTeamSchema,
    }),
    goals: apiScoreSchema,
    score: z.object({
      halftime: apiScoreSchema,
      fulltime: apiScoreSchema,
      extratime: apiScoreSchema,
      penalty: apiScoreSchema,
    }),
})

export const apiScorerSchema = z.object({
    player: z.object({
        id: z.number(),
        name: z.string(),
        photo: z.string().optional().default(""),
        nationality: z.string().optional().default(""),
    }),
    statistics: z.array(z.object({
        goals: z.object({
          total: z.number().nullable(),
          assists: z.number().nullable(),
        }),
        games: z.object({
          appearences: z.number().nullable(),
        }),
        team: apiTeamSchema,
      })).min(1),
})

export const apiResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
    z.object({
      results: z.number(),
      errors: z.union([
        z.array(z.string()),
        z.record(z.string(), z.string())
      ]).optional(),
      response: z.array(itemSchema),
})

export const apiCountrySchema = z.object({
      name: z.string(),
      code: z.string().nullable(),
      flag: z.string().nullable(),
})

export const apiStandingSchema = z.object({
  rank: z.number(),
  points: z.number(),
  goalsDiff: z.number(),
  group: z.string().optional(),
  team: z.object({
    id: z.number(),
    name: z.string(),
    logo: z.string().optional().default(""),
  }),
  all: z.object({
    played: z.number(),
    win: z.number(),
    draw: z.number(),
    lose: z.number(),
    goals: z.object({
      for: z.number(),
      against: z.number(),
    }),
  }),
})

export const standingsResponseSchema = z.object({
  results: z.number(),
  response: z.array(
    z.object({
      league: z.object({
        id: z.number(),
        name: z.string(),
        logo: z.string().optional().default(""),
        season: z.number(),
        standings: z.array(z.array(apiStandingSchema)),
      }),
    })
  ),
})

export const apiEventSchema = z.object({
  time: z.object({ elapsed: z.number(), extra: z.number().nullable().optional() }),
  team: z.object({ id: z.number(), name: z.string(), logo: z.string().optional().default("") }),
  player: z.object({ id: z.number().nullable(), name: z.string().nullable() }),
  assist: z.object({ id: z.number().nullable(), name: z.string().nullable() }).optional().nullable(),
  type: z.string(),
  detail: z.string(),
});

export const apiLineupSchema = z.object({
  team: z.object({ id: z.number(), name: z.string(), logo: z.string().optional().default("") }),
  coach: z.object({ id: z.number().nullable(), name: z.string().nullable() }).optional().nullable(),
  formation: z.string().nullable().optional().transform((v) => v ?? ""),
  startXI: z.array(z.object({
    player: z.object({
      id: z.number().nullable().transform((v) => v ?? 0),
      name: z.string().nullable().optional().transform((v) => v ?? ""),
      number: z.number().nullable().optional().transform((v) => v ?? 0),
      pos: z.string().nullable(),
    })
  })).optional().default([]),
  substitutes: z.array(z.object({
    player: z.object({
      id: z.number().nullable().transform((v) => v ?? 0),
      name: z.string().nullable().optional().transform((v) => v ?? ""),
      number: z.number().nullable().optional().transform((v) => v ?? 0),
      pos: z.string().nullable(),
    })
  })).optional().default([]),
});

export const apiStatisticSchema = z.object({
  team: z.object({ id: z.number(), name: z.string(), logo: z.string().nullable().optional().transform((v) => v ?? "") }),
  statistics: z.array(z.object({
    type: z.string(),
    value: z.union([z.string(), z.number()]).nullable()
  })),
});

// Matches the top-level structure returned from API-Football
export const apiMatchDetailsItemSchema = z.object({
  fixture: z.object({
    id: z.number(),
    date: z.string(),
    timestamp: z.number(),
    status: z.object({
      short: z.string(),
      elapsed: z.number().nullable(),
    }),
  }),
  league: z.object({
    id: z.number(),
    name: z.string(),
    season: z.number(),
  }),
  teams: z.object({
    home: z.object({
      id: z.number(),
      name: z.string(),
      logo: z.string().optional().default(""),
    }),
    away: z.object({
      id: z.number(),
      name: z.string(),
      logo: z.string().optional().default(""),
    }),
  }),
  goals: z.object({
    home: z.number().nullable(),
    away: z.number().nullable(),
  }),
  events: z.array(apiEventSchema),
  lineups: z.array(apiLineupSchema),
  statistics: z.array(apiStatisticSchema),
})

    
export const countriesResponseSchema = apiResponseSchema(apiCountrySchema)
export const matchesResponseSchema = apiResponseSchema(apiMatchSchema)
export const scorersResponseSchema = apiResponseSchema(apiScorerSchema)
export const matchDetailsResponseSchema = apiResponseSchema(apiMatchDetailsItemSchema)