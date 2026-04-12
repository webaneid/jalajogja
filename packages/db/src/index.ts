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
