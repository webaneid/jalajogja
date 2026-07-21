import { notFound } from "next/navigation";
import { db, tenants } from "@jalajogja/db";
import { eq } from "drizzle-orm";
import { createTenantDb, getSettings, findEligibleInstallmentPlan } from "@jalajogja/db";
import { getTenantTimezone } from "@/lib/tenant-timezone.server";
import type { Metadata } from "next";
import {
  InvoicePublicClient,
  type PublicInvoiceData,
  type BankAccountPublic,
  type QrisAccountPublic,
} from "@/components/billing/invoice-public-client";

type Props = { params: Promise<{ tenant: string; id: string }> };

// SEO (docs/arsitektur-seo.md § 3.4) — data transaksi privat per-invoice. Tidak butuh title/
// desc custom, cukup dicegah ter-index — hardcode langsung, BUKAN lewat sistem override Fase 3.
export async function generateMetadata(): Promise<Metadata> {
  return { robots: { index: false, follow: false, googleBot: { index: false, follow: false } } };
}

function resolvePaymentCategory(itemTypes: string[]): "donasi" | "event" | "general" {
  if (itemTypes.length === 0) return "general";
  if (itemTypes.every((t) => t === "donation")) return "donasi";
  if (itemTypes.some((t) => t === "ticket"))    return "event";
  return "general";
}

// Cari akun dengan kategori spesifik dulu, fallback ke "general", fallback ke semua
function filterByCategory<T extends { categories: string[] }>(
  accounts: T[],
  category: string,
): T[] {
  const specific = accounts.filter((a) => a.categories.includes(category));
  if (specific.length > 0) return specific;
  const general = accounts.filter((a) => a.categories.includes("general"));
  if (general.length > 0) return general;
  return accounts;
}

export default async function PublicInvoicePage({ params }: Props) {
  const { tenant: slug, id: invoiceId } = await params;

  const [tenant] = await db
    .select({ id: tenants.id, name: tenants.name })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);

  if (!tenant) notFound();

  const tenantClient = createTenantDb(slug);
  const { db: tenantDb, schema } = tenantClient;

  const [inv] = await tenantDb
    .select()
    .from(schema.invoices)
    .where(eq(schema.invoices.id, invoiceId))
    .limit(1);

  if (!inv) notFound();

  const [items, shippingRows, paymentRows, scheduleRows, eligibleInstallmentPlan, tenantTimezone] = await Promise.all([
    tenantDb
      .select()
      .from(schema.invoiceItems)
      .where(eq(schema.invoiceItems.invoiceId, invoiceId))
      .orderBy(schema.invoiceItems.sortOrder),
    tenantDb
      .select()
      .from(schema.invoiceShippingLines)
      .where(eq(schema.invoiceShippingLines.invoiceId, invoiceId)),
    tenantDb
      .select({
        proofUrl:      schema.payments.proofUrl,
        status:        schema.payments.status,
        rejectionNote: schema.payments.rejectionNote,
      })
      .from(schema.invoicePayments)
      .innerJoin(schema.payments, eq(schema.invoicePayments.paymentId, schema.payments.id))
      .where(eq(schema.invoicePayments.invoiceId, invoiceId))
      .orderBy(schema.payments.createdAt),
    inv.installmentPlanId
      ? tenantDb.select().from(schema.installmentSchedules)
          .where(eq(schema.installmentSchedules.invoiceId, invoiceId))
          .orderBy(schema.installmentSchedules.termNumber)
      : Promise.resolve([]),
    findEligibleInstallmentPlan(tenantClient, invoiceId),
    getTenantTimezone(tenantClient),
  ]);

  const paymentCategory = resolvePaymentCategory(items.map((it) => it.itemType));

  let bankAccounts: BankAccountPublic[] = [];
  let qrisAccounts: QrisAccountPublic[] = [];

  try {
    const paymentSettings = await getSettings(tenantClient, "payment");

    const rawBanks = (paymentSettings["bank_accounts"] ?? []) as Array<{
      id: string; bankName: string; accountNumber: string; accountName: string; categories: string[];
    }>;
    const rawQris = (paymentSettings["qris_accounts"] ?? []) as Array<{
      id: string; name: string; imageUrl: string; categories: string[];
      isDynamic: boolean; emvPayload?: string;
    }>;

    const allBanks: BankAccountPublic[] = rawBanks.map((b) => ({
      id: b.id, bankName: b.bankName, accountNumber: b.accountNumber,
      accountName: b.accountName, categories: b.categories,
    }));
    const allQris: QrisAccountPublic[] = rawQris.map((q) => ({
      id: q.id, name: q.name, imageUrl: q.imageUrl,
      isDynamic: q.isDynamic, hasEmv: !!(q.isDynamic && q.emvPayload),
      categories: q.categories,
    }));

    bankAccounts = filterByCategory(allBanks, paymentCategory);
    qrisAccounts = filterByCategory(allQris, paymentCategory);
  } catch {
    // Lanjut tanpa rekening
  }

  const total      = parseFloat(String(inv.total));
  const uniqueCode = inv.uniqueCode ?? 0;
  const amountDue  = total + uniqueCode;
  const paid       = parseFloat(String(inv.paidAmount));
  const remaining  = Math.max(0, amountDue - paid);

  const submittedProofUrl = paymentRows.find(p => p.proofUrl)?.proofUrl ?? null;
  const rejectedPayment   = paymentRows.findLast(p => p.status === "rejected") ?? null;

  const invoice: PublicInvoiceData = {
    id:               inv.id,
    invoiceNumber:    inv.invoiceNumber,
    status:           inv.status,
    customerName:     inv.customerName,
    customerPhone:    inv.customerPhone,
    customerEmail:    inv.customerEmail,
    subtotal:         parseFloat(String(inv.subtotal)),
    shippingTotal:    parseFloat(String(inv.shippingTotal ?? 0)),
    discount:         parseFloat(String(inv.discount)),
    voucherCode:          inv.voucherCode ?? null,
    voucherDiscountTotal: parseFloat(String(inv.voucherDiscountTotal ?? "0")),
    total,
    uniqueCode,
    amountDue,
    paidAmount:       paid,
    remaining,
    dueDate:          inv.dueDate,
    notes:            inv.notes,
    createdAt:        inv.createdAt.toISOString(),
    shippingCityName: inv.shippingCityName ?? null,
    shippingAddress:  inv.shippingAddress ?? null,
    submittedProofUrl,
    rejectedPaymentNote: rejectedPayment?.rejectionNote ?? null,
    items: items.map((it) => ({
      id:          it.id,
      itemType:    it.itemType,
      name:        it.name,
      description: it.description,
      unitPrice:   parseFloat(String(it.unitPrice)),
      quantity:    it.quantity,
      discountAmount: parseFloat(String(it.discountAmount ?? "0")),
      total:       parseFloat(String(it.total)),
    })),
    shippingLines: shippingRows.map((sl) => ({
      id:             sl.id,
      sellerName:     sl.sellerName ?? "",
      courier:        sl.courier,
      service:        sl.service,
      etd:            sl.etd,
      cost:           parseFloat(String(sl.cost)),
      trackingNumber: sl.trackingNumber,
      shippedAt:      sl.shippedAt?.toISOString() ?? null,
      status:         sl.status as "pending" | "shipped" | "delivered",
    })),
    bankAccounts,
    qrisAccounts,
    installmentSchedules: scheduleRows.map((s) => ({
      id:         s.id,
      termNumber: s.termNumber,
      dueDate:    s.dueDate,
      amount:     parseFloat(String(s.amount)),
      status:     s.status,
      uniqueCode: s.uniqueCode ?? null,
    })),
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="mb-6">
          <p className="text-sm text-muted-foreground">{tenant.name}</p>
        </div>
        <InvoicePublicClient slug={slug} invoice={invoice} eligibleInstallmentPlan={eligibleInstallmentPlan} timezone={tenantTimezone} />
      </div>
    </main>
  );
}
