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
  "United States": "US", Uruguay: "UY", Venezuela: "VE",
  Belize: "BZ", Bermuda: "BM", Barbados: "BB",
  "Antigua and Barbuda": "AG", Grenada: "GD",
  "St. Kitts & Nevis": "KN", "Saint Lucia": "LC",
  "Saint Vincent and the Grenadines": "VC",

  // Europe
  Albania: "AL", Andorra: "AD", Armenia: "AM", Austria: "AT",
  Azerbaijan: "AZ", Belarus: "BY", Belgium: "BE",
  "Bosnia and Herzegovina": "BA", "Bosnia-Herzegovina": "BA",
  Bosnia: "BA", Bulgaria: "BG", Croatia: "HR", Cyprus: "CY",
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
  "Cape Verde": "CV", "Central African Republic": "CF", Chad: "TD",
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
};

const LOCALE_TO_BCP47: Record<string, string> = {
  en: "en-GB", es: "es-ES", fr: "fr-FR", pt: "pt-PT",
  bs: "bs-BA", sr: "sr-Latn", ch: "zh-CN", gr: "el-GR",
  jp: "ja-JP", kr: "ko-KR", tr: "tr-TR",
};

/**
 * Returns the localized display name for a national team.
 * Club teams (no ISO entry) are returned unchanged.
 * Falls back to the original name on any error.
 */
export function getLocalizedTeamName(name: string, appLocale: string): string {
  if (!name) return name;
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
