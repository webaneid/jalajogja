// Pengingat saldo produsen yang menganggur 30 hari (D10) — EMAIL saja. Harian. Fail-closed + timing-safe (pola cron produsen lain).
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { runProducerBalanceReminders } from "@/lib/producer-payout-notify.server";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("x-cron-secret") ?? "";
  const same = !!secret && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!same) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await runProducerBalanceReminders());
}
