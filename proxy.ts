import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const locales = ["en", "es", "fr", "pt", "bs", "ch", "gr", "jp", "kr", "tr"];
const defaultLocale = "en";

// Maps standard Accept-Language codes → our locale codes
const acceptLanguageMap: Record<string, string> = {
  es: "es",
  fr: "fr",
  pt: "pt",
  bs: "bs",
  hr: "bs",
  zh: "ch",
  el: "gr",
  ja: "jp",
  ko: "kr",
  tr: "tr",
};

// Maps Vercel ISO country codes → our locale codes
const countryMap: Record<string, string> = {
  ES: "es", MX: "es", AR: "es", CO: "es", CL: "es", PE: "es", VE: "es",
  UY: "es", EC: "es", BO: "es", PY: "es", CR: "es", GT: "es", CU: "es",
  FR: "fr", BE: "fr", CH: "fr",
  BR: "pt", PT: "pt", AO: "pt", MZ: "pt",
  BA: "bs",
  CN: "ch", TW: "ch", HK: "ch", SG: "ch",
  GR: "gr",
  JP: "jp",
  KR: "kr",
  TR: "tr",
};

function detectLocale(request: NextRequest): string {
  const acceptLanguage = request.headers.get("accept-language");
  if (acceptLanguage) {
    const ranked = acceptLanguage
      .split(",")
      .map((seg) => {
        const [tag, qStr] = seg.trim().split(";q=");
        const base = tag.split("-")[0].toLowerCase();
        return { base, q: qStr ? parseFloat(qStr) : 1 };
      })
      .sort((a, b) => b.q - a.q);

    for (const { base } of ranked) {
      if (acceptLanguageMap[base]) return acceptLanguageMap[base];
      if (locales.includes(base)) return base;
    }
  }

  const country = request.headers.get("x-vercel-ip-country");
  if (country && countryMap[country]) return countryMap[country];

  return defaultLocale;
}

export function proxy(request: NextRequest) {
  const existing = request.cookies.get("locale")?.value;
  if (existing && locales.includes(existing)) {
    return NextResponse.next();
  }

  const locale = detectLocale(request);

  // Forward the detected locale to server components via a request header
  // so i18n/request.ts can use it on the very first render (before the
  // Set-Cookie reaches the browser and comes back as a request cookie).
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-detected-locale", locale);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.cookies.set("locale", locale, {
    path: "/",
    maxAge: 31536000,
    sameSite: "lax",
  });
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon\\.ico|images|icon).*)"],
};