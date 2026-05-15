import { NextRequest, NextResponse } from "next/server";

// ── In-memory sliding window rate limiter ────────────────────────────────────
// Aman untuk single-instance VPS. Tidak butuh Redis.
// Setiap entry: { count, resetAt (epoch ms) }

type Entry = { count: number; resetAt: number };
const store = new Map<string, Entry>();

// Cleanup berkala — hapus entry yang sudah expired agar Map tidak tumbuh terus
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 menit
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}, CLEANUP_INTERVAL);

export function checkRateLimit(
  key:      string,
  limit:    number,
  windowMs: number,
): { allowed: boolean; remaining: number; retryAfterMs: number } {
  const now   = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterMs: 0 };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, retryAfterMs: entry.resetAt - now };
  }

  entry.count++;
  return { allowed: true, remaining: limit - entry.count, retryAfterMs: 0 };
}

// ── IP helper ────────────────────────────────────────────────────────────────
// Nginx harus set header X-Real-IP atau X-Forwarded-For.
export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

// ── Ready-made guard — pakai di awal route handler ───────────────────────────
// Contoh: const blocked = rateLimitGuard(req, "lookup-member", 10, 60_000);
//         if (blocked) return blocked;
export function rateLimitGuard(
  req:      NextRequest,
  endpoint: string,
  limit:    number,
  windowMs: number,
): NextResponse | null {
  const ip  = getClientIp(req);
  const key = `${ip}:${endpoint}`;
  const { allowed, retryAfterMs } = checkRateLimit(key, limit, windowMs);

  if (allowed) return null;

  return NextResponse.json(
    { error: "Terlalu banyak permintaan. Coba lagi beberapa saat." },
    {
      status: 429,
      headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) },
    },
  );
}
