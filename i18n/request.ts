import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";

const locales = ["en", "es", "fr", "pt", "it", "bs", "sr", "ch", "gr", "jp", "kr", "tr"];
const defaultLocale = "en";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("locale")?.value;

  let locale: string;
  if (cookieLocale && locales.includes(cookieLocale)) {
    locale = cookieLocale;
  } else {
    // On first visit the cookie hasn't reached the browser yet.
    // The proxy forwards the detected locale as a request header instead.
    const headerStore = await headers();
    const detected = headerStore.get("x-detected-locale");
    locale = detected && locales.includes(detected) ? detected : defaultLocale;
  }

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
