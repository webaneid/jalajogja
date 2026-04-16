import { pgSchema } from "drizzle-orm/pg-core";
import { createUsersTable } from "./users";
import { createPagesTable, createPostCategoriesTable, createPostsTable, createPostTagsTable, createPostTagPivotTable, createMediaTable } from "./website";
import { createLetterTypesTable, createLetterContactsTable, createLetterTemplatesTable, createLettersTable, createLetterNumberSequencesTable } from "./letters";
import {
  createDivisionsTable,
  createOfficersTable,
  createLetterSignaturesTable,
} from "./officers";
import { createAccountsTable, createTransactionsTable, createTransactionEntriesTable, createBudgetsTable, createBudgetItemsTable, createPaymentsTable, createDisbursementsTable, createFinancialSequencesTable } from "./finance";
import { createProductCategoriesTable, createProductsTable, createOrdersTable, createOrderItemsTable } from "./shop";
import { createCampaignCategoriesTable, createCampaignsTable, createDonationsTable, createDonationSequencesTable } from "./donations";
import { createSettingsTable, createMenusTable, createMenuItemsTable } from "./settings";

// Cache schema objects — hindari buat ulang setiap request
const schemaCache = new Map<string, TenantSchema>();

function buildTenantSchema(slug: string) {
  const s = pgSchema(`tenant_${slug}`);
  return {
    // Akses dashboard per tenant (pemetaan Better Auth user → role)
    users: createUsersTable(s),
    // Website
    pages: createPagesTable(s),
    postCategories: createPostCategoriesTable(s),
    posts: createPostsTable(s),
    postTags: createPostTagsTable(s),
    postTagPivot: createPostTagPivotTable(s),
    media: createMediaTable(s),
    // Surat menyurat
    letterTypes:           createLetterTypesTable(s),
    letterContacts:        createLetterContactsTable(s),
    letterTemplates:       createLetterTemplatesTable(s),
    letters:               createLettersTable(s),
    letterNumberSequences: createLetterNumberSequencesTable(s),
    // Pengurus & Divisi organisasi
    divisions:        createDivisionsTable(s),
    officers:         createOfficersTable(s),
    letterSignatures: createLetterSignaturesTable(s),
    // Keuangan — jurnal double-entry
    accounts: createAccountsTable(s),
    transactions: createTransactionsTable(s),
    transactionEntries: createTransactionEntriesTable(s),
    budgets: createBudgetsTable(s),
    budgetItems: createBudgetItemsTable(s),
    // Universal payments & disbursements (uang masuk + keluar terpusat)
    payments: createPaymentsTable(s),
    disbursements: createDisbursementsTable(s),
    financialSequences: createFinancialSequencesTable(s),
    // Donasi
    campaignCategories: createCampaignCategoriesTable(s),
    campaigns:          createCampaignsTable(s),
    donations:          createDonationsTable(s),
    donationSequences:  createDonationSequencesTable(s),
    // Toko
    productCategories: createProductCategoriesTable(s),
    products: createProductsTable(s),
    orders: createOrdersTable(s),
    orderItems: createOrderItemsTable(s),
    // Settings & navigasi
    settings: createSettingsTable(s),
    menus: createMenusTable(s),
    menuItems: createMenuItemsTable(s),
  };
}

export function getTenantSchema(slug: string): TenantSchema {
  if (!schemaCache.has(slug)) {
    schemaCache.set(slug, buildTenantSchema(slug));
  }
  return schemaCache.get(slug)!;
}

export type TenantSchema = ReturnType<typeof buildTenantSchema>;

export * from "./users";
export * from "./website";
export * from "./letters";
export * from "./officers";
export * from "./finance";
export * from "./shop";
export * from "./donations";
export * from "./settings";
