import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"

const withNextIntl = createNextIntlPlugin("./i18n/request.ts")

const csp = [
  "default-src 'self'",

  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.googlesyndication.com https://*.googleadservices.com https://*.doubleclick.net https://www.googletagmanager.com https://challenges.cloudflare.com",

  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",

  "img-src 'self' data: blob: https:",

  "font-src 'self' https://fonts.gstatic.com",

  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://v3.football.api-sports.io https://*.google-analytics.com https://*.googlesyndication.com",

  "frame-src https://*.doubleclick.net https://*.googlesyndication.com https://challenges.cloudflare.com",

  "media-src 'self' https:",

  "form-action 'self'",

  "object-src 'none'",

  "base-uri 'self'",

  "upgrade-insecure-requests",
].join("; ")

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "media.api-sports.io",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: csp.replace(/\n/g, ""),
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ]
  },
}

export default withNextIntl(nextConfig)