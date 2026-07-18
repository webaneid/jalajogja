/**
 * tenant-timezone.ts — Satu sumber kebenaran untuk semua operasi timezone tenant.
 *
 * Dipakai lintas apps/web (Event, Invoice/Billing, cron) DAN packages/db (createLinkedInvoice).
 * Ditempatkan di packages/db (bukan apps/web/lib) karena getTenantTimezone() butuh getSetting()
 * yang juga di sini — apps/web/lib/tenant-timezone.ts re-export dari file ini untuk kompatibilitas
 * import path yang sudah dipakai di banyak file.
 */

import { getSetting } from "./settings";
import type { TenantDb } from "../tenant-client";

// Fixed offset — Indonesia TIDAK punya DST, jadi lookup statis ini valid sepanjang tahun.
const TZ_OFFSET_HOURS: Record<string, number> = {
  "Asia/Jakarta":  7,
  "Asia/Makassar": 8,
  "Asia/Jayapura": 9,
  "UTC":           0,
};

const TZ_LABELS: Record<string, string> = {
  "Asia/Jakarta":  "WIB",
  "Asia/Makassar": "WITA",
  "Asia/Jayapura": "WIT",
  "UTC":           "UTC",
};

// Baca setting tenant (group "general", key "timezone"), fallback Asia/Jakarta kalau belum
// di-set atau nilainya tidak dikenal.
export async function getTenantTimezone(tenantDb: TenantDb): Promise<string> {
  const tz = await getSetting<string>(tenantDb, "timezone", "general");
  return tz && tz in TZ_OFFSET_HOURS ? tz : "Asia/Jakarta";
}

export function tzLabel(timezone: string): string {
  return TZ_LABELS[timezone] ?? "WIB";
}

// "Hari ini" di kalender timezone tsb, format YYYY-MM-DD — untuk LOGIC BISNIS (due date,
// cron "besok", tanggal jurnal), bukan display.
export function todayInTz(timezone: string): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: timezone });
}

// Anchor UTC-midnight yang MEWAKILI tanggal kalender timezone tsb — basis untuk hitung
// offset hari (due date +N, jadwal termin) via setUTCDate.
export function anchorTodayUtc(timezone: string): Date {
  const [y, m, d] = todayInTz(timezone).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

// Konversi <input type="datetime-local"> (wall-clock tanpa offset, mis. "2026-07-19T19:00")
// → UTC ISO string, diinterpretasikan sebagai jam DI TIMEZONE TENANT (bukan timezone
// browser) — fixed-offset math, valid karena zona waktu Indonesia tidak punya DST.
export function localDatetimeToUtcIso(localValue: string, timezone: string): string {
  const offsetH = TZ_OFFSET_HOURS[timezone] ?? 7;
  const asIfUtcMs = Date.parse(`${localValue}:00.000Z`);
  return new Date(asIfUtcMs - offsetH * 3600_000).toISOString();
}

// Kebalikannya — isi ulang <input type="datetime-local"> dari nilai UTC di DB, ditampilkan
// sebagai wall-clock DI TIMEZONE TENANT (bukan browser admin).
export function utcIsoToLocalDatetime(isoValue: string, timezone: string): string {
  const offsetH = TZ_OFFSET_HOURS[timezone] ?? 7;
  const d = new Date(new Date(isoValue).getTime() + offsetH * 3600_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

// Format tanggal+jam untuk DISPLAY, timezone dinamis (bukan hardcode). Dipakai server
// component/API route (tanpa "use client") maupun sebagai basis formatDate di client
// component (yang terima timezone dari prop, bukan fetch sendiri — client tidak bisa akses DB).
export function formatInTz(
  date: Date | string | null,
  timezone: string,
  opts: Intl.DateTimeFormatOptions,
): string {
  if (!date) return "-";
  return new Intl.DateTimeFormat("id-ID", { timeZone: timezone, ...opts }).format(
    typeof date === "string" ? new Date(date) : date,
  );
}
