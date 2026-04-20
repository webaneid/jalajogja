import { notFound } from "next/navigation";
import { db, tenants } from "@jalajogja/db";
import { eq } from "drizzle-orm";
import { createTenantDb } from "@jalajogja/db";
import {
  InvoicePublicClient,
  type PublicInvoiceData,
} from "@/components/billing/invoice-public-client";
import { getSettings } from "@jalajogja/db";

type Props = { params: Promise<{ tenant: string; id: string }> };

export default async function PublicInvoicePage({ params }: Props) {
  const { tenant: slug, id: invoiceId } = await params;

  // Validasi tenant
  const [tenant] = await db
    .select({ id: tenants.id, name: tenants.name })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);

  if (!tenant) notFound();

  const tenantClient = createTenantDb(slug);
  const { db: tenantDb, schema } = tenantClient;

  // Fetch invoice
  const [inv] = await tenantDb
    .select()
    .from(schema.invoices)
    .where(eq(schema.invoices.id, invoiceId))
    .limit(1);

  if (!inv) notFound();

  // Fetch invoice items
  const items = await tenantDb
    .select()
    .from(schema.invoiceItems)
    .where(eq(schema.invoiceItems.invoiceId, invoiceId))
    .orderBy(schema.invoiceItems.sortOrder);

  // Ambil rekening bank untuk instruksi pembayaran
  let bankAccounts: PublicInvoiceData["bankAccounts"] = [];
  try {
    const paymentSettings = await getSettings(tenantClient, "payment");
    const bankData = paymentSettings["bank_accounts"];
    if (Array.isArray(bankData)) {
      bankAccounts = bankData
        .filter((acc: { categories?: string[] }) => {
          const cats: string[] = acc.categories ?? ["general"];
          return cats.includes("general") || cats.includes("toko");
        })
        .map((acc: { bankName: string; accountNumber: string; accountName: string }) => ({
          bankName:      acc.bankName,
          accountNumber: acc.accountNumber,
          accountName:   acc.accountName,
        }));
    }
  } catch {
    // Lanjut tanpa rekening
  }

  const total     = parseFloat(String(inv.total));
  const paid      = parseFloat(String(inv.paidAmount));
  const remaining = Math.max(0, total - paid);

  const invoice: PublicInvoiceData = {
    id:            inv.id,
    invoiceNumber: inv.invoiceNumber,
    status:        inv.status,
    customerName:  inv.customerName,
    customerPhone: inv.customerPhone,
    customerEmail: inv.customerEmail,
    subtotal:      parseFloat(String(inv.subtotal)),
    discount:      parseFloat(String(inv.discount)),
    total,
    paidAmount:    paid,
    remaining,
    dueDate:       inv.dueDate,
    notes:         inv.notes,
    createdAt:     inv.createdAt.toISOString(),
    items: items.map((it) => ({
      id:          it.id,
      name:        it.name,
      description: it.description,
      unitPrice:   parseFloat(String(it.unitPrice)),
      quantity:    it.quantity,
      total:       parseFloat(String(it.total)),
    })),
    bankAccounts,
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="mb-6">
          <p className="text-sm text-muted-foreground">{tenant.name}</p>
        </div>
        <InvoicePublicClient slug={slug} invoice={invoice} />
      </div>
    </main>
  );
}
