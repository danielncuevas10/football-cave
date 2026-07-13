/**
 * Short display names for club teams whose API name is too long or differs
 * from the name fans actually use. Applied in all locales — club nicknames
 * are language-agnostic (PSG is PSG everywhere).
 */
const CLUB_SHORT_NAMES: Record<string, string> = {
  // Premier League
  "Manchester City":            "Man City",
  "Manchester United":          "Man United",
  "Wolverhampton Wanderers":    "Wolves",
  "Nottingham Forest":          "Nott'm Forest",
  "Tottenham Hotspur":          "Spurs",
  "West Ham United":            "West Ham",
  "Newcastle United":           "Newcastle",
  "Brighton & Hove Albion":     "Brighton",
  "Brighton And Hove Albion":   "Brighton",
  "Sheffield United":           "Sheffield Utd",
  "Leicester City":             "Leicester",

  // Ligue 1
  "Paris Saint Germain":        "PSG",
  "Paris Saint-Germain":        "PSG",
  "Olympique Lyonnais":         "Lyon",
  "Olympique de Marseille":     "Marseille",
  "Stade Rennais FC":           "Rennes",
  "Stade Brestois 29":          "Brest",

  // Bundesliga
  "Bayern München":             "Bayern",
  "FC Bayern München":          "Bayern",
  "Borussia Dortmund":          "Dortmund",
  "Borussia Mönchengladbach":   "M'gladbach",
  "Bayer Leverkusen":           "Leverkusen",
  "Eintracht Frankfurt":        "Frankfurt",
  "FSV Mainz 05":               "Mainz",
  "1899 Hoffenheim":            "Hoffenheim",
  "1. FC Köln":                 "Köln",
  "1. FC Heidenheim 1846":      "Heidenheim",
  "SV Darmstadt 98":            "Darmstadt",
  "SC Freiburg":                "Freiburg",
  "SC Paderborn 07":            "Paderborn",
  "SV Elversberg":              "Elversberg",
  "FC Augsburg":                "Augsburg",
  "FC Schalke 04":              "Schalke",
  "VfB Stuttgart":              "Stuttgart",
  "VfL Wolfsburg":              "Wolfsburg",
  "VfL Bochum":                 "Bochum",
  "Hamburger SV":               "Hamburg",
  "FC Union Berlin":            "Union Berlin",
  "RB Leipzig":                 "Leipzig",
  "Werder Bremen":              "Bremen",

  // Serie A
  "AC Milan":                   "Milan",
  "AS Roma":                    "Roma",
  "SS Lazio":                   "Lazio",
  "SSC Napoli":                 "Napoli",
  "ACF Fiorentina":             "Fiorentina",
  "US Lecce":                   "Lecce",
  "US Sassuolo":                "Sassuolo",
  "Hellas Verona":              "Verona",
  "FC Internazionale":          "Inter",

  // La Liga
  "Atletico Madrid":            "Atlético",
  "Atlético de Madrid":         "Atlético",
  "Deportivo Alavés":           "Alavés",
  "Deportivo La Coruna":        "D. La Coruña",
  "Real Sociedad":              "R. Sociedad",
  "Rayo Vallecano":             "Rayo",
  "Real Betis":                 "Betis",

  // Liga MX
  "U.N.A.M. - Pumas":          "Pumas",
  "Pumas U.N.A.M.":            "Pumas",
  "Pumas UNAM":                 "Pumas",
  "Club America":               "América",
  "Guadalajara Chivas":         "Chivas",
  "CF Pachuca":                 "Pachuca",
  "Club Queretaro":             "Querétaro",
  "Club Tijuana":               "Tijuana",
  "Tigres UANL":                "Tigres",
  "Santos Laguna":              "Santos",
  "Atletico San Luis":          "Atlético SL",
  "FC Juarez":                  "Juárez",
  "Atlante FC":                 "Atlante",

  // MLS
  "Los Angeles Galaxy":         "LA Galaxy",
  "Los Angeles FC":             "LAFC",
  "New York Red Bulls":         "NY Red Bulls",
  "New York City FC":           "NYCFC",
  "New England Revolution":     "New England",
  "Atlanta United FC":          "Atlanta Utd",
  "Minnesota United FC":        "Minnesota Utd",
  "San Jose Earthquakes":       "San Jose",
  "Colorado Rapids":            "Colorado",
  "Portland Timbers":           "Portland",
  "Seattle Sounders":           "Seattle",
  "Seattle Sounders FC":        "Seattle",
  "Sporting Kansas City":       "Kansas City",
  "Vancouver Whitecaps":        "Vancouver",
  "Vancouver Whitecaps FC":     "Vancouver",
  "CF Montreal":                "Montréal",
  "CF Montréal":                "Montréal",
  "FC Cincinnati":              "Cincinnati",
  "FC Dallas":                  "Dallas",
  "Orlando City SC":            "Orlando City",
  "Nashville SC":               "Nashville",
  "Chicago Fire FC":            "Chicago Fire",
  "DC United":                  "DC United",
  "Toronto FC":                 "Toronto",
  "Philadelphia Union":         "Philadelphia",
  "Real Salt Lake":             "Salt Lake",
  "St. Louis City":             "St. Louis",
  "St. Louis City SC":          "St. Louis",
  "Charlotte FC":               "Charlotte",
  "Austin FC":                  "Austin",
  "Houston Dynamo FC":          "Houston Dynamo",
  "Inter Miami CF":             "Inter Miami",

  // Champions League / international club names
  "FC Barcelona":               "Barcelona",
  "FC Porto":                   "Porto",
  "FC Bayern Munich":           "Bayern",
  "Paris Saint-Germain FC":     "PSG",
};

/**
 * Maps API team names to ISO 3166-1 alpha-2 codes so Intl.DisplayNames
 * can produce the correct localized country name automatically.
 * Club teams have no entry here and will always return their original name.
 */
const TEAM_TO_ISO: Record<string, string> = {
  // Americas
  Argentina: "AR", Bolivia: "BO", Brazil: "BR", Canada: "CA",
  Chile: "CL", Colombia: "CO", "Costa Rica": "CR", Cuba: "CU",
  "Dominican Republic": "DO", Ecuador: "EC", "El Salvador": "SV",
  Guatemala: "GT", Guyana: "GY", Haiti: "HT", Honduras: "HN",
  Jamaica: "JM", Mexico: "MX", Nicaragua: "NI", Panama: "PA",
  Paraguay: "PY", Peru: "PE", "Puerto Rico": "PR", Suriname: "SR",
  "Trinidad and Tobago": "TT", "Trinidad & Tobago": "TT",
  "United States": "US", USA: "US", Uruguay: "UY", Venezuela: "VE",
  Belize: "BZ", Bermuda: "BM", Barbados: "BB",
  "Antigua and Barbuda": "AG", Grenada: "GD",
  "St. Kitts & Nevis": "KN", "Saint Lucia": "LC",
  "Saint Vincent and the Grenadines": "VC",

  // Europe
  Albania: "AL", Andorra: "AD", Armenia: "AM", Austria: "AT",
  Azerbaijan: "AZ", Belarus: "BY", Belgium: "BE",
  "Bosnia and Herzegovina": "BA", "Bosnia-Herzegovina": "BA",
  "Bosnia & Herzegovina": "BA", Bosnia: "BA", Bulgaria: "BG", Croatia: "HR", Cyprus: "CY",
  Czechia: "CZ", "Czech Republic": "CZ", Denmark: "DK",
  Estonia: "EE", "Faroe Islands": "FO", Finland: "FI",
  France: "FR", Georgia: "GE", Germany: "DE", Gibraltar: "GI",
  Greece: "GR", Hungary: "HU", Iceland: "IS", Ireland: "IE",
  Italy: "IT", Kosovo: "XK", Latvia: "LV", Liechtenstein: "LI",
  Lithuania: "LT", Luxembourg: "LU", Malta: "MT", Moldova: "MD",
  Monaco: "MC", Montenegro: "ME", Netherlands: "NL",
  "North Macedonia": "MK", Norway: "NO", Poland: "PL",
  Portugal: "PT", Romania: "RO", Russia: "RU", "San Marino": "SM",
  Serbia: "RS", Slovakia: "SK", Slovenia: "SI", Spain: "ES",
  Sweden: "SE", Switzerland: "CH", Turkey: "TR", "Türkiye": "TR",
  Ukraine: "UA", Kazakhstan: "KZ", Uzbekistan: "UZ",
  Kyrgyzstan: "KG", Tajikistan: "TJ", Turkmenistan: "TM",

  // Africa
  Algeria: "DZ", Angola: "AO", Benin: "BJ", Botswana: "BW",
  "Burkina Faso": "BF", Burundi: "BI", Cameroon: "CM",
  "Cape Verde": "CV", "Cape Verde Islands": "CV", Curaçao: "CW",
  "Central African Republic": "CF", Chad: "TD",
  Comoros: "KM", Congo: "CG", "DR Congo": "CD", "Congo DR": "CD",
  Djibouti: "DJ", Egypt: "EG", "Equatorial Guinea": "GQ",
  Eritrea: "ER", Eswatini: "SZ", Ethiopia: "ET", Gabon: "GA",
  Gambia: "GM", Ghana: "GH", Guinea: "GN", "Guinea-Bissau": "GW",
  "Ivory Coast": "CI", "Cote D'Ivoire": "CI", "Côte d'Ivoire": "CI",
  Kenya: "KE", Lesotho: "LS", Liberia: "LR", Libya: "LY",
  Madagascar: "MG", Malawi: "MW", Mali: "ML", Mauritania: "MR",
  Mauritius: "MU", Morocco: "MA", Mozambique: "MZ", Namibia: "NA",
  Niger: "NE", Nigeria: "NG", Rwanda: "RW",
  "Sao Tome and Principe": "ST", Senegal: "SN", Seychelles: "SC",
  "Sierra Leone": "SL", Somalia: "SO", "South Africa": "ZA",
  "South Sudan": "SS", Sudan: "SD", Tanzania: "TZ", Togo: "TG",
  Tunisia: "TN", Uganda: "UG", Zambia: "ZM", Zimbabwe: "ZW",

  // Asia / Oceania
  Afghanistan: "AF", Australia: "AU", Bahrain: "BH", Bangladesh: "BD",
  Bhutan: "BT", Brunei: "BN", Cambodia: "KH", China: "CN",
  "China PR": "CN", "East Timor": "TL", "Timor-Leste": "TL",
  "Hong Kong": "HK", India: "IN", Indonesia: "ID", Iran: "IR",
  Iraq: "IQ", Israel: "IL", Japan: "JP", Jordan: "JO", Kuwait: "KW",
  Laos: "LA", Lebanon: "LB", Macau: "MO", Malaysia: "MY",
  Maldives: "MV", Mongolia: "MN", Myanmar: "MM", Nepal: "NP",
  "New Zealand": "NZ", "North Korea": "KP", "Korea DPR": "KP",
  Oman: "OM", Pakistan: "PK", Palestine: "PS", Philippines: "PH",
  Qatar: "QA", "Saudi Arabia": "SA", Singapore: "SG",
  "South Korea": "KR", "Korea Republic": "KR", "Sri Lanka": "LK",
  Syria: "SY", Thailand: "TH", UAE: "AE",
  "United Arab Emirates": "AE", Vietnam: "VN", Yemen: "YE",
  Fiji: "FJ", "Papua New Guinea": "PG", "Solomon Islands": "SB",
  Tahiti: "PF", Tonga: "TO", Vanuatu: "VU", Samoa: "WS",
};

/**
 * Manual overrides for teams that share an ISO code with a larger country
 * (UK home nations) or have unusual spellings in the API.
 */
const TEAM_OVERRIDES: Record<string, Partial<Record<string, string>>> = {
  England: {
    es: "Inglaterra", fr: "Angleterre", pt: "Inglaterra",
    bs: "Engleska", sr: "Engleska", ch: "英格兰", gr: "Αγγλία",
    jp: "イングランド", kr: "잉글랜드", tr: "İngiltere",
  },
  Scotland: {
    es: "Escocia", fr: "Écosse", pt: "Escócia",
    bs: "Škotska", sr: "Škotska", ch: "苏格兰", gr: "Σκωτία",
    jp: "スコットランド", kr: "스코틀랜드", tr: "İskoçya",
  },
  Wales: {
    es: "Gales", fr: "Pays de Galles", pt: "País de Gales",
    bs: "Wales", sr: "Vels", ch: "威尔士", gr: "Ουαλία",
    jp: "ウェールズ", kr: "웨일스", tr: "Galler",
  },
  "Northern Ireland": {
    es: "Irlanda del Norte", fr: "Irlande du Nord", pt: "Irlanda do Norte",
    bs: "Sjeverna Irska", sr: "Severna Irska", ch: "北爱尔兰", gr: "Βόρεια Ιρλανδία",
    jp: "北アイルランド", kr: "북아일랜드", tr: "Kuzey İrlanda",
  },
  // Explicit translations — Intl.DisplayNames coverage for CV/CW is inconsistent
  // across runtimes (edge / small-ICU builds). These ensure correct names everywhere.
  "Cape Verde Islands": {
    es: "Cabo Verde", fr: "Cap-Vert", pt: "Cabo Verde",
    bs: "Zelenortska Ostrva", sr: "Zelenortska Ostrva", ch: "佛得角",
    gr: "Πράσινο Ακρωτήριο", jp: "カーボベルデ", kr: "카보베르데", tr: "Cabo Verde",
  },
  "Cape Verde": {
    es: "Cabo Verde", fr: "Cap-Vert", pt: "Cabo Verde",
    bs: "Zelenortska Ostrva", sr: "Zelenortska Ostrva", ch: "佛得角",
    gr: "Πράσινο Ακρωτήριο", jp: "カーボベルデ", kr: "카보베르데", tr: "Cabo Verde",
  },
  Curaçao: {
    es: "Curazao", fr: "Curaçao", pt: "Curaçau",
    bs: "Kurasao", sr: "Kurasao", ch: "库拉索",
    gr: "Κουρασάο", jp: "キュラソー", kr: "퀴라소", tr: "Curaçao",
  },
};

const LOCALE_TO_BCP47: Record<string, string> = {
  en: "en-GB", es: "es-ES", fr: "fr-FR", pt: "pt-PT",
  bs: "bs-BA", sr: "sr-Latn", ch: "zh-CN", gr: "el-GR",
  jp: "ja-JP", kr: "ko-KR", tr: "tr-TR",
};

/**
 * Strips the "UEFA " prefix that the API prepends to competition names.
 * "UEFA Champions League" → "Champions League", etc.
 */
export function cleanLeagueName(name: string | null | undefined): string | null {
  if (!name) return name ?? null;
  return name.replace(/^UEFA\s+/i, "");
}

/**
 * Returns the localized display name for a national team.
 * Club teams (no ISO entry) are returned unchanged.
 * Falls back to the original name on any error.
 */
export function getLocalizedTeamName(name: string, appLocale: string): string {
  if (!name) return name;

  // Club short names apply in every locale — "PSG" is "PSG" everywhere
  const short = CLUB_SHORT_NAMES[name];
  if (short) return short;

  if (appLocale === "en") return name;

  // Sub-national teams that need manual overrides
  const override = TEAM_OVERRIDES[name];
  if (override?.[appLocale]) return override[appLocale]!;

  // Look up ISO code — if absent this is a club, return as-is
  const isoCode = TEAM_TO_ISO[name];
  if (!isoCode) return name;

  const bcp47 = LOCALE_TO_BCP47[appLocale] ?? "en-GB";
  try {
    const displayNames = new Intl.DisplayNames([bcp47], { type: "region" });
    return displayNames.of(isoCode) ?? name;
  } catch {
    return name;
  }
}
