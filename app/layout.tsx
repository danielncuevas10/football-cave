import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import TopNav from "@/components/TopNav";
import Footer from "@/components/Footer";
import { Analytics } from "@vercel/analytics/next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://footballcave.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Football Cave",
  description: "Check the latest matches",
  openGraph: {
    title: "Football Cave",
    description: "Check the latest matches",
    url: siteUrl,
    siteName: "Football Cave",
    images: [
      {
        url: "/icon.jpg",
        width: 1200,
        height: 630,
        alt: "Football Cave – Live Scores",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Football Cave",
    description: "Check the latest matches",
    images: ["/icon.jpg"],
  },
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
  },
};

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
        <meta name="google-adsense-account" content="ca-pub-9195927112430047" />
      </head>
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <TopNav />
          {children}
          <script
            async
            src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9195927112430047"
            crossOrigin="anonymous"
          ></script>
          <Footer />
          <Analytics />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
