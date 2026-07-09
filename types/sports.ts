export enum League {
    WorldCup = 1,
    ChampionsLeague = 2,
    Friendly = 10,
    PremierLeague = 39,
    SerieA = 135,
    LaLiga = 140,
    MLS = 253,
    LigaMX = 262,
}

export type TournamentStage = "GROUP" | "R32" | "R16" | "QF" | "SF" | "FINAL" | "UNKNOWN";


export type FixtureStatus = 
| "NS" | "TBD" | "1H" | "HT" | "2H"
| "ET" | "BT" | "P" | "FT" | "AET"
| "PEN" | "SUSP" | "INT" | "PST"
| "CANC" | "ABD" | "AWD" | "WO" | "LIVE"

export const LIVE_STATUSES: FixtureStatus[] = [
    "1H", "HT", "2H", "ET", "BT", "P", "LIVE"
]

export const FINISHED_STATUSES: FixtureStatus[] = ["FT", "AET", "PEN", "AWD", "WO"]

export interface ApiTeam {
    readonly id:number,
    name:string,
    logo: string
}

export interface ApiScore {
    home: number | null,
    away: number | null
}

export interface ApiCountry {
    name: string,
    code: string | null,
    flag: string | null
}

export interface ApiMatch {
    fixture: {
        readonly id: number,
        date: string,
        timestamp: number
        status: {
            long: string,
            short: string,
            elapsed: number | null
        }
    }
    league: {
        readonly id: number,
        name: string,
        country: string,
        logo: string,
        season: number,
        round: string
    }
    teams: {
        home: ApiTeam,
        away: ApiTeam
    }
    goals: ApiScore
    score: {
        halftime: ApiScore,
        fulltime: ApiScore,
        extratime: ApiScore,
        penalty: ApiScore
    }
}

export interface ApiMatchDetails extends ApiMatch {
    events: MatchEvent[];
    lineups: TeamLineup[];
    statistics: TeamStatistics[];
}

export interface ApiTopScorer {
    player: {
        readonly id: number,
        name: string,
        photo: string, 
        nationality: string
    }
    statistics: Array<{
        goals: { total: number | null; assists: number | null },
        games: { appearences: number | null }
        cards: { yellow: number; red: number },
        team: ApiTeam
    }>
}

export interface ApiStanding {
    rank: number;
    team: {
      id: number;
      name: string;
      logo: string;
    };
    points: number;
    goalsDiff: number;
    group?: string;
    all: {
      played: number;
      win: number;
      draw: number;
      lose: number;
      goals: {
        for: number;
        against: number;
      };
    };
    update: string;
  }

export interface ApiResponse<T> {
    errors: string[] | Record<string, string>,
    results: number,
    response: T[]
}

export interface DbMatch {
    id: number
    home_team: string
    away_team: string
    home_logo: string | null
    away_logo: string | null
    home_score: number | null
    away_score: number | null
    penalty_home?: number | null
    penalty_away?: number | null
    status: FixtureStatus
    fixture_date: string
    league_id: number
    league_name: string | null
    league_logo: string | null
    round: string | null
    elapsed: number | null
    is_live: boolean
    updated_at: string
    stage?: TournamentStage | null;
  }

  export interface MatchEvent {
    time: { elapsed: number; extra?: number | null };
    team: { id: number; name: string; logo: string };
    player: { id: number; name: string };
    assist?: { id: number | null; name: string | null } | null;
    type: string;
    detail: string;
  }

  export interface TeamLineup {
    team: { id: number; name: string; logo: string };
    coach?: { id: number | null; name: string | null } | null;
    formation: string;
    startXI: { player: { id: number; name: string; number: number; pos: string | null; captain?: boolean } }[];
    substitutes: { player: { id: number; name: string; number: number; pos: string | null } }[];
  }
  
  export interface TeamStatistics {
    team: { id: number; name: string; logo: string };
    statistics: { type: string; value: string | number | null }[];
  }

  export interface DbMatchDetails {
    match_id: number;
    events: MatchEvent[];
    lineups: TeamLineup[];
    statistics: TeamStatistics[];
    updated_at: string;
    venue_name?: string | null;
    venue_city?: string | null;
    referee?: string | null;
  }
  
  export interface DbTopScorer {
    player_id: number
    player_name: string
    player_photo: string | null
    team_name: string | null
    goals: number
    assists: number
    appearances: number
    league_id: number
    season: number
    updated_at: string
  }

export interface DbStanding {
    team_id: number;
    team_name: string;
    team_logo: string;
    league_id: number;
    season: number;
    rank: number;
    points: number;
    played: number;
    won: number;
    drawn: number;
    lost: number;
    goals_for: number;
    goals_against: number;
    updated_at: string;
    group_name?: string | null;
  }
  
  export type Language = "en" | "es" | "pt" | "bs" | "gr"| "ch" | "kr" | "fr" | "jp"