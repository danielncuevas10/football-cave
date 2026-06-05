import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

const locales = ["en", "es", "fr", "pt", "bs", "ch", "gr", "jp", "kr", "tr"];
const defaultLocale = "en";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const requested = cookieStore.get("locale")?.value ?? defaultLocale;
  const locale = locales.includes(requested) ? requested : defaultLocale;

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
