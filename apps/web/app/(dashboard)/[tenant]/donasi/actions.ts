"use server";

import { eq, and, sql, count } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { createTenantDb, recordIncome, generateFinancialNumber } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { hasFullAccess, canConfirmPayment } from "@/lib/permissions";

// ─── Types ────────────────────────────────────────────────────────────────────

type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export type CampaignData = {
  slug:          string;
  title:         string;
  description?:  string | null;
  categoryId?:   string | null;
  campaignType:  "donasi" | "zakat" | "wakaf" | "qurban";
  targetAmount?: number | null;
  coverId?:      string | null;
  status:        "draft" | "active" | "closed" | "archived";
  startsAt?:     Date | null;
  endsAt?:       Date | null;
  showDonorList: boolean;
  showAmount:    boolean;
  // SEO
  metaTitle?:     string | null;
  metaDesc?:      string | null;
  ogTitle?:       string | null;
  ogDescription?: string | null;
  ogImageId?:     string | null;
  twitterCard?:   "summary" | "summary_large_image" | null;
  focusKeyword?:  string | null;
  canonicalUrl?:  string | null;
  robots?:        "index,follow" | "noindex" | "noindex,nofollow";
  schemaType?:    string | null;
};

export type DonationData = {
  campaignId?:     string | null;
  donationType:    "donasi" | "zakat" | "wakaf" | "qurban";
  memberId?:       string | null;
  donorName:       string;
  donorPhone?:     string | null;
  donorEmail?:     string | null;
  donorMessage?:   string | null;
  isAnonymous:     boolean;
  // Payment fields
  amount:          number;
  method:          "cash" | "transfer" | "qris";
  bankAccountRef?: string | null;
  qrisAccountRef?: string | null;
};

// ─── Helper ───────────────────────────────────────────────────────────────────

function revalidateDonasi(slug: string) {
  revalidatePath(`/${slug}/donasi`);
  revalidatePath(`/${slug}/donasi/campaign`);
  revalidatePath(`/${slug}/donasi/transaksi`);
}

// Generate DON-YYYYMM-NNNNN — atomic SELECT FOR UPDATE via donation_sequences
async function generateDonationNumber(
  tenantDb: ReturnType<typeof createTenantDb>,
  now = new Date()
): Promise<string> {
  const { db, schema } = tenantDb;
  const year   = now.getFullYear();
  const month  = now.getMonth() + 1;
  const yyyymm = `${year}${String(month).padStart(2, "0")}`;

  const nextNumber = await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(schema.donationSequences)
      .where(
        sql`${schema.donationSequences.year}  = ${year}
        AND ${schema.donationSequences.month} = ${month}
        FOR UPDATE`
      );

    if (rows.length === 0) {
      await tx.insert(schema.donationSequences).values({ year, month, counter: 1 });
      return 1;
    }

    const next = rows[0].counter + 1;
    await tx
      .update(schema.donationSequences)
      .set({ counter: next })
      .where(eq(schema.donationSequences.id, rows[0].id));
    return next;
  });

  return `DON-${yyyymm}-${String(nextNumber).padStart(5, "0")}`;
}

// Resolusi akun donasi dari account_mappings settings
async function resolveDonationAccounts(tenantDb: ReturnType<typeof createTenantDb>) {
  const { db, schema } = tenantDb;
  const [row] = await db
    .select({ value: schema.settings.value })
    .from(schema.settings)
    .where(and(
      eq(schema.settings.key,   "account_mappings"),
      eq(schema.settings.group, "keuangan")
    ))
    .limit(1);

  const m = (row?.value && typeof row.value === "object")
    ? (row.value as Record<string, string | null>)
    : {};

  return {
    cash_default: (m.cash_default ?? null) as string | null,
    bank_default: (m.bank_default ?? null) as string | null,
    dana_titipan: (m.dana_titipan ?? null) as string | null,  // 2200 Dana Titipan
  };
}

// ─── Campaign Actions ─────────────────────────────────────────────────────────

// Pre-create pattern: buat draft kosong → redirect ke edit
export async function createCampaignDraftAction(
  slug: string
): Promise<ActionResult<{ campaignId: string }>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "donasi"))
    return { success: false, error: "Hanya admin yang bisa membuat campaign." };

  const { db, schema } = createTenantDb(slug);

  const draftSlug = `campaign-${Date.now()}`;
  const [campaign] = await db
    .insert(schema.campaigns)
    .values({
      slug:          draftSlug,
      title:         "Campaign Baru",
      description:   null,
      campaignType:  "donasi",
      status:        "draft",
      showDonorList: true,
      showAmount:    true,
    })
    .returning({ id: schema.campaigns.id });

  revalidateDonasi(slug);
  return { success: true, data: { campaignId: campaign.id } };
}

export async function createCampaignAction(
  slug: string,
  data: CampaignData
): Promise<ActionResult<{ campaignId: string }>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "donasi"))
    return { success: false, error: "Hanya admin yang bisa membuat campaign." };

  if (!data.title.trim()) return { success: false, error: "Judul campaign wajib diisi." };
  if (!data.slug.trim())  return { success: false, error: "Slug campaign wajib diisi." };

  const { db, schema } = createTenantDb(slug);

  try {
    const [campaign] = await db
      .insert(schema.campaigns)
      .values({
        slug:          data.slug.trim(),
        title:         data.title.trim(),
        description:   data.description   ?? null,
        categoryId:    data.categoryId     ?? null,
        campaignType:  data.campaignType,
        targetAmount:  data.targetAmount != null ? String(data.targetAmount) : null,
        coverId:       data.coverId        ?? null,
        status:        data.status,
        startsAt:      data.startsAt       ?? null,
        endsAt:        data.endsAt         ?? null,
        showDonorList: data.showDonorList,
        showAmount:    data.showAmount,
        metaTitle:     data.metaTitle?.trim()     || null,
        metaDesc:      data.metaDesc?.trim()      || null,
        ogTitle:       data.ogTitle?.trim()       || null,
        ogDescription: data.ogDescription?.trim() || null,
        ogImageId:     data.ogImageId             ?? null,
        twitterCard:   data.twitterCard           || "summary_large_image",
        focusKeyword:  data.focusKeyword?.trim()  || null,
        canonicalUrl:  data.canonicalUrl?.trim()  || null,
        robots:        data.robots                || "index,follow",
        schemaType:    data.schemaType            || "WebPage",
      })
      .returning({ id: schema.campaigns.id });

    revalidateDonasi(slug);
    return { success: true, data: { campaignId: campaign.id } };
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("unique"))
      return { success: false, error: "Slug sudah digunakan. Gunakan slug lain." };
    console.error("[createCampaignAction]", err);
    return { success: false, error: "Gagal membuat campaign." };
  }
}

export async function updateCampaignAction(
  slug: string,
  campaignId: string,
  data: CampaignData
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "donasi"))
    return { success: false, error: "Hanya admin yang bisa mengubah campaign." };

  if (!data.title.trim()) return { success: false, error: "Judul campaign wajib diisi." };

  const { db, schema } = createTenantDb(slug);

  try {
    await db
      .update(schema.campaigns)
      .set({
        slug:          data.slug.trim(),
        title:         data.title.trim(),
        description:   data.description   ?? null,
        categoryId:    data.categoryId     ?? null,
        campaignType:  data.campaignType,
        targetAmount:  data.targetAmount != null ? String(data.targetAmount) : null,
        coverId:       data.coverId        ?? null,
        status:        data.status,
        startsAt:      data.startsAt       ?? null,
        endsAt:        data.endsAt         ?? null,
        showDonorList: data.showDonorList,
        showAmount:    data.showAmount,
        metaTitle:     data.metaTitle?.trim()     || null,
        metaDesc:      data.metaDesc?.trim()      || null,
        ogTitle:       data.ogTitle?.trim()       || null,
        ogDescription: data.ogDescription?.trim() || null,
        ogImageId:     data.ogImageId             ?? null,
        twitterCard:   data.twitterCard           || "summary_large_image",
        focusKeyword:  data.focusKeyword?.trim()  || null,
        canonicalUrl:  data.canonicalUrl?.trim()  || null,
        robots:        data.robots                || "index,follow",
        schemaType:    data.schemaType            || "WebPage",
        updatedAt:     new Date(),
      })
      .where(eq(schema.campaigns.id, campaignId));

    revalidateDonasi(slug);
    revalidatePath(`/${slug}/donasi/campaign/${campaignId}`);
    return { success: true, data: undefined };
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("unique"))
      return { success: false, error: "Slug sudah digunakan. Gunakan slug lain." };
    console.error("[updateCampaignAction]", err);
    return { success: false, error: "Gagal menyimpan campaign." };
  }
}

// Siklus: draft → active → closed → archived → draft
export async function toggleCampaignStatusAction(
  slug: string,
  campaignId: string
): Promise<ActionResult<{ newStatus: string }>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "donasi"))
    return { success: false, error: "Hanya admin yang bisa mengubah status." };

  const { db, schema } = createTenantDb(slug);

  const [campaign] = await db
    .select({ status: schema.campaigns.status })
    .from(schema.campaigns)
    .where(eq(schema.campaigns.id, campaignId))
    .limit(1);

  if (!campaign) return { success: false, error: "Campaign tidak ditemukan." };

  const next: Record<string, string> = {
    draft:    "active",
    active:   "closed",
    closed:   "archived",
    archived: "draft",
  };
  const newStatus = next[campaign.status] ?? "draft";

  await db
    .update(schema.campaigns)
    .set({ status: newStatus as "draft" | "active" | "closed" | "archived", updatedAt: new Date() })
    .where(eq(schema.campaigns.id, campaignId));

  revalidateDonasi(slug);
  return { success: true, data: { newStatus } };
}

export async function deleteCampaignAction(
  slug: string,
  campaignId: string
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "donasi"))
    return { success: false, error: "Hanya admin yang bisa menghapus campaign." };

  const { db, schema } = createTenantDb(slug);

  const [{ total }] = await db
    .select({ total: count() })
    .from(schema.donations)
    .where(eq(schema.donations.campaignId, campaignId));

  if (Number(total) > 0)
    return { success: false, error: `Campaign sudah memiliki ${total} donasi dan tidak bisa dihapus. Arsipkan saja.` };

  await db.delete(schema.campaigns).where(eq(schema.campaigns.id, campaignId));

  revalidateDonasi(slug);
  return { success: true, data: undefined };
}

// ─── Donation Actions ─────────────────────────────────────────────────────────

/**
 * Buat donasi baru (admin entry manual).
 * 1. Generate DON-YYYYMM-NNNNN
 * 2. INSERT donations
 * 3. Generate 620-PAY-YYYYMM-NNNNN + unique_code (hanya untuk transfer)
 * 4. INSERT payments (source_type='donation', source_id=donations.id)
 */
export async function createDonationAction(
  slug: string,
  data: DonationData
): Promise<ActionResult<{
  donationId:  string;
  paymentId:   string;
  uniqueCode:  number;
  totalAmount: number;
}>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };

  if (!data.donorName.trim()) return { success: false, error: "Nama donatur wajib diisi." };
  if (!data.amount || data.amount <= 0) return { success: false, error: "Nominal donasi tidak valid." };

  const tenantDb = createTenantDb(slug);
  const { db, schema } = tenantDb;

  try {
    const donationNumber = await generateDonationNumber(tenantDb);
    const paymentNumber  = await generateFinancialNumber(tenantDb, "payment");
    // Unique code hanya untuk transfer manual — membantu identifikasi di mutasi bank
    const uniqueCode  = data.method === "transfer" ? Math.floor(Math.random() * 999) + 1 : 0;
    const totalAmount = data.amount + uniqueCode;

    const [donation] = await db
      .insert(schema.donations)
      .values({
        donationNumber,
        campaignId:   data.campaignId   ?? null,
        donationType: data.donationType,
        memberId:     data.memberId     ?? null,
        donorName:    data.donorName.trim(),
        donorPhone:   data.donorPhone   ?? null,
        donorEmail:   data.donorEmail   ?? null,
        donorMessage: data.donorMessage ?? null,
        isAnonymous:  data.isAnonymous,
      })
      .returning({ id: schema.donations.id });

    const [payment] = await db
      .insert(schema.payments)
      .values({
        number:         paymentNumber,
        sourceType:     "donation",
        sourceId:       donation.id,
        amount:         String(data.amount),
        uniqueCode,
        method:         data.method,
        bankAccountRef: data.bankAccountRef ?? null,
        qrisAccountRef: data.qrisAccountRef ?? null,
        // Cash langsung submitted — tidak perlu tunggu bukti transfer
        status:         data.method === "cash" ? "submitted" : "pending",
        memberId:       data.memberId ?? null,
        payerName:      data.donorName.trim(),
      })
      .returning({ id: schema.payments.id });

    revalidateDonasi(slug);
    return {
      success: true,
      data: { donationId: donation.id, paymentId: payment.id, uniqueCode, totalAmount },
    };
  } catch (err) {
    console.error("[createDonationAction]", err);
    return { success: false, error: "Gagal mencatat donasi." };
  }
}

/**
 * Konfirmasi donasi oleh admin — atomic:
 * 1. payments.status → paid
 * 2. campaigns.collected_amount += amount (jika ada campaign)
 * 3. recordIncome() → jurnal: debit Kas, kredit Dana Titipan (2200)
 */
export async function confirmDonationAction(
  slug: string,
  paymentId: string
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!canConfirmPayment(access.tenantUser, "donasi"))
    return { success: false, error: "Hanya admin yang bisa mengkonfirmasi donasi." };

  const tenantDb = createTenantDb(slug);
  const { db, schema } = tenantDb;

  const [payment] = await db
    .select()
    .from(schema.payments)
    .where(eq(schema.payments.id, paymentId))
    .limit(1);

  if (!payment) return { success: false, error: "Data pembayaran tidak ditemukan." };
  if (payment.sourceType !== "donation") return { success: false, error: "Bukan pembayaran donasi." };
  if (payment.status === "paid") return { success: false, error: "Donasi sudah dikonfirmasi sebelumnya." };

  const [donation] = await db
    .select({ id: schema.donations.id, campaignId: schema.donations.campaignId })
    .from(schema.donations)
    .where(eq(schema.donations.id, payment.sourceId!))
    .limit(1);

  if (!donation) return { success: false, error: "Data donasi tidak ditemukan." };

  const mappings       = await resolveDonationAccounts(tenantDb);
  const cashAccountId  = mappings.cash_default ?? mappings.bank_default;
  const incomeAccountId = mappings.dana_titipan;

  if (!cashAccountId || !incomeAccountId) {
    return {
      success: false,
      error:  "Mapping akun Dana Titipan belum dikonfigurasi. Atur di Keuangan → Akun → Mapping.",
    };
  }

  const amount = parseFloat(String(payment.amount));

  try {
    const txNumber = await generateFinancialNumber(tenantDb, "journal");

    const transaction = await recordIncome(tenantDb, {
      date:            new Date().toISOString().slice(0, 10),
      description:     `Donasi masuk ${payment.number} - Dana Titipan`,
      referenceNumber: txNumber,
      createdBy:       access.userId,
      amount,
      cashAccountId,
      incomeAccountId,
    });

    await db
      .update(schema.payments)
      .set({
        status:        "paid",
        confirmedBy:   access.userId,
        confirmedAt:   new Date(),
        transactionId: transaction.id,
        updatedAt:     new Date(),
      })
      .where(eq(schema.payments.id, paymentId));

    // Atomic increment collected_amount — pakai sql raw, bukan read-then-write
    if (donation.campaignId) {
      await db
        .update(schema.campaigns)
        .set({
          collectedAmount: sql`collected_amount + ${String(amount)}`,
          updatedAt:       new Date(),
        })
        .where(eq(schema.campaigns.id, donation.campaignId));
    }

    revalidateDonasi(slug);
    if (donation.campaignId)
      revalidatePath(`/${slug}/donasi/campaign/${donation.campaignId}`);
    return { success: true, data: undefined };
  } catch (err) {
    console.error("[confirmDonationAction]", err);
    return { success: false, error: "Gagal mengkonfirmasi donasi." };
  }
}

// ─── Campaign Category Actions ────────────────────────────────────────────────

export async function createCampaignCategoryAction(
  slug: string,
  data: { name: string; slug: string }
): Promise<ActionResult<{ categoryId: string }>> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "donasi"))
    return { success: false, error: "Hanya admin yang bisa membuat kategori." };

  if (!data.name.trim()) return { success: false, error: "Nama kategori wajib diisi." };
  if (!data.slug.trim()) return { success: false, error: "Slug kategori wajib diisi." };

  const { db, schema } = createTenantDb(slug);

  try {
    const [cat] = await db
      .insert(schema.campaignCategories)
      .values({ name: data.name.trim(), slug: data.slug.trim() })
      .returning({ id: schema.campaignCategories.id });

    revalidatePath(`/${slug}/donasi/kategori`);
    revalidatePath(`/${slug}/donasi/campaign`);
    return { success: true, data: { categoryId: cat.id } };
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("unique"))
      return { success: false, error: "Slug sudah digunakan." };
    console.error("[createCampaignCategoryAction]", err);
    return { success: false, error: "Gagal membuat kategori." };
  }
}

export async function updateCampaignCategoryAction(
  slug: string,
  categoryId: string,
  data: { name: string; slug: string }
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "donasi"))
    return { success: false, error: "Hanya admin yang bisa mengubah kategori." };

  const { db, schema } = createTenantDb(slug);

  try {
    await db
      .update(schema.campaignCategories)
      .set({ name: data.name.trim(), slug: data.slug.trim() })
      .where(eq(schema.campaignCategories.id, categoryId));

    revalidatePath(`/${slug}/donasi/kategori`);
    return { success: true, data: undefined };
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("unique"))
      return { success: false, error: "Slug sudah digunakan." };
    console.error("[updateCampaignCategoryAction]", err);
    return { success: false, error: "Gagal memperbarui kategori." };
  }
}

export async function deleteCampaignCategoryAction(
  slug: string,
  categoryId: string
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "donasi"))
    return { success: false, error: "Hanya admin yang bisa menghapus kategori." };

  const { db, schema } = createTenantDb(slug);

  // Blokir hapus jika masih ada campaign yang pakai kategori ini
  const [{ total }] = await db
    .select({ total: count() })
    .from(schema.campaigns)
    .where(eq(schema.campaigns.categoryId, categoryId));

  if (Number(total) > 0)
    return { success: false, error: `Kategori ini digunakan oleh ${total} campaign. Pindahkan campaign terlebih dahulu.` };

  await db
    .delete(schema.campaignCategories)
    .where(eq(schema.campaignCategories.id, categoryId));

  revalidatePath(`/${slug}/donasi/kategori`);
  revalidatePath(`/${slug}/donasi/campaign`);
  return { success: true, data: undefined };
}

export async function cancelDonationAction(
  slug: string,
  donationId: string
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!canConfirmPayment(access.tenantUser, "donasi"))
    return { success: false, error: "Hanya admin yang bisa membatalkan donasi." };

  const { db, schema } = createTenantDb(slug);

  const [payment] = await db
    .select({ id: schema.payments.id, status: schema.payments.status })
    .from(schema.payments)
    .where(and(
      eq(schema.payments.sourceType, "donation"),
      eq(schema.payments.sourceId,   donationId)
    ))
    .limit(1);

  if (!payment) return { success: false, error: "Data pembayaran tidak ditemukan." };
  if (payment.status === "paid")
    return { success: false, error: "Donasi sudah dikonfirmasi, tidak bisa dibatalkan." };

  await db
    .update(schema.payments)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(schema.payments.id, payment.id));

  revalidateDonasi(slug);
  return { success: true, data: undefined };
}
