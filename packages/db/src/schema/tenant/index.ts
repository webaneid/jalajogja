import { pgSchema } from "drizzle-orm/pg-core";
import { createUsersTable } from "./users";
import { createPagesTable, createPostCategoriesTable, createPostsTable, createPostTagsTable, createPostTagPivotTable, createMediaTable } from "./website";
import { createLettersTable, createLetterNumberSequencesTable } from "./letters";
import { createAccountsTable, createTransactionsTable, createTransactionEntriesTable, createBudgetsTable, createBudgetItemsTable, createPaymentConfirmationsTable } from "./finance";
import { createProductCategoriesTable, createProductsTable, createOrdersTable, createOrderItemsTable, createOrderPaymentsTable } from "./shop";
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
    letters: createLettersTable(s),
    letterNumberSequences: createLetterNumberSequencesTable(s),
    // Keuangan
    accounts: createAccountsTable(s),
    transactions: createTransactionsTable(s),
    transactionEntries: createTransactionEntriesTable(s),
    budgets: createBudgetsTable(s),
    budgetItems: createBudgetItemsTable(s),
    paymentConfirmations: createPaymentConfirmationsTable(s),
    // Toko
    productCategories: createProductCategoriesTable(s),
    products: createProductsTable(s),
    orders: createOrdersTable(s),
    orderItems: createOrderItemsTable(s),
    orderPayments: createOrderPaymentsTable(s),
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
export * from "./finance";
export * from "./shop";
export * from "./settings";
