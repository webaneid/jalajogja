"use server";

import { getTenantAccess } from "@/lib/tenant";
import { canManageUsers } from "@/lib/permissions";
import { createTenantDb, db, tenants, members, tenantMemberships, contacts, refProvinces, refRegencies, refDistricts, refVillages } from "@jalajogja/db";
import { upsertSettings, upsertSetting } from "@jalajogja/db";
import { eq, and, isNull } from "drizzle-orm";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import type { Level, Module } from "@/lib/permissions";
import { normalizePhone } from "@/lib/phone";
import { FORUM_MEMBERSHIP_NUMBER_FORMATS, type ForumMembershipNumberFormat } from "@/lib/forum-membership-number";

type ActionResult = { error?: string };
type StrictActionResult = { success: true } | { success: false; error: string };
type InviteResult = { success: true; inviteId: string; token: string } | { success: false; error: string };
export type CustomRoleResult = { success: true; id: string } | { success: false; error: string };

export type InviteFormData = {
  memberId:       string;
  role:           "ketua" | "sekretaris" | "bendahara" | "custom";
  customRoleId?:  string;
  deliveryMethod: "manual" | "email";
};

export type CustomRoleFormData = {
  name:         string;
  description?: string;
  permissions:  Record<Module, Level>;
};

// ── Umum ──────────────────────────────────────────────────────────────────────
export async function saveGeneralSettingsAction(
  slug: string,
  values: {
    siteName:        string;
    tagline:         string;
    siteDescription: string;
    logoUrl:         string;
    footerLogoUrl?:  string;
    faviconUrl:      string;
    timezone:        string;
    language:        string;
    currency:        string;
    usahaEnabled?:       boolean;
    pesantrenEnabled?:   boolean;
    profesionalEnabled?: boolean;
  }
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { error: "Akses ditolak." };
  if (!canManageUsers(access.tenantUser)) return { error: "Akses ditolak." };

  const tenantDb = createTenantDb(slug);
  await upsertSettings(tenantDb, "general", {
    site_name:        values.siteName,
    tagline:          values.tagline,
    site_description: values.siteDescription,
    logo_url:         values.logoUrl,
    footer_logo_url:  values.footerLogoUrl ?? "",
    favicon_url:      values.faviconUrl,
    timezone:         values.timezone,
    language:         values.language,
    currency:         values.currency,
    // Toggle modul ekosistem — gerbang visibilitas front-end saja, data member tidak pernah
    // dihapus. Lihat lib/ekosistem-modules.ts. Default true kalau tidak dikirim (checkbox
    // dicentang di form, jadi ini seharusnya selalu ada — fallback murni jaga-jaga).
    usaha_enabled:       values.usahaEnabled       ?? true,
    pesantren_enabled:   values.pesantrenEnabled   ?? true,
    profesional_enabled: values.profesionalEnabled ?? true,
  });

  return {};
}

// ── Domain ────────────────────────────────────────────────────────────────────
// Data domain disimpan ke public.tenants (bukan settings table)
export async function saveDomainSettingsAction(
  slug: string,
  values: {
    subdomain: string;
    customDomain: string;
  }
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { error: "Akses ditolak." };
  if (!canManageUsers(access.tenantUser)) return { error: "Akses ditolak." };

  // Validasi format custom domain jika diisi
  if (values.customDomain) {
    const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i;
    if (!domainRegex.test(values.customDomain)) {
      return { error: "Format domain tidak valid. Contoh: ikpm.or.id" };
    }
  }

  // Baca status existing agar tidak overwrite `active` yang sudah valid
  const [existing] = await db
    .select({ customDomain: tenants.customDomain, customDomainStatus: tenants.customDomainStatus })
    .from(tenants)
    .where(eq(tenants.id, access.tenant.id))
    .limit(1);

  const newDomain    = values.customDomain || null;
  const domainChanged = existing?.customDomain !== newDomain;
  const wasActive    = existing?.customDomainStatus === "active";

  // Tentukan status baru:
  // - dikosongkan → none
  // - domain sama dan sudah active → pertahankan active (tidak trigger ulang verifikasi)
  // - domain baru / berubah → pending (akan trigger verifikasi)
  let newStatus: "none" | "pending" | "active";
  if (!newDomain) {
    newStatus = "none";
  } else if (wasActive && !domainChanged) {
    newStatus = "active";
  } else {
    newStatus = "pending";
  }

  await db
    .update(tenants)
    .set({
      subdomain:             values.subdomain || null,
      customDomain:          newDomain,
      customDomainStatus:    newStatus,
      customDomainVerifiedAt: newDomain ? undefined : null,
      updatedAt:             new Date(),
    })
    .where(eq(tenants.id, access.tenant.id));

  // Trigger verifikasi DNS hanya jika domain berubah atau belum active
  if (newDomain && (domainChanged || !wasActive)) {
    void triggerDomainVerification();
  }

  return {};
}

async function triggerDomainVerification() {
  try {
    const internalUrl =
      process.env.APP_INTERNAL_URL ??
      process.env.NEXT_PUBLIC_APP_URL ??
      "http://localhost:3000";
    const secret = process.env.CRON_SECRET;
    await fetch(`${internalUrl}/api/cron/verify-domains`, {
      headers: secret ? { Authorization: `Bearer ${secret}` } : {},
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    // Ignore — cron tetap jalan terjadwal sebagai fallback
  }
}

// ── Kontak & Sosial Media ─────────────────────────────────────────────────────
export async function saveContactSettingsAction(
  slug: string,
  values: {
    contactEmail:    string;
    contactPhone:    string;
    contactWhatsapp: string;
    contactAddress: {
      provinceId?: number;
      regencyId?:  number;
      districtId?: number;
      villageId?:  number;
      detail:      string;
      postalCode:  string;
    };
    socials: Record<string, string>;
  }
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { error: "Akses ditolak." };
  if (!canManageUsers(access.tenantUser)) return { error: "Akses ditolak." };

  // Resolve nama wilayah dari IDs untuk display di footer
  const { provinceId, regencyId, districtId, villageId } = values.contactAddress;
  const [province, regency, district, village] = await Promise.all([
    provinceId ? db.select({ name: refProvinces.name }).from(refProvinces).where(eq(refProvinces.id, provinceId)).limit(1).then(r => r[0]?.name ?? null) : null,
    regencyId  ? db.select({ name: refRegencies.name }).from(refRegencies).where(eq(refRegencies.id, regencyId)).limit(1).then(r => r[0]?.name ?? null) : null,
    districtId ? db.select({ name: refDistricts.name }).from(refDistricts).where(eq(refDistricts.id, districtId)).limit(1).then(r => r[0]?.name ?? null) : null,
    villageId  ? db.select({ name: refVillages.name }).from(refVillages).where(eq(refVillages.id, villageId)).limit(1).then(r => r[0]?.name ?? null) : null,
  ]);

  const tenantDb = createTenantDb(slug);
  await upsertSettings(tenantDb, "contact", {
    contact_email:    values.contactEmail,
    contact_phone:    normalizePhone(values.contactPhone) ?? "",
    contact_whatsapp: normalizePhone(values.contactWhatsapp) ?? "",
    contact_address: {
      ...values.contactAddress,
      provinceName: province,
      regencyName:  regency,
      districtName: district,
      villageName:  village,
    },
    socials: values.socials,
  });

  return {};
}

// ── Pembayaran: Rekening Bank ─────────────────────────────────────────────────
export async function savePaymentAccountsAction(
  slug: string,
  bankAccounts: Array<{
    id: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
    categories: string[];
  }>
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { error: "Akses ditolak." };
  if (!canManageUsers(access.tenantUser)) return { error: "Akses ditolak." };

  const tenantDb = createTenantDb(slug);
  await upsertSettings(tenantDb, "payment", { bank_accounts: bankAccounts });
  return {};
}

// ── Pembayaran: QRIS ──────────────────────────────────────────────────────────
export async function saveQrisAccountsAction(
  slug: string,
  qrisAccounts: Array<{
    id: string;
    name: string;
    imageUrl: string;
    categories: string[];
    isDynamic: boolean;
    emvPayload?: string;
    merchantName?: string;
    merchantCity?: string;
  }>
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { error: "Akses ditolak." };
  if (!canManageUsers(access.tenantUser)) return { error: "Akses ditolak." };

  const tenantDb = createTenantDb(slug);
  await upsertSettings(tenantDb, "payment", { qris_accounts: qrisAccounts });
  return {};
}

// ── Pembayaran: Gateway Config ────────────────────────────────────────────────
export async function saveGatewayConfigAction(
  slug: string,
  values: {
    midtrans?: { serverKey: string; clientKey: string; isSandbox: boolean };
    xendit?:   { apiKey: string };
    ipaymu?:   { va: string; apiKey: string };
  }
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { error: "Akses ditolak." };
  if (!canManageUsers(access.tenantUser)) return { error: "Akses ditolak." };

  const tenantDb = createTenantDb(slug);
  const entries: Record<string, unknown> = {};
  if (values.midtrans !== undefined) entries.midtrans = values.midtrans;
  if (values.xendit   !== undefined) entries.xendit   = values.xendit;
  if (values.ipaymu   !== undefined) entries.ipaymu   = values.ipaymu;

  await upsertSettings(tenantDb, "payment", entries);
  return {};
}

// ── Pembayaran: Kode Unik Transaksi ───────────────────────────────────────────
export async function saveUniqueCodeSettingAction(
  slug: string,
  enabled: boolean
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { error: "Akses ditolak." };
  if (!canManageUsers(access.tenantUser)) return { error: "Akses ditolak." };

  const tenantDb = createTenantDb(slug);
  await upsertSettings(tenantDb, "payment", { unique_code_enabled: enabled });
  return {};
}

// ── Tampilan ──────────────────────────────────────────────────────────────────
export async function saveDisplaySettingsAction(
  slug: string,
  values: {
    primaryColor:   string;
    secondaryColor: string;
    font:           string;
    headingFont:    string;
    footerText:     string;
  }
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { error: "Akses ditolak." };
  if (!canManageUsers(access.tenantUser)) return { error: "Akses ditolak." };

  const tenantDb = createTenantDb(slug);
  await upsertSettings(tenantDb, "display", {
    primary_color:   values.primaryColor,
    secondary_color: values.secondaryColor,
    font:            values.font,
    heading_font:    values.headingFont,
    footer_text:     values.footerText,
  });

  return {};
}

// ── Email / SMTP ──────────────────────────────────────────────────────────────
export async function saveSmtpConfigAction(
  slug: string,
  values: {
    host: string;
    port: number;
    user: string;
    password: string;
    fromName: string;
    fromEmail: string;
  }
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { error: "Akses ditolak." };
  if (!canManageUsers(access.tenantUser)) return { error: "Akses ditolak." };

  const tenantDb = createTenantDb(slug);
  await upsertSettings(tenantDb, "mail", { smtp_config: values });
  return {};
}

/**
 * Kirim email test pakai konfigurasi SMTP yang SEDANG DIISI di form (bukan yang
 * tersimpan di DB) — supaya admin bisa cek sebelum klik Simpan.
 */
export async function sendTestEmailAction(
  slug: string,
  values: {
    host: string;
    port: number;
    user: string;
    password: string;
    fromName: string;
    fromEmail: string;
  }
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { error: "Akses ditolak." };
  if (!canManageUsers(access.tenantUser)) return { error: "Akses ditolak." };

  const { getCurrentSession } = await import("@/lib/tenant");
  const session = await getCurrentSession();
  const targetEmail = session?.user?.email ?? (values.fromEmail || values.user);
  if (!targetEmail) return { error: "Tidak ada alamat tujuan — isi Email Pengirim dulu." };

  const { sendTenantMail } = await import("@/lib/mail");
  const result = await sendTenantMail(values, {
    to:      targetEmail,
    subject: "Email Test — Konfigurasi SMTP",
    html:    `<p>Ini email test dari pengaturan SMTP tenant <strong>${slug}</strong>. Kalau Anda menerima ini, konfigurasi SMTP sudah benar.</p>`,
  });

  if (!result.ok) return { error: result.error };
  return {};
}

// ── Notifikasi ────────────────────────────────────────────────────────────────
export async function saveNotificationSettingsAction(
  slug: string,
  values: {
    emailNewMember: boolean;
    emailPaymentIn: boolean;
    emailPaymentConfirmed: boolean;
  }
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { error: "Akses ditolak." };
  if (!canManageUsers(access.tenantUser)) return { error: "Akses ditolak." };

  const tenantDb = createTenantDb(slug);
  await upsertSettings(tenantDb, "notif", { notifications: values });
  return {};
}

// ── WhatsApp Gateway ──────────────────────────────────────────────────────────

export type WaConnectResult = { success: true } | { success: false; error: string };

/**
 * Daftarkan device baru di GOWA untuk tenant ini.
 * Device ID = tenant slug (unik, predictable, tidak perlu disimpan terpisah).
 * Dipanggil saat admin klik "Hubungkan WhatsApp" untuk pertama kali.
 */
export async function connectWhatsAppAction(slug: string): Promise<WaConnectResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!canManageUsers(access.tenantUser)) return { success: false, error: "Akses ditolak." };

  const serviceUrl = process.env.WHATSAPP_SERVICE_URL;
  if (!serviceUrl) return { success: false, error: "WhatsApp service belum dikonfigurasi di server." };

  const { gowaBasicAuth, WA_NOTIF_DEFAULTS } = await import("@/lib/whatsapp");
  const baseUrl  = serviceUrl.replace(/\/$/, "");
  const deviceId = slug;

  // Cek apakah device_id sungguh-sungguh terdaftar & listed di GOWA (bukan cuma percaya
  // response POST /devices — pernah ditemukan kasus device dihapus di GOWA, lalu POST
  // merespons seolah "already exists" padahal device TIDAK benar-benar listed/usable).
  async function existsOnGowa(): Promise<boolean> {
    try {
      const res  = await fetch(`${baseUrl}/app/devices`, {
        headers: { Authorization: gowaBasicAuth(), "X-Device-Id": deviceId },
        cache:   "no-store",
      });
      if (!res.ok) return false;
      const data = await res.json() as { results?: { device: string }[] };
      return (data.results ?? []).some((d) => d.device === deviceId);
    } catch {
      return false;
    }
  }

  // Daftarkan device di GOWA via POST /devices.
  // GOWA return 500 (bukan 409) untuk device yang sudah ada — kedua-duanya SECARA RESPONS ok,
  // tapi TIDAK dijadikan jaminan device benar-benar usable — selalu diverifikasi ulang di bawah.
  try {
    const res = await fetch(`${baseUrl}/devices`, {
      method:  "POST",
      headers: { Authorization: gowaBasicAuth(), "Content-Type": "application/json" },
      body:    JSON.stringify({ device_id: deviceId }),
    });
    if (!res.ok) {
      const text = await res.text();
      if (!text.includes("already exists")) {
        console.error("[connectWA] GOWA create device error:", res.status, text);
        return { success: false, error: "Gagal membuat device di GOWA. Cek konfigurasi server." };
      }
      // "already exists" → lanjut ke verifikasi, JANGAN langsung dianggap sukses
    }
  } catch (err) {
    console.error("[connectWA] fetch error:", err);
    return { success: false, error: "Tidak dapat terhubung ke WhatsApp service." };
  }

  // Verifikasi device benar-benar listed. Kalau tidak, coba SEKALI lagi (POST + verifikasi
  // ulang) — cukup untuk menutup celah race/inkonsistensi GOWA yang sebelumnya bikin device
  // "hilang secara diam-diam" meski UI melaporkan sukses.
  if (!(await existsOnGowa())) {
    try {
      await fetch(`${baseUrl}/devices`, {
        method:  "POST",
        headers: { Authorization: gowaBasicAuth(), "Content-Type": "application/json" },
        body:    JSON.stringify({ device_id: deviceId }),
      });
    } catch {
      // lanjut ke verifikasi ulang di bawah — kalau fetch ini gagal, existsOnGowa() akan gagal juga
    }
    if (!(await existsOnGowa())) {
      console.error("[connectWA] Device tidak terverifikasi listed di GOWA setelah retry:", deviceId);
      return {
        success: false,
        error: "Device WhatsApp tidak berhasil dibuat di server GOWA. Coba lagi beberapa saat, atau hubungi admin platform.",
      };
    }
  }

  // Simpan config awal ke settings tenant
  const tenantClient = createTenantDb(slug);
  const { getSettings, upsertSettings: upsert } = await import("@jalajogja/db");
  const existing = await getSettings(tenantClient, "notif");
  const existingConfig = existing["whatsapp_config"] as Record<string, unknown> | undefined;

  await upsert(tenantClient, "notif", {
    whatsapp_config: {
      device_id:     deviceId,
      phone_number:  existingConfig?.phone_number ?? null,
      verified:      existingConfig?.verified     ?? false,
      notifications: existingConfig?.notifications ?? WA_NOTIF_DEFAULTS,
    },
  });

  revalidatePath(`/app/${slug}/settings/notifications`);
  return { success: true };
}

/**
 * Konfirmasi koneksi setelah QR berhasil di-scan.
 * Dipanggil client saat polling status mendeteksi is_logged_in = true.
 */
export async function confirmWaConnectionAction(
  slug: string,
  phoneNumber: string | null,
): Promise<WaConnectResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };

  const tenantClient = createTenantDb(slug);
  const { getSettings, upsertSettings: upsert } = await import("@jalajogja/db");
  const existing = await getSettings(tenantClient, "notif");
  const config   = existing["whatsapp_config"] as Record<string, unknown> | undefined;

  if (!config) return { success: false, error: "Config WA tidak ditemukan." };

  await upsert(tenantClient, "notif", {
    whatsapp_config: {
      ...config,
      verified:     true,
      phone_number: phoneNumber ?? config.phone_number ?? null,
    },
  });

  revalidatePath(`/app/${slug}/settings/notifications`);
  return { success: true };
}

/**
 * Putuskan koneksi WhatsApp — logout device dari GOWA + reset verified di DB.
 */
export async function disconnectWhatsAppAction(slug: string): Promise<WaConnectResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!canManageUsers(access.tenantUser)) return { success: false, error: "Akses ditolak." };

  const serviceUrl = process.env.WHATSAPP_SERVICE_URL;
  if (serviceUrl) {
    const { gowaBasicAuth } = await import("@/lib/whatsapp");
    try {
      await fetch(`${serviceUrl.replace(/\/$/, "")}/app/logout`, {
        method:  "GET",
        headers: { Authorization: gowaBasicAuth(), "X-Device-Id": slug },
      });
    } catch {
      // Lanjut hapus config lokal meski GOWA gagal
    }
  }

  const tenantClient = createTenantDb(slug);
  const { getSettings, upsertSettings: upsert } = await import("@jalajogja/db");
  const existing = await getSettings(tenantClient, "notif");
  const config   = existing["whatsapp_config"] as Record<string, unknown> | undefined;

  if (config) {
    await upsert(tenantClient, "notif", {
      whatsapp_config: {
        ...config,
        verified:     false,
        phone_number: null,
      },
    });
  }

  revalidatePath(`/app/${slug}/settings/notifications`);
  return { success: true };
}

/**
 * Nonaktifkan WhatsApp Gateway sepenuhnya — hapus config dari DB (kembali ke state "belum diaktifkan").
 * Berbeda dengan disconnectWhatsAppAction yang hanya reset verified/phone.
 */
export async function deactivateWhatsAppAction(slug: string): Promise<WaConnectResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!canManageUsers(access.tenantUser)) return { success: false, error: "Akses ditolak." };

  const serviceUrl = process.env.WHATSAPP_SERVICE_URL;
  if (serviceUrl) {
    const { gowaBasicAuth } = await import("@/lib/whatsapp");
    try {
      await fetch(`${serviceUrl.replace(/\/$/, "")}/app/logout`, {
        method:  "GET",
        headers: { Authorization: gowaBasicAuth(), "X-Device-Id": slug },
      });
    } catch {
      // Lanjut hapus config lokal meski GOWA gagal
    }
  }

  const tenantClient = createTenantDb(slug);
  const { deleteSetting } = await import("@jalajogja/db");
  // Hapus row setting sepenuhnya (bukan set value ke null — settings.value bertipe
  // JSONB NOT NULL, upsert dengan null akan selalu gagal constraint violation).
  await deleteSetting(tenantClient, "whatsapp_config", "notif");

  revalidatePath(`/app/${slug}/settings/notifications`);
  return { success: true };
}

/**
 * Simpan pengaturan toggle notifikasi WhatsApp.
 */
export async function saveWaNotificationSettingsAction(
  slug: string,
  notifications: Record<string, boolean>,
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { error: "Akses ditolak." };
  if (!canManageUsers(access.tenantUser)) return { error: "Akses ditolak." };

  const tenantClient = createTenantDb(slug);
  const { getSettings, upsertSettings: upsert } = await import("@jalajogja/db");
  const existing = await getSettings(tenantClient, "notif");
  const config   = existing["whatsapp_config"] as Record<string, unknown> | undefined;

  if (!config) return { error: "WhatsApp belum dikonfigurasi." };

  await upsert(tenantClient, "notif", {
    whatsapp_config: { ...config, notifications },
  });

  revalidatePath(`/app/${slug}/settings/notifications`);
  return {};
}

/**
 * Simpan teks kustom untuk satu event notifikasi WA (override default kode).
 */
export async function saveWaTemplateAction(
  slug:  string,
  event: string,
  text:  string,
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { error: "Akses ditolak." };
  if (!canManageUsers(access.tenantUser)) return { error: "Akses ditolak." };

  const trimmed = text.trim();
  if (!trimmed) return { error: "Teks tidak boleh kosong." };

  const tenantClient = createTenantDb(slug);
  const { getSettings, upsertSettings: upsert } = await import("@jalajogja/db");
  const existing  = await getSettings(tenantClient, "notif");
  const templates = (existing["wa_message_templates"] as Record<string, string> | undefined) ?? {};

  await upsert(tenantClient, "notif", {
    wa_message_templates: { ...templates, [event]: trimmed },
  });

  revalidatePath(`/app/${slug}/settings/notifications`);
  return {};
}

/**
 * Hapus override teks kustom untuk satu event — kembali pakai default kode.
 */
export async function resetWaTemplateAction(
  slug:  string,
  event: string,
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { error: "Akses ditolak." };
  if (!canManageUsers(access.tenantUser)) return { error: "Akses ditolak." };

  const tenantClient = createTenantDb(slug);
  const { getSettings, upsertSettings: upsert } = await import("@jalajogja/db");
  const existing  = await getSettings(tenantClient, "notif");
  const templates = { ...((existing["wa_message_templates"] as Record<string, string> | undefined) ?? {}) };
  delete templates[event];

  await upsert(tenantClient, "notif", { wa_message_templates: templates });

  revalidatePath(`/app/${slug}/settings/notifications`);
  return {};
}

// ─── INVITE ACTIONS ──────────────────────────────────────────────────────────

export async function createInviteAction(
  slug: string,
  data: InviteFormData
): Promise<InviteResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!canManageUsers(access.tenantUser)) return { success: false, error: "Hanya owner/ketua yang bisa mengundang." };

  const { db: tenantDb, schema } = createTenantDb(slug);

  // Validasi memberId ada di tenant ini
  const [membership] = await db
    .select({ memberId: tenantMemberships.memberId })
    .from(tenantMemberships)
    .where(
      and(
        eq(tenantMemberships.tenantId, access.tenant.id),
        eq(tenantMemberships.memberId, data.memberId)
      )
    )
    .limit(1);

  if (!membership) return { success: false, error: "Anggota tidak ditemukan di cabang ini." };

  // Cek member belum jadi user aktif di tenant ini
  const [existingUser] = await tenantDb
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.memberId, data.memberId))
    .limit(1);

  if (existingUser) {
    return { success: false, error: "Anggota ini sudah memiliki akses dashboard." };
  }

  // Ambil email member dari contacts jika ada
  const [memberData] = await db
    .select({ contactId: members.contactId })
    .from(members)
    .where(eq(members.id, data.memberId))
    .limit(1);

  let email: string | null = null;
  if (memberData?.contactId) {
    const [contact] = await db
      .select({ email: contacts.email })
      .from(contacts)
      .where(eq(contacts.id, memberData.contactId))
      .limit(1);
    email = contact?.email ?? null;
  }

  if (data.role === "custom" && !data.customRoleId) {
    return { success: false, error: "Role kustom wajib dipilih." };
  }

  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  // Upsert: update token jika sudah ada invite yang belum accepted
  const [existingInvite] = await tenantDb
    .select({ id: schema.tenantInvites.id })
    .from(schema.tenantInvites)
    .where(eq(schema.tenantInvites.memberId, data.memberId))
    .limit(1);

  let inviteId: string;

  if (existingInvite) {
    await tenantDb
      .update(schema.tenantInvites)
      .set({
        role:           data.role,
        customRoleId:   data.customRoleId ?? null,
        token,
        expiresAt,
        acceptedAt:     null,
        deliveryMethod: data.deliveryMethod,
        email,
        createdBy:      access.tenantUser.id,
      })
      .where(eq(schema.tenantInvites.id, existingInvite.id));
    inviteId = existingInvite.id;
  } else {
    const [invite] = await tenantDb
      .insert(schema.tenantInvites)
      .values({
        memberId:       data.memberId,
        email,
        role:           data.role,
        customRoleId:   data.customRoleId ?? null,
        token,
        expiresAt,
        deliveryMethod: data.deliveryMethod,
        createdBy:      access.tenantUser.id,
      })
      .returning({ id: schema.tenantInvites.id });
    inviteId = invite.id;
  }

  revalidatePath(`/app/${slug}/settings/users`);
  return { success: true, inviteId, token };
}

export async function revokeInviteAction(
  slug: string,
  inviteId: string
): Promise<StrictActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!canManageUsers(access.tenantUser)) return { success: false, error: "Akses ditolak." };

  const { db: tenantDb, schema } = createTenantDb(slug);
  await tenantDb
    .delete(schema.tenantInvites)
    .where(eq(schema.tenantInvites.id, inviteId));

  revalidatePath(`/app/${slug}/settings/users`);
  return { success: true };
}

export async function removeUserAction(
  slug: string,
  userId: string
): Promise<StrictActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!canManageUsers(access.tenantUser)) return { success: false, error: "Akses ditolak." };

  const { db: tenantDb, schema } = createTenantDb(slug);

  if (userId === access.tenantUser.id) {
    return { success: false, error: "Tidak bisa menghapus akses diri sendiri." };
  }

  const [targetUser] = await tenantDb
    .select({ role: schema.users.role })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  if (!targetUser) return { success: false, error: "Pengguna tidak ditemukan." };
  if (targetUser.role === "owner") return { success: false, error: "Owner tidak bisa dihapus." };

  await tenantDb
    .delete(schema.users)
    .where(eq(schema.users.id, userId));

  revalidatePath(`/app/${slug}/settings/users`);
  return { success: true };
}

export async function updateUserRoleAction(
  slug: string,
  userId: string,
  role: "ketua" | "sekretaris" | "bendahara" | "custom",
  customRoleId?: string
): Promise<StrictActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!canManageUsers(access.tenantUser)) return { success: false, error: "Akses ditolak." };

  const { db: tenantDb, schema } = createTenantDb(slug);

  const [target] = await tenantDb
    .select({ role: schema.users.role })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  if (!target) return { success: false, error: "Pengguna tidak ditemukan." };
  if (target.role === "owner") return { success: false, error: "Role owner tidak bisa diubah." };

  if (role === "custom" && !customRoleId) {
    return { success: false, error: "Role kustom wajib dipilih." };
  }

  await tenantDb
    .update(schema.users)
    .set({
      role,
      customRoleId: role === "custom" ? (customRoleId ?? null) : null,
      updatedAt:    new Date(),
    })
    .where(eq(schema.users.id, userId));

  revalidatePath(`/app/${slug}/settings/users`);
  return { success: true };
}

// ─── CUSTOM ROLE ACTIONS ─────────────────────────────────────────────────────

export async function createCustomRoleAction(
  slug: string,
  data: CustomRoleFormData
): Promise<CustomRoleResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!canManageUsers(access.tenantUser)) return { success: false, error: "Akses ditolak." };

  if (!data.name.trim()) return { success: false, error: "Nama role wajib diisi." };

  const { db: tenantDb, schema } = createTenantDb(slug);
  const [inserted] = await tenantDb
    .insert(schema.customRoles)
    .values({
      name:        data.name.trim(),
      description: data.description?.trim() || null,
      permissions: data.permissions,
    })
    .returning({ id: schema.customRoles.id });

  revalidatePath(`/app/${slug}/settings/roles`);
  return { success: true, id: inserted.id };
}

export async function updateCustomRoleAction(
  slug: string,
  roleId: string,
  data: CustomRoleFormData
): Promise<StrictActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!canManageUsers(access.tenantUser)) return { success: false, error: "Akses ditolak." };

  if (!data.name.trim()) return { success: false, error: "Nama role wajib diisi." };

  const { db: tenantDb, schema } = createTenantDb(slug);

  const [existing] = await tenantDb
    .select({ isSystem: schema.customRoles.isSystem })
    .from(schema.customRoles)
    .where(eq(schema.customRoles.id, roleId))
    .limit(1);

  if (!existing) return { success: false, error: "Role tidak ditemukan." };
  if (existing.isSystem) return { success: false, error: "System role tidak bisa diedit." };

  await tenantDb
    .update(schema.customRoles)
    .set({
      name:        data.name.trim(),
      description: data.description?.trim() || null,
      permissions: data.permissions,
    })
    .where(eq(schema.customRoles.id, roleId));

  revalidatePath(`/app/${slug}/settings/roles`);
  return { success: true };
}

export async function deleteCustomRoleAction(
  slug: string,
  roleId: string
): Promise<StrictActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!canManageUsers(access.tenantUser)) return { success: false, error: "Akses ditolak." };

  const { db: tenantDb, schema } = createTenantDb(slug);

  const [existing] = await tenantDb
    .select({ isSystem: schema.customRoles.isSystem })
    .from(schema.customRoles)
    .where(eq(schema.customRoles.id, roleId))
    .limit(1);

  if (!existing) return { success: false, error: "Role tidak ditemukan." };
  if (existing.isSystem) return { success: false, error: "System role tidak bisa dihapus." };

  const [userWithRole] = await tenantDb
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.customRoleId, roleId))
    .limit(1);

  if (userWithRole) {
    return { success: false, error: "Role sedang digunakan — ubah role pengguna tersebut terlebih dahulu." };
  }

  await tenantDb
    .delete(schema.customRoles)
    .where(eq(schema.customRoles.id, roleId));

  revalidatePath(`/app/${slug}/settings/roles`);
  return { success: true };
}

// ─── AKTIVASI LANGSUNG ────────────────────────────────────────────────────────

export type ActivateUserData = {
  memberId:      string;
  role:          "ketua" | "sekretaris" | "bendahara" | "custom";
  customRoleId?: string;
  email:         string;
  password:      string;
  name:          string;
};

export type ActivateResult =
  | { success: true; name: string }
  | { success: false; error: string };

export type AddExistingData = {
  memberId:      string;
  role:          "ketua" | "sekretaris" | "bendahara" | "custom";
  customRoleId?: string;
};

/**
 * Beri akses dashboard ke anggota yang sudah punya akun front-end.
 * Tidak perlu password baru — pakai betterAuthUserId yang sudah ada di public.members.
 */
export async function addExistingAccountAction(
  slug: string,
  data: AddExistingData
): Promise<ActivateResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!canManageUsers(access.tenantUser)) return { success: false, error: "Hanya owner/ketua yang bisa menambah pengguna." };

  if (data.role === "custom" && !data.customRoleId) {
    return { success: false, error: "Role kustom wajib dipilih." };
  }

  const { db: tenantDb, schema } = createTenantDb(slug);

  // Validasi member ada di tenant ini
  const [membership] = await db
    .select({ memberId: tenantMemberships.memberId })
    .from(tenantMemberships)
    .where(and(
      eq(tenantMemberships.tenantId, access.tenant.id),
      eq(tenantMemberships.memberId, data.memberId),
    ))
    .limit(1);

  if (!membership) return { success: false, error: "Anggota tidak ditemukan di cabang ini." };

  // Ambil betterAuthUserId dan nama dari member
  const [memberData] = await db
    .select({ name: members.name, betterAuthUserId: members.betterAuthUserId })
    .from(members)
    .where(eq(members.id, data.memberId))
    .limit(1);

  if (!memberData?.betterAuthUserId) {
    return { success: false, error: "Anggota belum punya akun front-end. Gunakan metode undang atau aktifkan langsung." };
  }

  // Cek belum jadi user di tenant ini
  const [existing] = await tenantDb
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.memberId, data.memberId))
    .limit(1);

  if (existing) return { success: false, error: "Anggota ini sudah memiliki akses dashboard." };

  await tenantDb.insert(schema.users).values({
    betterAuthUserId: memberData.betterAuthUserId,
    role:             data.role,
    customRoleId:     data.role === "custom" ? (data.customRoleId ?? null) : null,
    memberId:         data.memberId,
  });

  revalidatePath(`/app/${slug}/settings/users`);
  return { success: true, name: memberData.name };
}

/**
 * Owner/ketua langsung buat akun + aktifkan pengurus tanpa kirim link.
 * Admin yang tentukan email dan password — user bisa ubah password nanti.
 */
export async function activateUserDirectAction(
  slug: string,
  data: ActivateUserData
): Promise<ActivateResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!canManageUsers(access.tenantUser)) return { success: false, error: "Hanya owner/ketua yang bisa mengaktifkan pengguna." };

  if (!data.email.trim())       return { success: false, error: "Email wajib diisi." };
  if (data.password.length < 8) return { success: false, error: "Password minimal 8 karakter." };
  if (!data.name.trim())        return { success: false, error: "Nama wajib diisi." };
  if (data.role === "custom" && !data.customRoleId) {
    return { success: false, error: "Role kustom wajib dipilih." };
  }

  const { db: tenantDb, schema } = createTenantDb(slug);

  // Validasi member ada di tenant ini
  const [membership] = await db
    .select({ memberId: tenantMemberships.memberId })
    .from(tenantMemberships)
    .where(
      and(
        eq(tenantMemberships.tenantId, access.tenant.id),
        eq(tenantMemberships.memberId, data.memberId)
      )
    )
    .limit(1);

  if (!membership) return { success: false, error: "Anggota tidak ditemukan di cabang ini." };

  // Cek member belum jadi user tenant ini
  const [existingByMember] = await tenantDb
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.memberId, data.memberId))
    .limit(1);

  if (existingByMember) return { success: false, error: "Anggota ini sudah memiliki akses dashboard." };

  // Jika anggota sudah punya akun front-end, pakai langsung — jangan buat akun baru
  const [memberRecord] = await db
    .select({ betterAuthUserId: members.betterAuthUserId })
    .from(members)
    .where(eq(members.id, data.memberId))
    .limit(1);

  if (memberRecord?.betterAuthUserId) {
    await tenantDb.insert(schema.users).values({
      betterAuthUserId: memberRecord.betterAuthUserId,
      role:             data.role,
      customRoleId:     data.role === "custom" ? (data.customRoleId ?? null) : null,
      memberId:         data.memberId,
    });
    revalidatePath(`/app/${slug}/settings/users`);
    return { success: true, name: data.name.trim() };
  }

  // Cek email sudah terdaftar di Better Auth
  const { user: authUserTable } = await import("@jalajogja/db");
  const [existingAuth] = await db
    .select({ id: authUserTable.id })
    .from(authUserTable)
    .where(eq(authUserTable.email, data.email.toLowerCase().trim()))
    .limit(1);

  let userId: string;

  if (existingAuth) {
    // Email sudah ada — pakai akun yang ada (pengurus dari cabang lain dll)
    userId = existingAuth.id;

    // Pastikan akun ini belum jadi user di tenant ini
    const [existingByAuth] = await tenantDb
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.betterAuthUserId, userId))
      .limit(1);

    if (existingByAuth) {
      return { success: false, error: "Email ini sudah terdaftar sebagai pengguna dashboard ini." };
    }
  } else {
    // Buat akun baru via Better Auth server API
    const { auth } = await import("@/lib/auth");
    const result = await auth.api.signUpEmail({
      body: {
        name:     data.name.trim(),
        email:    data.email.toLowerCase().trim(),
        password: data.password,
      },
    });

    if (!result?.user) return { success: false, error: "Gagal membuat akun. Coba lagi." };
    userId = result.user.id;
  }

  // Set better_auth_user_id di public.members agar pengurus bisa login front-end
  // sebagai anggota IKPM. Hanya update jika belum terisi (jaga idempotency).
  await db
    .update(members)
    .set({ betterAuthUserId: userId })
    .where(and(eq(members.id, data.memberId), isNull(members.betterAuthUserId)));

  // Buat user di tenant
  await tenantDb.insert(schema.users).values({
    betterAuthUserId: userId,
    role:             data.role,
    customRoleId:     data.role === "custom" ? (data.customRoleId ?? null) : null,
    memberId:         data.memberId,
  });

  revalidatePath(`/app/${slug}/settings/users`);
  return { success: true, name: data.name.trim() };
}

// ─── SEO PAGE OVERRIDES (Fase 3, docs/arsitektur-seo.md § 3.3) ────────────────

export type SeoOverrideFormData = {
  metaTitle?:     string;
  metaDesc?:      string;
  ogTitle?:       string;
  ogDescription?: string;
  ogImageId?:     string | null;
  robots?:        "index,follow" | "noindex" | "noindex,nofollow" | null;
};

export async function saveSeoPageOverrideAction(
  slug:    string,
  pageKey: string,
  values:  SeoOverrideFormData,
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { error: "Akses ditolak." };
  if (!canManageUsers(access.tenantUser)) return { error: "Akses ditolak." };

  const { db: tenantDb, schema } = createTenantDb(slug);

  const row = {
    metaTitle:     values.metaTitle?.trim()     || null,
    metaDesc:      values.metaDesc?.trim()      || null,
    ogTitle:       values.ogTitle?.trim()       || null,
    ogDescription: values.ogDescription?.trim() || null,
    ogImageId:     values.ogImageId || null,
    robots:        values.robots || null,
    updatedAt:     new Date(),
  };

  await tenantDb
    .insert(schema.seoPageOverrides)
    .values({ pageKey, ...row })
    .onConflictDoUpdate({ target: schema.seoPageOverrides.pageKey, set: row });

  revalidatePath(`/app/${slug}/settings/seo`);
  return {};
}

export async function resetSeoPageOverrideAction(
  slug:    string,
  pageKey: string,
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { error: "Akses ditolak." };
  if (!canManageUsers(access.tenantUser)) return { error: "Akses ditolak." };

  const { db: tenantDb, schema } = createTenantDb(slug);
  await tenantDb
    .delete(schema.seoPageOverrides)
    .where(eq(schema.seoPageOverrides.pageKey, pageKey));

  revalidatePath(`/app/${slug}/settings/seo`);
  return {};
}

// ── Keanggotaan (khusus tenant forum) ─────────────────────────────────────────
// Konfigurasi produk/campaign sebagai syarat iuran forum. Disimpan di settings key
// "membership_config", group "forum" (migration 0042). Dibaca oleh
// activateForumMembershipIfApplicable() di finance/billing/actions.ts saat invoice
// lunas. Lihat docs/arsitektur-backbone-ikpm.md § "Alur Pendaftaran Forum v2".

export type MembershipConfigData = {
  requiredProductId:  string | null;
  // Wajib HANYA relevan kalau slot ID-nya terisi. Admin menentukan per-item mana yang wajib —
  // TIDAK ADA lagi mode "salah satu cukup" yang membiarkan user memilih (lihat
  // docs/arsitektur-gabung-forum.md § "Redesain /gabung" untuk alasan).
  productRequired:    boolean;
  requiredCampaignId: string | null;
  campaignRequired:   boolean;
  // Teks bebas (multi-paragraf, dipisah baris baru) yang dijelaskan admin forum tentang
  // sifat/aturan keanggotaan mereka — ditampilkan apa adanya di halaman publik /gabung
  // sebelum tombol daftar. Opsional — kosong berarti tidak ada info tambahan.
  registrationInfo: string | null;
  // Nomor keanggotaan lokal forum (opsional) — null berarti fitur nonaktif, tidak ada
  // membership_number yang digenerate saat member bergabung. Lihat
  // lib/forum-membership-number.ts.
  membershipNumberFormat: ForumMembershipNumberFormat | null;
};

export async function saveMembershipConfigAction(
  slug:   string,
  values: MembershipConfigData,
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { error: "Akses ditolak." };
  if (access.tenant.tenantType !== "forum") return { error: "Hanya untuk tenant forum." };

  const tenantDb = createTenantDb(slug);

  const membershipNumberFormat =
    values.membershipNumberFormat && FORUM_MEMBERSHIP_NUMBER_FORMATS.includes(values.membershipNumberFormat)
      ? values.membershipNumberFormat
      : null;

  await upsertSetting(tenantDb, "membership_config", "forum", {
    requiredProductId:  values.requiredProductId  || null,
    productRequired:    !!values.requiredProductId  && !!values.productRequired,
    requiredCampaignId: values.requiredCampaignId || null,
    campaignRequired:   !!values.requiredCampaignId && !!values.campaignRequired,
    registrationInfo:   values.registrationInfo?.trim() || null,
    membershipNumberFormat,
  });

  revalidatePath(`/app/${slug}/settings/keanggotaan`);
  revalidatePath(`/${slug}/gabung`);
  return {};
}
