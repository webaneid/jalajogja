import "server-only";
import { getTenantTimezone } from "@jalajogja/db";

// getTenantTimezone() butuh DB (getSetting) — TIDAK aman diimpor dari komponen client.
// "server-only" memaksa build error eksplisit kalau ada file client yang mengimpor ini,
// alih-alih silent module-not-found di production build (persis kejadian sebelumnya di
// nav-menu.ts). Semua file server (Server Component, Server Action, API route, cron)
// yang butuh getTenantTimezone() WAJIB import dari sini, BUKAN dari "@/lib/tenant-timezone"
// (yang sekarang murni fungsi pure, zero dependency ke @jalajogja/db).
export { getTenantTimezone };

// Re-export fungsi pure juga supaya file server cukup 1 import line untuk semuanya.
export {
  tzLabel,
  todayInTz,
  anchorTodayUtc,
  localDatetimeToUtcIso,
  utcIsoToLocalDatetime,
  formatInTz,
} from "./tenant-timezone";
