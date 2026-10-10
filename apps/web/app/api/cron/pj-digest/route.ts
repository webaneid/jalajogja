export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { runPjDigests } from "@/lib/pj-notification.server";

// Ringkasan ke Penanggung Jawab modul (bendahara 13.00/16.00/18.00, sekretariat 16.00 — jam lokal
// tenant). Dipicu crontab VPS TIAP JAM (menit mana saja); penanda per modul+jam mencegah kirim ganda.
// Auth via x-cron-secret, pola sama dengan cron lain. Lihat docs/arsitektur-notifikasi-pengurus.md § 8.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const sent = await runPjDigests();
    return NextResponse.json({ ok: true, sent });
  } catch (err) {
    console.error("[cron/pj-digest]", err);
    return NextResponse.json({ error: "Gagal" }, { status: 500 });
  }
}
