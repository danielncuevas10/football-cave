import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import TopNav from "@/components/TopNav";
import Footer from "@/components/Footer";
import About from "@/components/About";
import BracketBottomSheet from "@/components/bracket/BracketBottomSheet";
import ConsentBanner from "@/components/ConsentBanner";
import { Analytics } from "@vercel/analytics/next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://football-cave.com";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  const description = t("siteDescription");

  return {
    metadataBase: new URL(siteUrl),
    title: "Football Cave",
    description,
    openGraph: {
      title: "Football Cave",
      description,
      url: siteUrl,
      siteName: "Football Cave",
      images: [
        {
          url: "/icon.jpg",
          width: 188,
          height: 188,
          alt: "Football Cave – Live Scores",
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary",
      title: "Football Cave",
      description,
      images: ["/icon.jpg"],
    },
    icons: {
      icon: "/icon.jpg",
      shortcut: "/icon.jpg",
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <meta name="google-adsense-account" content="ca-pub-8066520887443761" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('consent', 'default', {
                analytics_storage: 'denied',
                ad_storage: 'denied',
                ad_user_data: 'denied',
                ad_personalization: 'denied',
                wait_for_update: 2000
              });
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <TopNav />
          <div className="flex-1 min-h-screen pb-16 lg:pb-0">{children}</div>
          <BracketBottomSheet />
          <div className="mt-auto">
            <About />
            <Footer />
          </div>
          <Analytics />
          <ConsentBanner />
        </NextIntlClientProvider>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-BZ9FKC95GY"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-BZ9FKC95GY');
          `}
        </Script>
        <Script
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8066520887443761"
          strategy="afterInteractive"
          crossOrigin="anonymous"
        />
      </body>
    </html>
  );
}
