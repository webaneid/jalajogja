"use server";

import { createTenantDb, getSettings, upsertSetting } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { hasFullAccess } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { eq, sql, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { createHash, randomUUID } from "crypto";
import {
  resolveLetterNumberFormat,
  resolveSequenceCategory,
  DEFAULT_LETTER_CONFIG,
  type LetterNumberConfig,
} from "@/lib/letter-number";

// ─── Types ─────────────────────────────────────────────────────────────────

export type LetterData = {
  type:           "outgoing" | "incoming" | "internal";
  typeId?:        string | null;
  templateId?:    string | null;
  subject:        string;
  body?:          string | null;
  mergeFields?:   Record<string, string>;
  attachmentUrls?:  string[];
  attachmentLabel?: string | null;
  sender:         string;
  recipient:      string;
  letterDate:     string;        // ISO date string
  status?:        "draft" | "sent" | "received" | "archived";
  paperSize?:     "A4" | "F4" | "Letter";
  letterNumber?:  string | null;
  issuerOfficerId?: string | null;
  isBulk?:        boolean;
  bulkParentId?:  string | null;
  interTenantTo?:     string | null;
  interTenantStatus?: "pending" | "delivered" | null;
  signatureLayout?:   string | null;
  signatureShowDate?: boolean;
};

export type LetterTypeData = {
  name:            string;
  code?:           string | null;
  defaultCategory: string;
  isActive:        boolean;
  sortOrder:       number;
  identitasLayout: "layout1" | "layout2" | "layout3";
  showLampiran:    boolean;
  dateFormat:      "masehi" | "masehi_hijri" | null;
};

export type LetterTemplateData = {
  name:     string;
  type:     "outgoing" | "internal";
  subject?: string | null;
  body?:    string | null;
  isActive: boolean;
};

export type LetterContactData = {
  name:           string;
  title?:         string | null;
  organization?:  string | null;
  addressDetail?: string | null;
  provinceId?:    number | null;
  regencyId?:     number | null;
  districtId?:    number | null;
  villageId?:     number | null;
  email?:         string | null;
  phone?:         string | null;
  memberId?:      string | null;
};

// ─── Letter Number Generator ────────────────────────────────────────────────

export async function getNextLetterNumberAction(
  slug: string,
  type: "outgoing" | "incoming" | "internal",
  opts: {
    typeCode?:    string | null;   // dari letter_types.code
    issuerCode?:  string | null;   // dari divisions.code officer yang dipilih
    letterDate?:  string | null;   // ISO date string, default = today
  } = {}
): Promise<{ success: true; number: string } | { success: false; error: string }> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };

  const tenantClient = createTenantDb(slug);
  const { db: tenantDb, schema } = tenantClient;

  // Baca config format nomor dari settings
  const generalSettings = await getSettings(tenantClient, "general");
  const rawConfig = (generalSettings["letter_config"] as Partial<LetterNumberConfig> | undefined) ?? {};
  const config: LetterNumberConfig = {
    number_format:  rawConfig.number_format  ?? DEFAULT_LETTER_CONFIG.number_format,
    org_code:       rawConfig.org_code       ?? DEFAULT_LETTER_CONFIG.org_code,
    number_padding: rawConfig.number_padding ?? DEFAULT_LETTER_CONFIG.number_padding,
  };

  const issuerCode = opts.issuerCode?.trim() ?? "";
  const category   = resolveSequenceCategory(config.number_format, issuerCode).toUpperCase();
  const date       = opts.letterDate ? new Date(opts.letterDate) : new Date();
  const year       = date.getFullYear();

  try {
    let nextNum = 1;
    await tenantDb.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(schema.letterNumberSequences)
        .where(
          sql`${schema.letterNumberSequences.year} = ${year}
           AND ${schema.letterNumberSequences.type} = ${type}
           AND ${schema.letterNumberSequences.category} = ${category}
           FOR UPDATE`
        )
        .limit(1);

      if (existing) {
        nextNum = existing.lastNumber + 1;
        await tx
          .update(schema.letterNumberSequences)
          .set({ lastNumber: nextNum, updatedAt: new Date() })
          .where(eq(schema.letterNumberSequences.id, existing.id));
      } else {
        await tx
          .insert(schema.letterNumberSequences)
          .values({ year, type, category, lastNumber: 1 });
        nextNum = 1;
      }
    });

    const number = resolveLetterNumberFormat(config.number_format, {
      number:     nextNum,
      padding:    config.number_padding,
      typeCode:   opts.typeCode?.trim()  ?? "",
      orgCode:    config.org_code,
      issuerCode,
      date,
    });

    return { success: true, number };
  } catch (err) {
    console.error("[getNextLetterNumberAction]", err);
    return { success: false, error: "Gagal generate nomor surat." };
  }
}

// ─── Surat Keluar & Nota Dinas: Pre-create draft ───────────────────────────

export async function createLetterDraftAction(
  slug: string,
  type: "outgoing" | "internal"
): Promise<{ success: true; letterId: string } | { success: false; error: string }> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };

  const { db: tenantDb, schema } = createTenantDb(slug);

  try {
    const userId = access.userId;
    // Cari user record di tenant schema
    const [tenantUser] = await tenantDb
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.betterAuthUserId, userId))
      .limit(1);

    if (!tenantUser) return { success: false, error: "User tidak ditemukan di tenant." };

    const [letter] = await tenantDb
      .insert(schema.letters)
      .values({
        type,
        subject: "",
        sender: "",
        recipient: "",
        letterDate: new Date().toISOString().split("T")[0],
        status: "draft",
        createdBy: tenantUser.id,
      })
      .returning({ id: schema.letters.id });

    return { success: true, letterId: letter.id };
  } catch (err) {
    console.error("[createLetterDraftAction]", err);
    return { success: false, error: "Gagal membuat draft surat." };
  }
}

// ─── Surat Keluar / Nota: Create langsung dengan data (tanpa pre-create) ─────

export async function createLetterAction(
  slug: string,
  type: "outgoing" | "internal",
  data: Omit<LetterData, "type">
): Promise<{ success: true; letterId: string } | { success: false; error: string }> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };

  if (!data.subject.trim()) return { success: false, error: "Subjek surat wajib diisi." };
  if (!data.letterDate) return { success: false, error: "Tanggal surat wajib diisi." };

  const { db: tenantDb, schema } = createTenantDb(slug);

  try {
    const [tenantUser] = await tenantDb
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.betterAuthUserId, access.userId))
      .limit(1);

    if (!tenantUser) return { success: false, error: "User tidak ditemukan di tenant." };

    const [letter] = await tenantDb
      .insert(schema.letters)
      .values({
        type,
        typeId:           data.typeId           || null,
        templateId:       data.templateId        || null,
        subject:          data.subject.trim(),
        body:             data.body              || null,
        mergeFields:      data.mergeFields       || {},
        attachmentUrls:   data.attachmentUrls    || [],
        sender:           data.sender?.trim()    || "",
        recipient:        data.recipient?.trim() || "",
        letterDate:       data.letterDate,
        letterNumber:     data.letterNumber?.trim() || null,
        issuerOfficerId:  data.issuerOfficerId   || null,
        status:           "draft",
        paperSize:        data.paperSize         || "A4",
        createdBy:        tenantUser.id,
      })
      .returning({ id: schema.letters.id });

    revalidatePath(`/${slug}/letters/${type === "outgoing" ? "keluar" : "nota"}`);
    return { success: true, letterId: letter.id };
  } catch (err) {
    console.error("[createLetterAction]", err);
    return { success: false, error: "Gagal menyimpan surat." };
  }
}

// ─── Surat Masuk: Direct create (tidak perlu pre-create) ──────────────────

export async function createIncomingLetterAction(
  slug: string,
  data: Omit<LetterData, "type">
): Promise<{ success: true; letterId: string } | { success: false; error: string }> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };

  if (!data.subject.trim()) return { success: false, error: "Subjek surat wajib diisi." };
  if (!data.sender.trim()) return { success: false, error: "Pengirim wajib diisi." };
  if (!data.letterDate) return { success: false, error: "Tanggal surat wajib diisi." };

  const { db: tenantDb, schema } = createTenantDb(slug);

  try {
    const userId = access.userId;
    const [tenantUser] = await tenantDb
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.betterAuthUserId, userId))
      .limit(1);

    if (!tenantUser) return { success: false, error: "User tidak ditemukan di tenant." };

    const [letter] = await tenantDb
      .insert(schema.letters)
      .values({
        type: "incoming",
        typeId:      data.typeId      || null,
        templateId:  data.templateId  || null,
        subject:     data.subject.trim(),
        body:        data.body        || null,
        mergeFields: data.mergeFields || {},
        attachmentUrls: data.attachmentUrls || [],
        sender:      data.sender.trim(),
        recipient:   data.recipient?.trim() || "",
        letterDate:  data.letterDate,
        letterNumber: data.letterNumber?.trim() || null,
        status:      "received",
        paperSize:   data.paperSize || "A4",
        createdBy:   tenantUser.id,
      })
      .returning({ id: schema.letters.id });

    revalidatePath(`/${slug}/letters/masuk`);
    return { success: true, letterId: letter.id };
  } catch (err) {
    console.error("[createIncomingLetterAction]", err);
    return { success: false, error: "Gagal menyimpan surat masuk." };
  }
}

// ─── Update Letter ────────────────────────────────────────────────────────

export async function updateLetterAction(
  slug: string,
  letterId: string,
  data: Partial<LetterData>
): Promise<{ success: true } | { success: false; error: string }> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };

  const { db: tenantDb, schema } = createTenantDb(slug);

  try {
    const [existing] = await tenantDb
      .select({ id: schema.letters.id, type: schema.letters.type })
      .from(schema.letters)
      .where(eq(schema.letters.id, letterId))
      .limit(1);

    if (!existing) return { success: false, error: "Surat tidak ditemukan." };

    await tenantDb
      .update(schema.letters)
      .set({
        ...(data.typeId     !== undefined && { typeId:     data.typeId     || null }),
        ...(data.templateId !== undefined && { templateId: data.templateId || null }),
        ...(data.subject    !== undefined && { subject:    data.subject.trim() }),
        ...(data.body       !== undefined && { body:       data.body }),
        ...(data.mergeFields !== undefined && { mergeFields: data.mergeFields }),
        ...(data.attachmentUrls  !== undefined && { attachmentUrls:  data.attachmentUrls }),
        ...(data.attachmentLabel !== undefined && { attachmentLabel: data.attachmentLabel ?? null }),
        ...(data.sender     !== undefined && { sender:     data.sender.trim() }),
        ...(data.recipient  !== undefined && { recipient:  data.recipient.trim() }),
        ...(data.letterDate !== undefined && { letterDate: data.letterDate }),
        ...(data.letterNumber !== undefined && { letterNumber: data.letterNumber?.trim() || null }),
        ...(data.paperSize  !== undefined && { paperSize:  data.paperSize }),
        ...(data.issuerOfficerId !== undefined && { issuerOfficerId: data.issuerOfficerId || null }),
        ...(data.isBulk     !== undefined && { isBulk:     data.isBulk }),
        ...(data.bulkParentId !== undefined && { bulkParentId: data.bulkParentId || null }),
        ...(data.interTenantTo !== undefined && { interTenantTo: data.interTenantTo || null }),
        ...(data.interTenantStatus !== undefined && { interTenantStatus: data.interTenantStatus || null }),
        ...(data.signatureLayout   !== undefined && { signatureLayout:   (data.signatureLayout || "double") as "single-center" | "single-left" | "single-right" | "double" | "triple-row" | "triple-pyramid" | "double-with-witnesses" }),
        ...(data.signatureShowDate !== undefined && { signatureShowDate: data.signatureShowDate }),
        updatedAt: new Date(),
      })
      .where(eq(schema.letters.id, letterId));

    const path = existing.type === "incoming"
      ? `/${slug}/letters/masuk`
      : existing.type === "internal"
        ? `/${slug}/letters/nota`
        : `/${slug}/letters/keluar`;
    revalidatePath(path);
    return { success: true };
  } catch (err) {
    console.error("[updateLetterAction]", err);
    return { success: false, error: "Gagal menyimpan surat." };
  }
}

// ─── Update Status ────────────────────────────────────────────────────────

export async function updateLetterStatusAction(
  slug: string,
  letterId: string,
  status: "draft" | "sent" | "received" | "archived"
): Promise<{ success: true } | { success: false; error: string }> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };

  const { db: tenantDb, schema } = createTenantDb(slug);

  try {
    await tenantDb
      .update(schema.letters)
      .set({ status, updatedAt: new Date() })
      .where(eq(schema.letters.id, letterId));

    revalidatePath(`/${slug}/letters`);
    return { success: true };
  } catch (err) {
    console.error("[updateLetterStatusAction]", err);
    return { success: false, error: "Gagal update status surat." };
  }
}

// ─── Delete Letter ────────────────────────────────────────────────────────

export async function deleteLetterAction(
  slug: string,
  letterId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };

  const { db: tenantDb, schema } = createTenantDb(slug);

  try {
    // Hapus signatures dulu (CASCADE seharusnya handle ini, tapi eksplisit lebih aman)
    await tenantDb
      .delete(schema.letterSignatures)
      .where(eq(schema.letterSignatures.letterId, letterId));

    await tenantDb
      .delete(schema.letters)
      .where(eq(schema.letters.id, letterId));

    revalidatePath(`/${slug}/letters`);
    return { success: true };
  } catch (err) {
    console.error("[deleteLetterAction]", err);
    return { success: false, error: "Gagal menghapus surat." };
  }
}

// ─── Letter Types CRUD ────────────────────────────────────────────────────

export async function createLetterTypeAction(
  slug: string,
  data: LetterTypeData
): Promise<{ success: true; typeId: string } | { success: false; error: string }> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!data.name.trim()) return { success: false, error: "Nama jenis surat wajib diisi." };

  const { db: tenantDb, schema } = createTenantDb(slug);

  try {
    const [type] = await tenantDb
      .insert(schema.letterTypes)
      .values({
        name:            data.name.trim(),
        code:            data.code?.trim() || null,
        defaultCategory: data.defaultCategory.trim() || "UMUM",
        isActive:        data.isActive,
        sortOrder:       data.sortOrder,
        identitasLayout: data.identitasLayout,
        showLampiran:    data.showLampiran,
        dateFormat:      data.dateFormat ?? null,
      })
      .returning({ id: schema.letterTypes.id });

    revalidatePath(`/${slug}/letters/template`);
    return { success: true, typeId: type.id };
  } catch (err) {
    console.error("[createLetterTypeAction]", err);
    return { success: false, error: "Gagal membuat jenis surat." };
  }
}

export async function updateLetterTypeAction(
  slug: string,
  typeId: string,
  data: LetterTypeData
): Promise<{ success: true } | { success: false; error: string }> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!data.name.trim()) return { success: false, error: "Nama jenis surat wajib diisi." };

  const { db: tenantDb, schema } = createTenantDb(slug);

  try {
    await tenantDb
      .update(schema.letterTypes)
      .set({
        name:            data.name.trim(),
        code:            data.code?.trim() || null,
        defaultCategory: data.defaultCategory.trim() || "UMUM",
        isActive:        data.isActive,
        sortOrder:       data.sortOrder,
        identitasLayout: data.identitasLayout,
        showLampiran:    data.showLampiran,
        dateFormat:      data.dateFormat ?? null,
        updatedAt:       new Date(),
      })
      .where(eq(schema.letterTypes.id, typeId));

    revalidatePath(`/${slug}/letters/template`);
    return { success: true };
  } catch (err) {
    console.error("[updateLetterTypeAction]", err);
    return { success: false, error: "Gagal update jenis surat." };
  }
}

export async function deleteLetterTypeAction(
  slug: string,
  typeId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };

  const { db: tenantDb, schema } = createTenantDb(slug);

  try {
    // Cek apakah masih dipakai
    const [used] = await tenantDb
      .select({ id: schema.letters.id })
      .from(schema.letters)
      .where(eq(schema.letters.typeId, typeId))
      .limit(1);

    if (used) return { success: false, error: "Jenis surat masih digunakan oleh surat yang ada." };

    await tenantDb
      .delete(schema.letterTypes)
      .where(eq(schema.letterTypes.id, typeId));

    revalidatePath(`/${slug}/letters/template`);
    return { success: true };
  } catch (err) {
    console.error("[deleteLetterTypeAction]", err);
    return { success: false, error: "Gagal menghapus jenis surat." };
  }
}

// ─── Letter Templates CRUD ────────────────────────────────────────────────

export async function createLetterTemplateAction(
  slug: string,
  data: LetterTemplateData
): Promise<{ success: true; templateId: string } | { success: false; error: string }> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!data.name.trim()) return { success: false, error: "Nama template wajib diisi." };

  const { db: tenantDb, schema } = createTenantDb(slug);

  try {
    const [template] = await tenantDb
      .insert(schema.letterTemplates)
      .values({
        name:     data.name.trim(),
        type:     data.type,
        subject:  data.subject?.trim() || null,
        body:     data.body            || null,
        isActive: data.isActive,
      })
      .returning({ id: schema.letterTemplates.id });

    revalidatePath(`/${slug}/letters/template`);
    return { success: true, templateId: template.id };
  } catch (err) {
    console.error("[createLetterTemplateAction]", err);
    return { success: false, error: "Gagal membuat template surat." };
  }
}

export async function updateLetterTemplateAction(
  slug: string,
  templateId: string,
  data: LetterTemplateData
): Promise<{ success: true } | { success: false; error: string }> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!data.name.trim()) return { success: false, error: "Nama template wajib diisi." };

  const { db: tenantDb, schema } = createTenantDb(slug);

  try {
    await tenantDb
      .update(schema.letterTemplates)
      .set({
        name:      data.name.trim(),
        type:      data.type,
        subject:   data.subject?.trim() || null,
        body:      data.body            || null,
        isActive:  data.isActive,
        updatedAt: new Date(),
      })
      .where(eq(schema.letterTemplates.id, templateId));

    revalidatePath(`/${slug}/letters/template`);
    return { success: true };
  } catch (err) {
    console.error("[updateLetterTemplateAction]", err);
    return { success: false, error: "Gagal update template surat." };
  }
}

export async function deleteLetterTemplateAction(
  slug: string,
  templateId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };

  const { db: tenantDb, schema } = createTenantDb(slug);

  try {
    // Cek apakah masih dipakai
    const [used] = await tenantDb
      .select({ id: schema.letters.id })
      .from(schema.letters)
      .where(eq(schema.letters.templateId, templateId))
      .limit(1);

    if (used) return { success: false, error: "Template masih digunakan oleh surat yang ada." };

    await tenantDb
      .delete(schema.letterTemplates)
      .where(eq(schema.letterTemplates.id, templateId));

    revalidatePath(`/${slug}/letters/template`);
    return { success: true };
  } catch (err) {
    console.error("[deleteLetterTemplateAction]", err);
    return { success: false, error: "Gagal menghapus template surat." };
  }
}

// ─── Letter Contacts CRUD ────────────────────────────────────────────────

export async function createLetterContactAction(
  slug: string,
  data: LetterContactData
): Promise<{ success: true; contactId: string } | { success: false; error: string }> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!data.name.trim()) return { success: false, error: "Nama kontak wajib diisi." };

  const { db: tenantDb, schema } = createTenantDb(slug);

  try {
    const [contact] = await tenantDb
      .insert(schema.letterContacts)
      .values({
        name:          data.name.trim(),
        title:         data.title?.trim()         || null,
        organization:  data.organization?.trim()  || null,
        addressDetail: data.addressDetail?.trim() || null,
        provinceId:    data.provinceId            ?? null,
        regencyId:     data.regencyId             ?? null,
        districtId:    data.districtId            ?? null,
        villageId:     data.villageId             ?? null,
        email:         data.email?.trim()         || null,
        phone:         data.phone?.trim()         || null,
        memberId:      data.memberId              || null,
      })
      .returning({ id: schema.letterContacts.id });

    return { success: true, contactId: contact.id };
  } catch (err) {
    console.error("[createLetterContactAction]", err);
    return { success: false, error: "Gagal menyimpan kontak surat." };
  }
}

export async function updateLetterContactAction(
  slug: string,
  contactId: string,
  data: LetterContactData
): Promise<{ success: true } | { success: false; error: string }> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!data.name.trim()) return { success: false, error: "Nama kontak wajib diisi." };

  const { db: tenantDb, schema } = createTenantDb(slug);

  try {
    await tenantDb
      .update(schema.letterContacts)
      .set({
        name:          data.name.trim(),
        title:         data.title?.trim()         || null,
        organization:  data.organization?.trim()  || null,
        addressDetail: data.addressDetail?.trim() || null,
        provinceId:    data.provinceId            ?? null,
        regencyId:     data.regencyId             ?? null,
        districtId:    data.districtId            ?? null,
        villageId:     data.villageId             ?? null,
        email:         data.email?.trim()         || null,
        phone:         data.phone?.trim()         || null,
        memberId:      data.memberId              || null,
        updatedAt:     new Date(),
      })
      .where(eq(schema.letterContacts.id, contactId));

    return { success: true };
  } catch (err) {
    console.error("[updateLetterContactAction]", err);
    return { success: false, error: "Gagal update kontak surat." };
  }
}

export async function deleteLetterContactAction(
  slug: string,
  contactId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };

  const { db: tenantDb, schema } = createTenantDb(slug);

  try {
    await tenantDb
      .delete(schema.letterContacts)
      .where(eq(schema.letterContacts.id, contactId));

    return { success: true };
  } catch (err) {
    console.error("[deleteLetterContactAction]", err);
    return { success: false, error: "Gagal menghapus kontak surat." };
  }
}

// ─── Tanda Tangan Digital ─────────────────────────────────────────────────

export async function signLetterAction(
  slug: string,
  letterId: string,
  officerId: string,
  role: "signer" | "approver" | "witness",
  ipAddress?: string
): Promise<{ success: true; verificationHash: string } | { success: false; error: string }> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };

  const { db: tenantDb, schema } = createTenantDb(slug);

  try {
    // Cari slot existing untuk officer ini di surat ini
    const [existing] = await tenantDb
      .select({
        id:       schema.letterSignatures.id,
        signedAt: schema.letterSignatures.signedAt,
      })
      .from(schema.letterSignatures)
      .where(
        and(
          eq(schema.letterSignatures.letterId,  letterId),
          eq(schema.letterSignatures.officerId, officerId)
        )
      )
      .limit(1);

    // Sudah TTD → tolak
    if (existing?.signedAt) return { success: false, error: "Sudah menandatangani surat ini." };

    const signedAt = new Date();
    const verificationHash = createHash("sha256")
      .update(`${letterId}:${officerId}:${signedAt.toISOString()}`)
      .digest("hex");

    if (existing) {
      // Slot sudah di-assign via syncSignatureSlotsAction → UPDATE (clear token + set signedAt)
      await tenantDb
        .update(schema.letterSignatures)
        .set({
          signedAt,
          verificationHash,
          signingToken:          null,   // invalidate — tidak bisa sign ulang via URL
          signingTokenExpiresAt: null,
          role,
          ipAddress: ipAddress ?? null,
        })
        .where(eq(schema.letterSignatures.id, existing.id));
    } else {
      // Tidak ada slot pre-assigned → INSERT (flow lama / fallback)
      // Cek officer canSign dulu
      const [officer] = await tenantDb
        .select({ id: schema.officers.id, canSign: schema.officers.canSign })
        .from(schema.officers)
        .where(eq(schema.officers.id, officerId))
        .limit(1);

      if (!officer)         return { success: false, error: "Pengurus tidak ditemukan." };
      if (!officer.canSign) return { success: false, error: "Pengurus tidak memiliki izin tanda tangan." };

      await tenantDb.insert(schema.letterSignatures).values({
        letterId,
        officerId,
        role,
        signedAt,
        verificationHash,
        ipAddress: ipAddress ?? null,
      });
    }

    revalidatePath(`/${slug}/letters`);
    return { success: true, verificationHash };
  } catch (err) {
    console.error("[signLetterAction]", err);
    return { success: false, error: "Gagal menyimpan tanda tangan." };
  }
}

export async function removeSignatureAction(
  slug: string,
  signatureId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };

  if (!hasFullAccess(access.tenantUser, "surat")) {
    return { success: false, error: "Hanya admin yang bisa menghapus tanda tangan." };
  }

  const { db: tenantDb, schema } = createTenantDb(slug);

  try {
    await tenantDb
      .delete(schema.letterSignatures)
      .where(eq(schema.letterSignatures.id, signatureId));

    revalidatePath(`/${slug}/letters`);
    return { success: true };
  } catch (err) {
    console.error("[removeSignatureAction]", err);
    return { success: false, error: "Gagal menghapus tanda tangan." };
  }
}

// ─── Assign Signer Slot ───────────────────────────────────────────────────────
// Membuat atau mengupdate slot TTD — signedAt null, signingToken di-generate
// Admin assign officer ke slot sebelum TTD dilakukan

export async function assignSignerSlotAction(
  slug:        string,
  letterId:    string,
  slotOrder:   number,
  slotSection: "main" | "witnesses",
  officerId:   string,
  role:        "signer" | "approver" | "witness"
): Promise<
  | { success: true; signingToken: string; signatureId: string }
  | { success: false; error: string }
> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };

  // Hanya admin/sekretaris yang bisa assign slot
  if (!hasFullAccess(access.tenantUser, "surat")) {
    return { success: false, error: "Tidak punya izin assign penandatangan." };
  }

  const { db: tenantDb, schema } = createTenantDb(slug);

  try {
    // Cek officer exists
    const [officer] = await tenantDb
      .select({ id: schema.officers.id })
      .from(schema.officers)
      .where(eq(schema.officers.id, officerId))
      .limit(1);
    if (!officer) return { success: false, error: "Pengurus tidak ditemukan." };

    // Cek apakah slot ini sudah ada (letter + order + section)
    const [existing] = await tenantDb
      .select({ id: schema.letterSignatures.id })
      .from(schema.letterSignatures)
      .where(
        and(
          eq(schema.letterSignatures.letterId, letterId),
          eq(schema.letterSignatures.slotOrder, slotOrder),
          eq(schema.letterSignatures.slotSection, slotSection)
        )
      )
      .limit(1);

    const signingToken          = randomUUID();
    const signingTokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 hari

    if (existing) {
      // Update slot yang sudah ada — ganti officer + role + reset token
      // Jika sudah TTD (signedAt tidak null), tolak perubahan
      const [slot] = await tenantDb
        .select({ signedAt: schema.letterSignatures.signedAt })
        .from(schema.letterSignatures)
        .where(eq(schema.letterSignatures.id, existing.id))
        .limit(1);

      if (slot?.signedAt) {
        return { success: false, error: "Slot ini sudah ditandatangani, tidak bisa diubah." };
      }

      await tenantDb
        .update(schema.letterSignatures)
        .set({ officerId, role, signingToken, signingTokenExpiresAt })
        .where(eq(schema.letterSignatures.id, existing.id));

      revalidatePath(`/${slug}/letters`);
      return { success: true, signingToken, signatureId: existing.id };
    }

    // Insert slot baru
    const [inserted] = await tenantDb
      .insert(schema.letterSignatures)
      .values({
        letterId,
        officerId,
        role,
        slotOrder,
        slotSection,
        signingToken,
        signingTokenExpiresAt,
        // signedAt + verificationHash tetap null — officer belum TTD
      })
      .returning({ id: schema.letterSignatures.id });

    revalidatePath(`/${slug}/letters`);
    return { success: true, signingToken, signatureId: inserted.id };
  } catch (err) {
    console.error("[assignSignerSlotAction]", err);
    return { success: false, error: "Gagal menyimpan slot penandatangan." };
  }
}

// ─── Sync Signature Slots ─────────────────────────────────────────────────────
// Dipanggil saat simpan surat (draft/kirim) dari edit/new page.
// desired = state combobox di form. Reconcile dengan DB:
//   - slot baru (officerId ada, id kosong) → INSERT
//   - slot berubah (id ada, bukan TTD) → UPDATE
//   - slot kosong (officerId null) → DELETE jika ada di DB dan belum TTD

export type SlotInput = {
  id:          string | null;   // null = belum ada di DB
  order:       number;
  section:     "main" | "witnesses";
  officerId:   string | null;   // null = kosong / dihapus
  role:        "signer" | "approver" | "witness";
  signedAt?:   Date | null;     // hanya untuk display di form mode (tidak dikirim ke DB)
};

export async function syncSignatureSlotsAction(
  slug:     string,
  letterId: string,
  desired:  SlotInput[],
): Promise<{ success: true } | { success: false; error: string }> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "surat")) {
    return { success: false, error: "Tidak punya izin mengatur penandatangan." };
  }

  const { db: tenantDb, schema } = createTenantDb(slug);

  try {
    // Ambil semua slot existing (termasuk signed) — butuh officerId + signingToken untuk perbandingan
    const existing = await tenantDb
      .select({
        id:           schema.letterSignatures.id,
        slotOrder:    schema.letterSignatures.slotOrder,
        slotSection:  schema.letterSignatures.slotSection,
        officerId:    schema.letterSignatures.officerId,
        signingToken: schema.letterSignatures.signingToken,
        signedAt:     schema.letterSignatures.signedAt,
      })
      .from(schema.letterSignatures)
      .where(eq(schema.letterSignatures.letterId, letterId));

    const newToken = () => ({
      signingToken:          randomUUID(),
      signingTokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    for (const slot of desired) {
      const existingSlot = existing.find(
        (e) => e.slotOrder === slot.order && e.slotSection === slot.section
      );

      if (!slot.officerId) {
        // Hapus slot jika ada di DB dan belum TTD
        if (existingSlot && !existingSlot.signedAt) {
          await tenantDb
            .delete(schema.letterSignatures)
            .where(eq(schema.letterSignatures.id, existingSlot.id));
        }
        continue;
      }

      if (existingSlot) {
        // Sudah TTD → skip, jangan ubah apapun termasuk token
        if (existingSlot.signedAt) continue;

        // Officer berubah → generate token baru (link lama tidak valid karena orangnya ganti)
        // Officer sama   → pertahankan token lama agar link yang sudah dikirim tetap berlaku
        const officerChanged = existingSlot.officerId !== slot.officerId;
        const tokenMissing   = !existingSlot.signingToken;

        await tenantDb
          .update(schema.letterSignatures)
          .set({
            officerId: slot.officerId,
            role:      slot.role,
            ...(officerChanged || tokenMissing ? newToken() : {}),
          })
          .where(eq(schema.letterSignatures.id, existingSlot.id));
      } else {
        // Insert baru — selalu generate token
        await tenantDb
          .insert(schema.letterSignatures)
          .values({
            letterId,
            officerId:   slot.officerId,
            role:        slot.role,
            slotOrder:   slot.order,
            slotSection: slot.section,
            ...newToken(),
          });
      }
    }

    // Hapus slot DB yang tidak ada di desired (dan belum TTD)
    const desiredKeys = new Set(desired.map((d) => `${d.section}-${d.order}`));
    for (const e of existing) {
      if (!e.signedAt && !desiredKeys.has(`${e.slotSection}-${e.slotOrder}`)) {
        await tenantDb
          .delete(schema.letterSignatures)
          .where(eq(schema.letterSignatures.id, e.id));
      }
    }

    revalidatePath(`/${slug}/letters`);
    return { success: true };
  } catch (err) {
    console.error("[syncSignatureSlotsAction]", err);
    return { success: false, error: "Gagal menyimpan penandatangan." };
  }
}

// ─── Generate Signing Token On-Demand ────────────────────────────────────────
// Untuk slot lama yang belum punya signingToken (edge case) — admin/owner only

export async function generateSigningTokenAction(
  slug: string,
  signatureId: string,
): Promise<{ success: true; token: string } | { success: false; error: string }> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "surat")) {
    return { success: false, error: "Tidak punya izin." };
  }

  const { db: tenantDb, schema } = createTenantDb(slug);

  try {
    const [sig] = await tenantDb
      .select({
        id:           schema.letterSignatures.id,
        signingToken: schema.letterSignatures.signingToken,
        signedAt:     schema.letterSignatures.signedAt,
      })
      .from(schema.letterSignatures)
      .where(eq(schema.letterSignatures.id, signatureId))
      .limit(1);

    if (!sig) return { success: false, error: "Slot tidak ditemukan." };
    if (sig.signedAt) return { success: false, error: "Slot sudah ditandatangani." };
    // Kalau sudah ada token kembalikan saja
    if (sig.signingToken) return { success: true, token: sig.signingToken };

    const token = randomUUID();
    await tenantDb
      .update(schema.letterSignatures)
      .set({
        signingToken:          token,
        signingTokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      })
      .where(eq(schema.letterSignatures.id, signatureId));

    revalidatePath(`/${slug}/letters`);
    return { success: true, token };
  } catch (err) {
    console.error("[generateSigningTokenAction]", err);
    return { success: false, error: "Gagal membuat link TTD." };
  }
}

// ─── Sign by Token (halaman publik) ──────────────────────────────────────────
// Dipanggil dari SigningPageClient — TIDAK membutuhkan login dashboard
// Validasi: token valid + belum TTD. Officer ID sudah ada di slot.

export async function signByTokenAction(
  slug: string,
  token: string,
): Promise<
  | { success: true; verificationHash: string }
  | { success: false; error: string }
> {
  const { db: tenantDb, schema } = createTenantDb(slug);

  try {
    // Cari slot by token
    const [sig] = await tenantDb
      .select()
      .from(schema.letterSignatures)
      .where(eq(schema.letterSignatures.signingToken, token))
      .limit(1);

    if (!sig) return { success: false, error: "Link tanda tangan tidak valid." };
    if (sig.signedAt) return { success: false, error: "Surat ini sudah ditandatangani sebelumnya." };
    if (sig.signingTokenExpiresAt && sig.signingTokenExpiresAt < new Date()) {
      return { success: false, error: "Link tanda tangan sudah kadaluarsa." };
    }

    const now              = new Date();
    const verificationHash = createHash("sha256")
      .update(`${sig.letterId}:${sig.officerId}:${now.toISOString()}`)
      .digest("hex");

    await tenantDb
      .update(schema.letterSignatures)
      .set({
        signedAt:         now,
        verificationHash,
        signingToken:     null,  // Invalidate token setelah dipakai
      })
      .where(eq(schema.letterSignatures.id, sig.id));

    revalidatePath(`/${slug}/letters`);
    return { success: true, verificationHash };
  } catch (err) {
    console.error("[signByTokenAction]", err);
    return { success: false, error: "Gagal menyimpan tanda tangan." };
  }
}

// ─── Mail Merge Bulk ──────────────────────────────────────────────────────────

// Data satu penerima — dari public.members ATAU letter_contacts
export type BulkRecipient = {
  type:     "member" | "contact";
  id:       string;          // member.id atau letter_contact.id
  name:     string;
  phone?:   string | null;
  email?:   string | null;
  address?: string | null;
  number?:  string | null;   // member_number — hanya untuk type="member"
  nik?:     string | null;   // NIK — hanya untuk type="member"
};

// Buat salinan surat untuk setiap penerima
// Nomor surat anak: {nomor_parent}/{urutan} — contoh: 001/IKPM/IV/2025/1
export async function createBulkLettersAction(
  slug: string,
  parentId: string,
  recipients: BulkRecipient[]
): Promise<{ success: true; count: number; childIds: string[] } | { success: false; error: string }> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };

  if (!hasFullAccess(access.tenantUser, "surat")) {
    return { success: false, error: "Hanya admin yang bisa membuat surat massal." };
  }

  if (recipients.length === 0) {
    return { success: false, error: "Pilih minimal satu penerima." };
  }

  if (recipients.length > 500) {
    return { success: false, error: "Maksimal 500 penerima sekaligus." };
  }

  const { db: tenantDb, schema } = createTenantDb(slug);

  try {
    // Fetch user di tenant schema untuk createdBy
    const [tenantUser] = await tenantDb
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.betterAuthUserId, access.userId))
      .limit(1);

    if (!tenantUser) return { success: false, error: "User tidak ditemukan di tenant." };

    // Fetch parent letter
    const [parent] = await tenantDb
      .select()
      .from(schema.letters)
      .where(eq(schema.letters.id, parentId))
      .limit(1);

    if (!parent)                    return { success: false, error: "Surat induk tidak ditemukan." };
    if (parent.type !== "outgoing") return { success: false, error: "Hanya surat keluar yang bisa di-bulk." };

    const childIds: string[] = [];

    // Insert satu per satu — sequential agar nomor urut konsisten
    for (let i = 0; i < recipients.length; i++) {
      const r = recipients[i];
      const suffix = i + 1;
      // Nomor anak: tambah /{urutan} ke nomor parent, atau null jika parent tidak punya nomor
      const childNumber = parent.letterNumber
        ? `${parent.letterNumber}/${suffix}`
        : null;

      // Merge fields untuk penerima ini — di-snapshot saat generate
      const mergeFields: Record<string, string> = {
        "recipient.name":    r.name,
        "recipient.phone":   r.phone    ?? "",
        "recipient.email":   r.email    ?? "",
        "recipient.address": r.address  ?? "",
        "recipient.number":  r.number   ?? "",
        "recipient.nik":     r.nik      ?? "",
      };

      const [child] = await tenantDb
        .insert(schema.letters)
        .values({
          type:         "outgoing",
          typeId:       parent.typeId       ?? null,
          templateId:   parent.templateId   ?? null,
          subject:      parent.subject,
          body:         parent.body         ?? null,
          mergeFields,
          attachmentUrls: parent.attachmentUrls as string[] ?? [],
          sender:       parent.sender,
          recipient:    r.name,
          letterDate:   parent.letterDate,
          letterNumber: childNumber,
          status:       "draft",
          paperSize:    parent.paperSize    ?? "A4",
          isBulk:       false,
          bulkParentId: parentId,
          createdBy:    tenantUser.id,
        })
        .returning({ id: schema.letters.id });

      childIds.push(child.id);
    }

    // Tandai parent sebagai surat bulk
    await tenantDb
      .update(schema.letters)
      .set({ isBulk: true, updatedAt: new Date() })
      .where(eq(schema.letters.id, parentId));

    revalidatePath(`/${slug}/letters/keluar/${parentId}`);
    revalidatePath(`/${slug}/letters/keluar`);

    return { success: true, count: childIds.length, childIds };
  } catch (err) {
    console.error("[createBulkLettersAction]", err);
    return { success: false, error: "Gagal membuat surat massal." };
  }
}

// ─── Letter Config (kop surat + format nomor) ────────────────────────────────

export type LetterConfig = {
  header_image_url: string | null;   // URL gambar kop surat dari media library
  footer_image_url: string | null;   // URL gambar footer dari media library
  paper_size:       "A4" | "F4" | "Letter";
  body_font:       string;
  margin_top:      number;
  margin_right:    number;
  margin_bottom:   number;
  margin_left:     number;
  number_format:   string;
  org_code:        string;
  number_padding:  number;
  // Format tanggal default (berlaku jika jenis surat tidak set dateFormat-nya)
  date_format:     "masehi" | "masehi_hijri";
  // Penyesuaian kalender Hijriah vs kalkulasi internasional: -1, 0, atau +1 hari
  hijri_offset:    number;
  // Kota yang tampil di tanggal surat (mis. "Yogyakarta, 16 April 2026")
  // Jika null/kosong → fallback ke kota dari settings kontak
  letter_city:     string | null;
};

export async function saveLetterConfigAction(
  slug: string,
  config: LetterConfig
): Promise<{ success: true } | { success: false; error: string }> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "surat")) {
    return { success: false, error: "Hanya admin yang bisa mengubah pengaturan surat." };
  }

  const tenantClient = createTenantDb(slug);

  try {
    await upsertSetting(tenantClient, "letter_config", "general", config);
    revalidatePath(`/${slug}/letters/pengaturan`);
    return { success: true };
  } catch (err) {
    console.error("[saveLetterConfigAction]", err);
    return { success: false, error: "Gagal menyimpan pengaturan surat." };
  }
}

// Tandai semua salinan surat menjadi "Terkirim" sekaligus
export async function markAllChildrenSentAction(
  slug: string,
  parentId: string
): Promise<{ success: true; count: number } | { success: false; error: string }> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };

  if (!hasFullAccess(access.tenantUser, "surat")) {
    return { success: false, error: "Hanya admin yang bisa mengubah status massal." };
  }

  const { db: tenantDb, schema } = createTenantDb(slug);

  try {
    const result = await tenantDb
      .update(schema.letters)
      .set({ status: "sent", updatedAt: new Date() })
      .where(
        and(
          eq(schema.letters.bulkParentId, parentId),
          sql`${schema.letters.status} != 'sent'`
        )
      )
      .returning({ id: schema.letters.id });

    revalidatePath(`/${slug}/letters/keluar/${parentId}`);
    revalidatePath(`/${slug}/letters/keluar`);

    return { success: true, count: result.length };
  } catch (err) {
    console.error("[markAllChildrenSentAction]", err);
    return { success: false, error: "Gagal update status surat salinan." };
  }
}
