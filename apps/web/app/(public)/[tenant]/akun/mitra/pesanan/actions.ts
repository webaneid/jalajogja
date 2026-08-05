"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db, members, createTenantDb, recordIncome, generateFinancialNumber } from "@jalajogja/db";
import { eq, and, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getTenantTimezone, todayInTz } from "@/lib/tenant-timezone.server";

export async function updateShippingTrackingAction(
  slug: string,
  shippingLineId: string,
  trackingNumber: string,
): Promise<{ success: true } | { error: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return { error: "Login diperlukan" };

  const member = await db.query.members.findFirst({
    where: eq(members.betterAuthUserId, session.user.id),
    columns: { id: true },
  });
  if (!member) return { error: "Bukan anggota IKPM" };

  const { db: tdb, schema } = createTenantDb(slug);

  const [mitra] = await tdb
    .select({ id: schema.mitras.id })
    .from(schema.mitras)
    .where(and(eq(schema.mitras.memberId, member.id), eq(schema.mitras.status, "active")))
    .limit(1);
  if (!mitra) return { error: "Bukan mitra aktif" };

  // Pastikan shipping line milik mitra ini
  const [line] = await tdb
    .select({ id: schema.invoiceShippingLines.id, sellerId: schema.invoiceShippingLines.sellerId })
    .from(schema.invoiceShippingLines)
    .where(eq(schema.invoiceShippingLines.id, shippingLineId))
    .limit(1);

  if (!line || line.sellerId !== mitra.id) return { error: "Data pengiriman tidak ditemukan" };

  const resi = trackingNumber.trim();

  await tdb
    .update(schema.invoiceShippingLines)
    .set({
      trackingNumber: resi || null,
      shippedAt:      resi ? new Date() : null,
      status:         resi ? "shipped" : "pending",
      updatedAt:      new Date(),
    })
    .where(eq(schema.invoiceShippingLines.id, shippingLineId));

  revalidatePath(`/${slug}/akun/mitra/pesanan`);
  return { success: true };
}

// ─── COD (Bayar di Tempat) — konfirmasi porsi mitra sendiri ──────────────────
// Lihat docs/arsitektur-billing.md § COD & Ambil Sendiri. Auth pola sama
// updateShippingTrackingAction di atas (session → member → mitra aktif → verifikasi
// kepemilikan). Logic inti (lock invoice, insert payment, update paidAmount/status, jurnal,
// stamp codConfirmedAt) DUPLIKASI DISENGAJA dari confirmCodPaymentAction versi admin
// (finance/billing/actions.ts) — konsisten pola project ini untuk jalur admin vs self-service
// yang menyentuh uang. `resolveAccountMappingsForBilling` di-import lintas route group karena
// murni resolusi konfigurasi akun (tanpa auth/session di dalamnya) — duplikasi logic mapping
// akun yang punya banyak fallback akan lebih berisiko drift daripada reuse fungsi ini.
export async function confirmMitraCodReceivedAction(
  slug: string,
  shippingLineId: string,
): Promise<{ success: true } | { error: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return { error: "Login diperlukan" };

  const member = await db.query.members.findFirst({
    where: eq(members.betterAuthUserId, session.user.id),
    columns: { id: true },
  });
  if (!member) return { error: "Bukan anggota IKPM" };

  const tenantDb = createTenantDb(slug);
  const { db: tdb, schema } = tenantDb;

  const [mitra] = await tdb
    .select({ id: schema.mitras.id })
    .from(schema.mitras)
    .where(and(eq(schema.mitras.memberId, member.id), eq(schema.mitras.status, "active")))
    .limit(1);
  if (!mitra) return { error: "Bukan mitra aktif" };

  const [line] = await tdb
    .select()
    .from(schema.invoiceShippingLines)
    .where(eq(schema.invoiceShippingLines.id, shippingLineId))
    .limit(1);

  if (!line || line.sellerType !== "mitra" || line.sellerId !== mitra.id)
    return { error: "Data pengiriman tidak ditemukan." };
  if (line.paymentMethod !== "cod") return { error: "Baris ini bukan pembayaran COD." };
  if (line.codConfirmedAt) return { error: "COD untuk baris ini sudah dikonfirmasi sebelumnya." };

  try {
    const { resolveAccountMappingsForBilling } = await import("../../../../../(dashboard)/app/[tenant]/finance/actions");
    const { cashAccountId, incomeAccountId } = await resolveAccountMappingsForBilling(tenantDb, "cash", "manual");
    if (!cashAccountId || !incomeAccountId) {
      return { error: "Konfigurasi mapping akun toko belum lengkap — hubungi admin toko." };
    }

    const tenantTimezone = await getTenantTimezone(tenantDb);

    // Jurnal (transaction_entries.created_by) WAJIB uuid tenant.users.id — mitra bukan
    // tenant.users sama sekali (dia public.members), jadi tidak punya id sendiri untuk kolom
    // ini. Atribusikan ke owner tenant (fallback: pengurus manapun yang paling lama terdaftar)
    // sebagai pemegang tanggung jawab pembukuan toko — payerNote + description journal tetap
    // menyebut eksplisit ini dikonfirmasi mitra, bukan diam-diam disamarkan sebagai aksi admin.
    const [ownerUser] = await tdb
      .select({ id: schema.users.id })
      .from(schema.users)
      .orderBy(sql`(${schema.users.role} = 'owner') DESC`, schema.users.createdAt)
      .limit(1);
    if (!ownerUser) {
      return { error: "Toko belum punya pengurus terdaftar — hubungi admin platform." };
    }

    await tdb.transaction(async (tx) => {
      const [lockedInv] = await tx
        .select()
        .from(schema.invoices)
        .where(sql`${schema.invoices.id} = ${line.invoiceId} FOR UPDATE`)
        .limit(1);
      if (!lockedInv) throw new Error("Invoice tidak ditemukan.");
      if (lockedInv.status === "cancelled") throw new Error("Invoice dibatalkan.");

      const [lockedLine] = await tx
        .select()
        .from(schema.invoiceShippingLines)
        .where(sql`${schema.invoiceShippingLines.id} = ${shippingLineId} FOR UPDATE`)
        .limit(1);
      if (!lockedLine) throw new Error("Data pengiriman tidak ditemukan.");
      if (lockedLine.codConfirmedAt) throw new Error("COD untuk baris ini sudah dikonfirmasi sebelumnya.");

      // Porsi milik mitra ini: subtotal item bertipe sellerType="mitra" sellerId=mitra.id
      // + ongkos baris shipping ini.
      // `invoice_items.total` SUDAH net dari discountAmount (lihat komentar schema di
      // billing.ts) — jangan kurangi discountAmount lagi di sini, itu double-subtraction.
      const [itemsAgg] = await tx
        .select({ subtotal: sql<string>`coalesce(sum(${schema.invoiceItems.total}), 0)` })
        .from(schema.invoiceItems)
        .where(and(
          eq(schema.invoiceItems.invoiceId, line.invoiceId),
          eq(schema.invoiceItems.sellerType, "mitra"),
          eq(schema.invoiceItems.sellerId, mitra.id),
        ));
      const amount = parseFloat(itemsAgg?.subtotal ?? "0") + parseFloat(String(lockedLine.cost));
      if (amount <= 0) throw new Error("Nominal COD tidak valid.");

      const total      = parseFloat(String(lockedInv.total));
      const uniqueCode = lockedInv.uniqueCode ?? 0;
      const amountDue  = total + uniqueCode;
      const paidSoFar  = parseFloat(String(lockedInv.paidAmount));
      const newPaidAmount = paidSoFar + amount;
      const newStatus     = newPaidAmount >= amountDue ? "paid" : "partial";

      const payNum = await generateFinancialNumber(tenantDb, "payment");
      const [payment] = await tx
        .insert(schema.payments)
        .values({
          number:      payNum,
          sourceType:  "invoice",
          sourceId:    line.invoiceId,
          amount:      amount.toFixed(2),
          uniqueCode:  0,
          method:      "cash",
          status:      "paid",
          payerName:   lockedInv.customerName,
          payerNote:   "COD dikonfirmasi oleh mitra",
          submittedAt: new Date(),
          confirmedAt: new Date(),
        })
        .returning({ id: schema.payments.id });

      await tx.insert(schema.invoicePayments).values({
        invoiceId: line.invoiceId,
        paymentId: payment.id,
        amount:    amount.toFixed(2),
      });

      await tx
        .update(schema.invoices)
        .set({ paidAmount: newPaidAmount.toFixed(2), status: newStatus, updatedAt: new Date() })
        .where(eq(schema.invoices.id, line.invoiceId));

      await tx
        .update(schema.invoiceShippingLines)
        .set({ codConfirmedAt: new Date(), codPaymentId: payment.id, updatedAt: new Date() })
        .where(eq(schema.invoiceShippingLines.id, shippingLineId));

      const txNum = await generateFinancialNumber(tenantDb, "journal");
      await recordIncome(tenantDb, {
        date:            todayInTz(tenantTimezone),
        description:     `COD ${lockedInv.invoiceNumber} — porsi mitra (dikonfirmasi mitra)`,
        referenceNumber: txNum,
        createdBy:       ownerUser.id,
        amount,
        cashAccountId,
        incomeAccountId,
      });
    });

    revalidatePath(`/${slug}/akun/mitra/pesanan`);
    revalidatePath(`/${slug}/invoice/${line.invoiceId}`);
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal konfirmasi COD." };
  }
}
