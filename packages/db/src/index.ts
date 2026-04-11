// Public schema db instance
export { db, type PublicDb } from "./client";

// Tenant db factory
export { createTenantDb, clearTenantCache, type TenantDb } from "./tenant-client";

// Semua schema (public + tenant types & constants)
export * from "./schema";

// Finance helpers
export {
  recordJournal,
  recordExpense,
  recordIncome,
  recordTransfer,
  getNextLetterNumber,
} from "./helpers/finance";
