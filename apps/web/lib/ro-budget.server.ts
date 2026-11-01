// Anggaran panggilan API RajaOngkir per hari (kuota gratis 100/hari). Penghitung ada di DB (public.ro_api_usage) sehingga berlaku
// lintas proses dan lintas tenant. Doc: docs/arsitektur-alamat.md § 11. Naikkan batas saat paket berbayar.
import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@jalajogja/db";

/**
 * Pencarian publik ≤ 20, pemulihan tujuan saat checkout ≤ 10 (terpisah supaya tak bisa dihabiskan pencarian publik),
 * ongkir untuk form publik (`cost`) ≤ 35, ongkir untuk verifikasi checkout (`costverify`) ≤ 25 — terpisah supaya berat/tujuan acak
 * lewat endpoint publik tak bisa menghabiskan jatah pembeli yang sudah sampai tahap bayar — sisanya (10) cadangan.
 */
export const RO_DAILY_LIMITS = { search: 20, resolve: 10, cost: 35, costverify: 25 } as const;
export type RoKind = keyof typeof RO_DAILY_LIMITS;

/** Tanggal hari ini di WIB ('YYYY-MM-DD'). */
export function todayWib(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
}

/** Ambil jatah 1 panggilan secara atomik. false = anggaran hari ini habis (JANGAN memanggil API). */
export async function tryConsumeApiBudget(kind: RoKind): Promise<boolean> {
  const day = todayWib();
  const limit = RO_DAILY_LIMITS[kind];
  const rows = await db.execute(sql`
    INSERT INTO public.ro_api_usage (day, kind, count) VALUES (${day}, ${kind}, 1)
    ON CONFLICT (day, kind) DO UPDATE SET count = public.ro_api_usage.count + 1
    WHERE public.ro_api_usage.count < ${limit}
    RETURNING count
  `);
  return Array.from(rows).length > 0;
}

/** Upstream membalas 429 → anggap jatah jenis ini habis sampai besok. */
export async function markBudgetExhausted(kind: RoKind): Promise<void> {
  const day = todayWib();
  const limit = RO_DAILY_LIMITS[kind];
  await db.execute(sql`
    INSERT INTO public.ro_api_usage (day, kind, count) VALUES (${day}, ${kind}, ${limit})
    ON CONFLICT (day, kind) DO UPDATE SET count = GREATEST(public.ro_api_usage.count, ${limit})
  `);
}
