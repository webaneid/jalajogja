// Public schema db instance
export { db, type PublicDb } from "./client";

// Tenant db factory
export { createTenantDb, clearTenantCache, type TenantDb } from "./tenant-client";

// Semua schema (public + tenant types & constants)
export * from "./schema";

// Tenant schema provisioning
export { createTenantSchemaInDb } from "./helpers/create-tenant-schema";

// Finance helpers
export {
  recordJournal,
  recordExpense,
  recordIncome,
  recordTransfer,
  generateFinancialNumber,
  getNextLetterNumber,
} from "./helpers/finance";

// Member number generator (global sequence)
export { generateMemberNumber } from "./helpers/member-number";

// Settings helpers (tenant key-value config store)
export {
  getSettings,
  getSetting,
  upsertSetting,
  upsertSettings,
} from "./helpers/settings";

// Billing helpers — buat + sync invoice dari modul mana saja
export {
  createLinkedInvoice,
  syncInvoicePayment,
  generateUniqueCode,
  generateInstallmentScheduleCode,
  settleInstallmentSchedules,
  findEligibleInstallmentPlan,
  type LinkedInvoiceItem,
  type CreateLinkedInvoiceInput,
  type EligibleInstallmentPlan,
} from "./helpers/billing";

// Timezone tenant — satu sumber kebenaran untuk Event, Invoice/Billing, cron. Lihat
// packages/db/src/helpers/tenant-timezone.ts untuk penjelasan kenapa ditempatkan di sini
// (bukan apps/web/lib) — createLinkedInvoice juga memakainya.
export {
  getTenantTimezone,
  tzLabel,
  todayInTz,
  anchorTodayUtc,
  localDatetimeToUtcIso,
  utcIsoToLocalDatetime,
  formatInTz,
} from "./helpers/tenant-timezone";

// Identity resolution — lookup profile/member dari phone/email/session
export {
  resolveIdentity,
  type ResolvedIdentity,
} from "./helpers/resolve-identity";
