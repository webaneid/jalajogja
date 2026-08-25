export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { type NextRequest } from "next/server";
import { db, tenants } from "@jalajogja/db";
import { eq, and } from "drizzle-orm";
import { isOwnHost } from "@/lib/is-own-host";
import { rateLimitGuard } from "@/lib/rate-limit";

const handler = toNextJsHandler(auth);

// Cek apakah hostname adalah custom domain tenant yang aktif di DB
async function isActiveCustomDomain(hostname: string): Promise<boolean> {
  if (isOwnHost(hostname)) return false;
  const [row] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(
      and(
        eq(tenants.customDomain, hostname),
        eq(tenants.customDomainStatus, "active"),
        eq(tenants.isActive, true),
      ),
    )
    .limit(1);
  return !!row;
}

export function GET(req: NextRequest) {
  return handler.GET(req);
}

export async function POST(req: NextRequest) {
  // Rate limit percobaan login — cegah brute-force tebak password. Sengaja
  // di-scope HANYA ke path sign-in (bukan seluruh catch-all Better Auth),
  // supaya tidak mengganggu get-session/sign-out yang wajar dipanggil sering
  // dari client. Dicek sebelum logic spoof-Origin custom domain di bawah —
  // limit berlaku terlepas domain mana yang dipakai.
  if (req.nextUrl.pathname.includes("/sign-in")) {
    const blocked = rateLimitGuard(req, "auth-sign-in", 10, 60_000);
    if (blocked) return blocked;
  }

  const origin = req.headers.get("origin");

  if (origin) {
    try {
      const hostname = new URL(origin).hostname;
      const isCustom = await isActiveCustomDomain(hostname);

      if (isCustom) {
        // Custom domain aktif — spoof Origin agar lolos Better Auth CSRF check.
        // Cookie domain ditentukan oleh Host header (tetap visikita.com), bukan Origin.
        const trustedOrigin = process.env.BETTER_AUTH_URL ?? "https://jalakarta.com";
        const modifiedHeaders = new Headers(req.headers);
        modifiedHeaders.set("origin", trustedOrigin);
        modifiedHeaders.set("referer", `${trustedOrigin}/`);

        const modifiedReq = new Request(req.url, {
          method:  req.method,
          headers: modifiedHeaders,
          body:    req.body,
          // @ts-expect-error — duplex diperlukan untuk streaming body di Node.js fetch
          duplex:  "half",
        });

        return handler.POST(modifiedReq as NextRequest);
      }
    } catch {
      // Origin bukan URL valid — fall through ke handler default
    }
  }

  return handler.POST(req);
}
