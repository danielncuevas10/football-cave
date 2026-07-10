import { NextRequest, NextResponse } from "next/server"
import { rateLimits, getClientIp } from "./ratelimit"

export async function guardRoute(req: NextRequest): Promise<NextResponse | null> {
  const ip = getClientIp(req)
  const { success, limit, reset } = await rateLimits.public.limit(`ip:${ip}`)

  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Try again shortly." },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": limit.toString(),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": new Date(reset).toISOString(),
          "Retry-After": Math.ceil((reset - Date.now()) / 1000).toString(),
        },
      }
    )
  }
  return null
}

// Protects server-only routes (standings, scorers) from browser calls.
// Caller must send: Authorization: Bearer <CRON_SECRET>
export function verifyCronSecret(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get("authorization") ?? ""
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  return null
}