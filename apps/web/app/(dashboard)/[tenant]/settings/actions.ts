"use server";

import { getTenantAccess } from "@/lib/tenant";
import { createTenantDb, db, tenants } from "@jalajogja/db";
import { upsertSettings } from "@jalajogja/db";
import { eq } from "drizzle-orm";

type ActionResult = { error?: string };

// ── Umum ──────────────────────────────────────────────────────────────────────
export async function saveGeneralSettingsAction(
  slug: string,
  values: {
    siteName: string;
    tagline: string;
    logoUrl: string;
    faviconUrl: string;
    timezone: string;
    language: string;
    currency: string;
  }
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { error: "Akses ditolak." };

  const tenantDb = createTenantDb(slug);
  await upsertSettings(tenantDb, "general", {
    site_name:   values.siteName,
    tagline:     values.tagline,
    logo_url:    values.logoUrl,
    favicon_url: values.faviconUrl,
    timezone:    values.timezone,
    language:    values.language,
    currency:    values.currency,
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

  // Validasi format custom domain jika diisi
  if (values.customDomain) {
    const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i;
    if (!domainRegex.test(values.customDomain)) {
      return { error: "Format domain tidak valid. Contoh: ikpm.or.id" };
    }
  }

  await db
    .update(tenants)
    .set({
      subdomain:          values.subdomain    || null,
      customDomain:       values.customDomain || null,
      // Reset ke pending jika custom domain berubah, none jika dikosongkan
      customDomainStatus: values.customDomain ? "pending" : "none",
      customDomainVerifiedAt: values.customDomain ? undefined : null,
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, access.tenant.id));

  return {};
}

// ── Kontak & Sosial Media ─────────────────────────────────────────────────────
export async function saveContactSettingsAction(
  slug: string,
  values: {
    contactEmail: string;
    contactPhone: string;
    contactAddress: Record<string, unknown>;
    socials: Record<string, string>;
  }
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { error: "Akses ditolak." };

  const tenantDb = createTenantDb(slug);
  await upsertSettings(tenantDb, "contact", {
    contact_email:   values.contactEmail,
    contact_phone:   values.contactPhone,
    contact_address: values.contactAddress,
    socials:         values.socials,
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

  const tenantDb = createTenantDb(slug);
  const entries: Record<string, unknown> = {};
  if (values.midtrans !== undefined) entries.midtrans = values.midtrans;
  if (values.xendit   !== undefined) entries.xendit   = values.xendit;
  if (values.ipaymu   !== undefined) entries.ipaymu   = values.ipaymu;

  await upsertSettings(tenantDb, "payment", entries);
  return {};
}

// ── Tampilan ──────────────────────────────────────────────────────────────────
export async function saveDisplaySettingsAction(
  slug: string,
  values: {
    primaryColor: string;
    font: string;
    footerText: string;
  }
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { error: "Akses ditolak." };

  const tenantDb = createTenantDb(slug);
  await upsertSettings(tenantDb, "display", {
    primary_color: values.primaryColor,
    font:          values.font,
    footer_text:   values.footerText,
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

  const tenantDb = createTenantDb(slug);
  await upsertSettings(tenantDb, "mail", { smtp_config: values });
  return {};
}

// ── Notifikasi ────────────────────────────────────────────────────────────────
export async function saveNotificationSettingsAction(
  slug: string,
  values: {
    emailNewMember: boolean;
    emailPaymentIn: boolean;
    emailPaymentConfirmed: boolean;
    whatsappEnabled: boolean;
  }
): Promise<ActionResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { error: "Akses ditolak." };

  const tenantDb = createTenantDb(slug);
  await upsertSettings(tenantDb, "notif", { notifications: values });
  return {};
}
