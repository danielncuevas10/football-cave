/**
 * Returns a local high-quality SVG path for API Football flag URLs.
 * Falls back to the original URL if the country code isn't in our local set.
 *
 * API Football flags: https://media.api-sports.io/flags/{code}.svg
 * Local flags:        /images/flags/{code}.svg  (from lipis/flag-icons, MIT)
 */
export function resolveFlag(apiUrl: string | null): string | null {
  if (!apiUrl) return null;
  if (!apiUrl.includes("/flags/")) return apiUrl;
  const filename = apiUrl.split("/flags/")[1]; // e.g. "br.svg"
  if (!filename) return apiUrl;
  return `/images/flags/${filename}`;
}
