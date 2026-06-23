import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

const redis = Redis.fromEnv()

export const rateLimits = {
  public: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, "1 m"),
    prefix: "rl:public",
    analytics: false,
  }),
  authenticated: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(120, "1 m"),
    prefix: "rl:auth",
    analytics: false,
  }),
}

export function getClientIp(req: Request): string {
  // x-vercel-forwarded-for is set by Vercel's edge and cannot be spoofed by clients.
  // Fall back to the last IP in x-forwarded-for (Vercel appends the real IP at the end,
  // so taking [0] would allow a client to inject a fake leading IP and bypass rate limits).
  return (
    req.headers.get("x-vercel-forwarded-for") ??
    req.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() ??
    req.headers.get("x-real-ip") ??
    "127.0.0.1"
  )
}