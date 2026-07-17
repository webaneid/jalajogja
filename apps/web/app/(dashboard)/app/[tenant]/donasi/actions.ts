"use server";

import { eq, and, sql, count } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { createTenantDb, recordIncome, generateFinancialNumber, createLinkedInvoice, syncInvoicePayment, upsertSetting, getSettings } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { hasFullAccess, canConfirmPayment } from "@/lib/permissions";
import { CAMPAIGN_ARCHIVE_CARD_DESIGN_IDS, type CampaignArchiveCardDesignId } from "@/lib/campaign-archive-card-designs";

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
  targetAmount?:  number | null;
  defaultAmount?: number | null;
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
  revalidatePath(`/app/${slug}/donasi`);
  revalidatePath(`/app/${slug}/donasi/campaign`);
  revalidatePath(`/app/${slug}/donasi/transaksi`);
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
        targetAmount:  data.targetAmount  != null ? String(data.targetAmount)  : null,
        defaultAmount: data.defaultAmount != null ? String(data.defaultAmount) : null,
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
        targetAmount:  data.targetAmount  != null ? String(data.targetAmount)  : null,
        defaultAmount: data.defaultAmount != null ? String(data.defaultAmount) : null,
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
    revalidatePath(`/app/${slug}/donasi/campaign/${campaignId}`);
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

    // Buat invoice universal untuk donasi ini
    await createLinkedInvoice(tenantDb, {
      sourceType:    "donation",
      sourceId:      donation.id,
      customerName:  data.donorName.trim(),
      customerPhone: data.donorPhone ?? null,
      customerEmail: data.donorEmail ?? null,
      memberId:      data.memberId   ?? null,
      items: [{
        itemType:  "donation",
        name:      `Donasi${data.donationType !== "donasi" ? ` (${data.donationType})` : ""}`,
        unitPrice: data.amount,
        quantity:  1,
      }],
    });

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
      createdBy:       access.tenantUser.id,
      amount,
      cashAccountId,
      incomeAccountId,
    });

    await db
      .update(schema.payments)
      .set({
        status:        "paid",
        confirmedBy:   access.tenantUser.id,
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

    // Sync invoice yang terhubung ke donasi ini
    await syncInvoicePayment(tenantDb, {
      sourceType: "donation",
      sourceId:   donation.id,
      paymentId:  paymentId,
      amount,
    });

    revalidateDonasi(slug);
    if (donation.campaignId) {
      revalidatePath(`/app/${slug}/donasi/campaign/${donation.campaignId}`);
      // Revalidate public campaign pages
      const [c] = await db.select({ slug: schema.campaigns.slug })
        .from(schema.campaigns).where(eq(schema.campaigns.id, donation.campaignId)).limit(1);
      if (c) revalidatePath(`/app/${slug}/campaign/${c.slug}`);
    }
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

    revalidatePath(`/app/${slug}/donasi/kategori`);
    revalidatePath(`/app/${slug}/donasi/campaign`);
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

    revalidatePath(`/app/${slug}/donasi/kategori`);
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

  revalidatePath(`/app/${slug}/donasi/kategori`);
  revalidatePath(`/app/${slug}/donasi/campaign`);
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

// ─── Pengaturan Donasi ────────────────────────────────────────────────────────

export async function saveDonationSettingsAction(
  slug: string,
  recommendedAmounts: number[]
): Promise<{ success: boolean; error?: string }> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "donasi")) return { success: false, error: "Akses ditolak." };

  if (recommendedAmounts.length > 4)
    return { success: false, error: "Maksimal 4 rekomendasi nominal." };
  if (recommendedAmounts.some(n => n <= 0))
    return { success: false, error: "Nominal harus lebih dari 0." };

  const tenantClient = createTenantDb(slug);
  const sorted = [...recommendedAmounts].sort((a, b) => a - b);

  await upsertSetting(tenantClient, "donation_config", "donasi", {
    recommended_amounts: sorted,
  });

  revalidateDonasi(slug);
  return { success: true };
}

// ─── Desain Kartu Arsip — docs/arsitektur-donasi.md § 14l ─────────────────────

export async function saveCampaignArchiveDesignAction(
  slug:   string,
  design: CampaignArchiveCardDesignId,
): Promise<{ success: boolean; error?: string }> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "donasi")) return { success: false, error: "Akses ditolak." };

  if (!CAMPAIGN_ARCHIVE_CARD_DESIGN_IDS.includes(design))
    return { success: false, error: "Pilihan desain tidak valid." };

  const tenantClient = createTenantDb(slug);
  await upsertSetting(tenantClient, "campaign_archive_design", "donasi", { design });

  revalidatePath(`/${slug}/campaign`);
  revalidateDonasi(slug);
  return { success: true };
}

// ─── Pengaturan Qurban ────────────────────────────────────────────────────────

export type QurbanConfig = {
  // Biaya administrasi penyembelihan per jenis hewan — berbeda tiap hewan
  slaughterFees: { domba: number; kambing: number; sapi: number };
};

export async function saveQurbanConfigAction(
  slug: string,
  config: QurbanConfig
): Promise<{ success: boolean; error?: string }> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "donasi")) return { success: false, error: "Akses ditolak." };

  if (config.slaughterFees.domba < 0 || config.slaughterFees.kambing < 0 || config.slaughterFees.sapi < 0)
    return { success: false, error: "Biaya administrasi tidak boleh negatif." };

  const tenantClient = createTenantDb(slug);
  await upsertSetting(tenantClient, "qurban_config", "donasi", {
    slaughter_fees: {
      domba:   config.slaughterFees.domba,
      kambing: config.slaughterFees.kambing,
      sapi:    config.slaughterFees.sapi,
    },
  });

  revalidateDonasi(slug);
  return { success: true };
}

// ─── Qurban Animals ───────────────────────────────────────────────────────────

export type QurbanAnimalInput = {
  animalType: "domba" | "kambing" | "sapi";
  price:      number;
  stock:      number;
  split:      number | null; // hanya sapi: 5 atau 7
  isActive:   boolean;
};

export async function saveQurbanAnimalsAction(
  slug: string,
  campaignId: string,
  animals: QurbanAnimalInput[]
): Promise<{ success: boolean; error?: string }> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "donasi")) return { success: false, error: "Akses ditolak." };

  for (const a of animals) {
    if (a.price <= 0) return { success: false, error: `Harga ${a.animalType} harus lebih dari 0.` };
    if (a.stock < 0)  return { success: false, error: `Stok ${a.animalType} tidak boleh negatif.` };
    if (a.animalType === "sapi" && a.split !== null && ![5, 7].includes(a.split))
      return { success: false, error: "Patungan sapi hanya boleh 5 atau 7 orang." };
  }

  const { db, schema } = createTenantDb(slug);

  // Delete lama yang belum ada peserta, insert/update baru
  // Simpel: delete all non-booked lalu insert ulang
  await db.delete(schema.qurbanAnimals)
    .where(and(
      eq(schema.qurbanAnimals.campaignId, campaignId),
      eq(schema.qurbanAnimals.booked, 0),
    ));

  if (animals.length > 0) {
    await db.insert(schema.qurbanAnimals).values(
      animals.map(a => ({
        campaignId: campaignId,
        animalType: a.animalType,
        price:      String(a.price),
        stock:      a.stock,
        booked:     0,
        split:      a.animalType === "sapi" ? (a.split ?? 7) : null,
        isActive:   a.isActive,
      }))
    );
  }

  revalidateDonasi(slug);
  return { success: true };
}

export async function getQurbanAnimalsAction(
  slug: string,
  campaignId: string
): Promise<QurbanAnimalInput[]> {
  const { db, schema } = createTenantDb(slug);
  const rows = await db
    .select()
    .from(schema.qurbanAnimals)
    .where(eq(schema.qurbanAnimals.campaignId, campaignId))
    .orderBy(schema.qurbanAnimals.createdAt);

  return rows.map(r => ({
    animalType: r.animalType as "domba" | "kambing" | "sapi",
    price:      parseFloat(r.price),
    stock:      r.stock,
    split:      r.split ?? null,
    isActive:   r.isActive,
  }));
}

// ─── Qurban Order (front-end publik) ─────────────────────────────────────────

export type QurbanOrderData = {
  campaignId:  string;
  animalId:    string;
  atasNama:    string;
  donorName:   string;
  donorPhone?: string | null;
  donorEmail?: string | null;
  memberId?:   string | null;
  method:      "cash" | "transfer" | "qris";
  bankAccountRef?: string | null;
  qrisAccountRef?: string | null;
};

export async function createQurbanOrderAction(
  slug: string,
  data: QurbanOrderData
): Promise<ActionResult<{ donationId: string; donationNumber: string; uniqueCode: number; totalAmount: number }>> {
  if (!data.atasNama?.trim())  return { success: false, error: "Nama shohibul qurban wajib diisi." };
  if (!data.donorName?.trim()) return { success: false, error: "Nama pemesan wajib diisi." };

  const tenantClient             = createTenantDb(slug);
  const { db: tenantDb, schema } = tenantClient;

  // Fetch animal
  const [animal] = await tenantDb
    .select()
    .from(schema.qurbanAnimals)
    .where(and(
      eq(schema.qurbanAnimals.id, data.animalId),
      eq(schema.qurbanAnimals.campaignId, data.campaignId),
      eq(schema.qurbanAnimals.isActive, true),
    ))
    .limit(1);

  if (!animal) return { success: false, error: "Jenis hewan tidak ditemukan." };

  // Validasi stok
  if (animal.animalType === "sapi" && animal.split) {
    const maxSlots = animal.stock * animal.split;
    if (animal.booked >= maxSlots)
      return { success: false, error: "Stok sapi sudah habis." };
  } else {
    if (animal.booked >= animal.stock)
      return { success: false, error: "Stok hewan sudah habis." };
  }

  // Fetch biaya administrasi penyembelihan dari settings (per jenis hewan)
  const donasiSettings = await getSettings(tenantClient, "donasi");
  const qc = donasiSettings.qurban_config as
    | { slaughter_fees?: { domba?: number; kambing?: number; sapi?: number } }
    | undefined;
  const slaughterFee = qc?.slaughter_fees?.[animal.animalType as "domba" | "kambing" | "sapi"] ?? 0;
  const totalAmount  = parseFloat(animal.price) + slaughterFee;

  // Unique code hanya untuk transfer
  const uniqueCode = data.method === "transfer" ? Math.floor(Math.random() * 900) + 100 : 0;

  // Generate nomor donasi
  const donationNumber = await generateDonationNumber(tenantClient);

  // Slot sapi patungan
  let sapiGroupId: string | null = null;
  let slotNumber:  number | null = null;

  if (animal.animalType === "sapi" && animal.split) {
    // Cari grup yang belum penuh
    const [activeGroup] = await tenantDb
      .select()
      .from(schema.qurbanSapiGroups)
      .where(and(
        eq(schema.qurbanSapiGroups.animalId, animal.id),
        eq(schema.qurbanSapiGroups.isComplete, false),
      ))
      .limit(1);

    if (activeGroup) {
      sapiGroupId = activeGroup.id;
      slotNumber  = activeGroup.filledSlots + 1;
      const newFilled = activeGroup.filledSlots + 1;
      await tenantDb.update(schema.qurbanSapiGroups).set({
        filledSlots: newFilled,
        isComplete:  newFilled >= activeGroup.totalSlots,
      }).where(eq(schema.qurbanSapiGroups.id, activeGroup.id));
    } else {
      // Buat grup baru
      const [totalGroups] = await tenantDb
        .select({ cnt: sql<number>`count(*)` })
        .from(schema.qurbanSapiGroups)
        .where(eq(schema.qurbanSapiGroups.animalId, animal.id));
      const groupNumber = Number(totalGroups?.cnt ?? 0) + 1;
      const [newGroup] = await tenantDb.insert(schema.qurbanSapiGroups).values({
        animalId:    animal.id,
        groupNumber,
        totalSlots:  animal.split,
        filledSlots: 1,
        isComplete:  animal.split === 1,
      }).returning({ id: schema.qurbanSapiGroups.id });
      sapiGroupId = newGroup.id;
      slotNumber  = 1;
    }
  }

  // Insert donation + payment + participant
  const [donation] = await tenantDb.insert(schema.donations).values({
    donationNumber,
    campaignId:    data.campaignId,
    donationType:  "qurban",
    memberId:      data.memberId ?? null,
    donorName:     data.donorName.trim(),
    donorPhone:    data.donorPhone ?? null,
    donorEmail:    data.donorEmail ?? null,
    isAnonymous:   false,
  }).returning({ id: schema.donations.id });

  const paymentNumber = await generateFinancialNumber(tenantClient, "payment");
  await tenantDb.insert(schema.payments).values({
    number:        paymentNumber,
    sourceType:    "donation",
    sourceId:      donation.id,
    amount:        String(totalAmount),
    uniqueCode,
    method:        data.method,
    status:        data.method === "cash" ? "submitted" : "pending",
  });

  await tenantDb.insert(schema.qurbanParticipants).values({
    donationId:   donation.id,
    animalId:     animal.id,
    sapiGroupId,
    slotNumber,
    atasNama:     data.atasNama.trim(),
  });

  // Increment booked
  await tenantDb.update(schema.qurbanAnimals)
    .set({ booked: animal.booked + 1, updatedAt: new Date() })
    .where(eq(schema.qurbanAnimals.id, animal.id));

  return { success: true, data: { donationId: donation.id, donationNumber, uniqueCode, totalAmount } };
}
