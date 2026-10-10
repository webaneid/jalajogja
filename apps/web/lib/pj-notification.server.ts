import "server-only";
import { createHash, randomBytes } from "crypto";
import { and, asc, eq, gte, isNull, notInArray, sql } from "drizzle-orm";
import {
  db, tenants, tenantMemberships, members, contacts, pjVerificationLinks,
  createTenantDb, getSetting, upsertSetting,
} from "@jalajogja/db";
import { sendWaNotification, type WaNotifKey } from "@/lib/whatsapp";
import { resolveOrgName, waAppUrl, waRupiah } from "@/lib/wa-notify";
import { sendTenantMail, sendPlatformMail, isPlatformMailConfigured, type TenantSmtpConfig } from "@/lib/mail";
import { getTenantTimezone, formatInTz, todayInTz } from "@/lib/tenant-timezone.server";
import { normalizePhone, displayPhone } from "@/lib/phone";
import {
  PJ_CONFIG_KEY, type OfficerNotificationConfig, type PjTarget,
} from "@/lib/pj-config";
import { isValidWhatsappGroupUrl, WHATSAPP_GROUP_SETTING_KEY } from "@/lib/whatsapp-group";
import type { MembershipConfigData } from "@/app/(dashboard)/app/[tenant]/settings/actions";

// Mesin notifikasi ke Penanggung Jawab (PJ) modul. Lihat docs/arsitektur-notifikasi-pengurus.md § 8.
//   - resolvePjRecipients : target (pengurus/divisi/kontak bebas) → orang + nomor + user dashboard
//   - runPjDigests        : dipanggil cron tiap jam; mengirim ringkasan sesuai jam lokal tenant
// Tidak pernah melempar ke pemanggil per tenant (satu tenant gagal tidak menghentikan yang lain).

type TenantDbHandle = ReturnType<typeof createTenantDb>;

export type PjRecipient = {
  name:   string;
  phone:  string | null;   // E.164
  email:  string | null;
  userId: string | null;   // tenant users.id bila orang ini punya akun dashboard
};

export const PJ_LINK_TTL_HOURS = 36;
const KEUANGAN_SLOT_HOURS = [13, 16, 18] as const;
const DAILY_DIGEST_HOUR   = 16;
const STATE_KEY           = "pj_digest_state";

export function hashPjToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newPjToken(): { token: string; hash: string } {
  const token = randomBytes(24).toString("base64url"); // 192 bit
  return { token, hash: hashPjToken(token) };
}

/** 4 digit terakhir nomor (hanya digit) — kata sandi halaman verifikasi. */
export function lastFourDigits(phone: string): string {
  return phone.replace(/\D/g, "").slice(-4);
}

// ── Resolusi penerima ──────────────────────────────────────────────────────────

export async function resolvePjRecipients(
  tenantDb: TenantDbHandle,
  targets:  PjTarget[],
): Promise<PjRecipient[]> {
  const { db: tdb, schema } = tenantDb;
  const out: PjRecipient[] = [];

  for (const t of targets) {
    if (t.type === "contact") {
      out.push({ name: t.name, phone: t.phone ?? null, email: t.email ?? null, userId: null });
      continue;
    }

    const officerRows = t.type === "officer"
      ? await tdb.select().from(schema.officers)
          .where(and(eq(schema.officers.id, t.officerId), eq(schema.officers.isActive, true)))
          .limit(1)
      : await tdb.select().from(schema.officers)
          .where(and(eq(schema.officers.divisionId, t.divisionId), eq(schema.officers.isActive, true)))
          .orderBy(asc(schema.officers.sortOrder), asc(schema.officers.createdAt))
          .limit(1);
    const officer = officerRows[0];
    if (!officer) continue;

    const [person] = await db
      .select({ name: members.name, whatsapp: contacts.whatsapp, phone: contacts.phone, email: contacts.email })
      .from(members)
      .leftJoin(contacts, eq(contacts.id, members.contactId))
      .where(eq(members.id, officer.memberId))
      .limit(1);
    if (!person) continue;

    let userId = officer.userId ?? null;
    if (!userId) {
      const [u] = await tdb.select({ id: schema.users.id }).from(schema.users)
        .where(eq(schema.users.memberId, officer.memberId)).limit(1);
      userId = u?.id ?? null;
    }

    out.push({
      name:   person.name,
      phone:  normalizePhone(person.whatsapp || person.phone),
      email:  person.email || null,
      userId,
    });
  }
  return out;
}

// ── Kirim satu pesan ke satu penerima: WA dulu, gagal apa pun → email ─────────────────────

// Teks bebas dari pelanggan (nama/bank) masuk ke pesan bendahara — netralkan format WA, baris baru,
// dan tautan supaya tidak bisa dipakai menyisipkan pesan palsu/phishing.
function cleanUserText(s: string | null | undefined, max = 40): string {
  return (s ?? "").replace(/https?:\/\/\S+/gi, "").replace(/[*_~`]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function deliverToRecipient(opts: {
  slug:      string;
  tenantDb:  TenantDbHandle;
  event:     WaNotifKey;
  recipient: PjRecipient;
  subject:   string;
  waText:    string;     // teks WA (format *tebal* WhatsApp)
}): Promise<"wa" | "email" | "none"> {
  const { slug, tenantDb, event, recipient, subject, waText } = opts;

  if (recipient.phone) {
    const res = await sendWaNotification({ slug, event, to: recipient.phone, message: waText, skipEventToggle: true });
    if (res.ok) return "wa";
  }
  if (!recipient.email) return "none";

  const html = `<div style="font-family:sans-serif;white-space:pre-wrap">${escapeHtml(waText.replace(/\*/g, ""))
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>')}</div>`;
  const smtp = await getSetting<TenantSmtpConfig>(tenantDb, "smtp_config", "mail");
  if (smtp) {
    const sent = await sendTenantMail(smtp, { to: recipient.email, subject, html });
    if (sent.ok) return "email";
  }
  if (isPlatformMailConfigured()) {
    const sent = await sendPlatformMail({ to: recipient.email, subject, html });
    if (sent.ok) return "email";
  }
  return "none";
}

// ── Jadwal ────────────────────────────────────────────────────────────────────────────

function localHour(now: Date, timeZone: string): number {
  const h = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hour12: false }).format(now);
  return parseInt(h, 10) % 24;
}

function dayOfYear(localDate: string): number {
  const [y, m, d] = localDate.split("-").map(Number);
  return Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 0)) / 86_400_000);
}

type DigestState = Record<string, string>;

/**
 * Dipanggil cron (tiap jam). Aman dipanggil berulang: penanda per modul+jam mencegah kirim ganda.
 */
export async function runPjDigests(now = new Date()): Promise<{ keuangan: number; keanggotaan: number }> {
  const activeTenants = await db
    .select({ id: tenants.id, slug: tenants.slug, tenantType: tenants.tenantType })
    .from(tenants)
    .where(eq(tenants.isActive, true));

  const sent = { keuangan: 0, keanggotaan: 0 };

  // Tautan kedaluwarsa > 30 hari dihapus (menyimpan nomor HP penerima — jangan disimpan selamanya).
  try {
    await db.delete(pjVerificationLinks).where(sql`${pjVerificationLinks.expiresAt} < now() - interval '30 days'`);
  } catch (err) {
    console.error("[runPjDigests] bersih-bersih tautan gagal:", err);
  }

  for (const t of activeTenants) {
    try {
      const tenantDb = createTenantDb(t.slug);
      const config = await getSetting<OfficerNotificationConfig>(tenantDb, PJ_CONFIG_KEY, "notif");
      if (!config) continue;

      const tz   = await getTenantTimezone(tenantDb);
      const hour = localHour(now, tz);
      const localDate = todayInTz(tz);
      const state = (await getSetting<DigestState>(tenantDb, STATE_KEY, "notif")) ?? {};

      const keu = config.keuangan;
      const slotIdx = KEUANGAN_SLOT_HOURS.indexOf(hour as typeof KEUANGAN_SLOT_HOURS[number]);
      if (keu?.enabled && keu.targets.length > 0 && slotIdx >= 0) {
        const stamp = `${localDate}T${hour}`;
        if (state.keuangan !== stamp) {
          state.keuangan = stamp;
          await upsertSetting(tenantDb, STATE_KEY, "notif", state); // tandai SEBELUM kirim
          sent.keuangan += await sendKeuanganDigest({
            slug: t.slug, tenantId: t.id, tenantDb, tz, targets: keu.targets,
            rotationIndex: dayOfYear(localDate) * KEUANGAN_SLOT_HOURS.length + slotIdx,
          });
        }
      }

      const kea = config.keanggotaan;
      if (kea?.enabled && kea.targets.length > 0 && hour === DAILY_DIGEST_HOUR) {
        const stamp = `${localDate}T${hour}`;
        if (state.keanggotaan !== stamp) {
          state.keanggotaan = stamp;
          await upsertSetting(tenantDb, STATE_KEY, "notif", state);
          sent.keanggotaan += await sendKeanggotaanDigest({
            slug: t.slug, tenantId: t.id, tenantType: t.tenantType, tenantDb, targets: kea.targets, now,
          });
        }
      }
    } catch (err) {
      console.error(`[runPjDigests] tenant ${t.slug} gagal:`, err);
    }
  }
  return sent;
}

// ── Digest KEUANGAN ──────────────────────────────────────────────────────────────────

async function sendKeuanganDigest(opts: {
  slug: string; tenantId: string; tenantDb: TenantDbHandle; tz: string;
  targets: PjTarget[]; rotationIndex: number;
}): Promise<number> {
  const { slug, tenantId, tenantDb, tz, targets, rotationIndex } = opts;
  const { db: tdb, schema } = tenantDb;

  // SEMUA yang masih belum diverifikasi — bukan hanya yang baru (pengingat otomatis).
  const pending = await tdb
    .select({
      paymentId:     schema.payments.id,
      amount:        schema.payments.amount,
      method:        schema.payments.method,
      payerName:     schema.payments.payerName,
      payerBank:     schema.payments.payerBank,
      submittedAt:   schema.payments.submittedAt,
      createdAt:     schema.payments.createdAt,
      invoiceNumber: schema.invoices.invoiceNumber,
      total:         schema.invoices.total,
      uniqueCode:    schema.invoices.uniqueCode,
      customerName:  schema.invoices.customerName,
    })
    .from(schema.payments)
    .innerJoin(schema.invoices, eq(schema.invoices.id, schema.payments.sourceId))
    .where(and(
      eq(schema.payments.status, "submitted"),
      eq(schema.payments.sourceType, "invoice"),
    ))
    .orderBy(asc(schema.payments.submittedAt))
    .limit(200);
  if (pending.length === 0) return 0; // tidak mengirim pesan kosong

  const recipients = await resolvePjRecipients(tenantDb, targets);
  if (recipients.length === 0) return 0;

  // Rotasi bergantian; lewati yang tidak punya nomor HP (kata sandi tautan = 4 digit HP-nya).
  let recipient: PjRecipient | null = null;
  for (let i = 0; i < recipients.length; i++) {
    const cand = recipients[(rotationIndex + i) % recipients.length];
    if (cand.phone && lastFourDigits(cand.phone).length === 4) { recipient = cand; break; }
  }
  if (!recipient) {
    console.warn(`[pj-digest] ${slug}: tidak ada PJ keuangan dengan nomor HP — tautan verifikasi tidak dibuat.`);
    return 0;
  }

  const { token, hash } = newPjToken();
  await db.insert(pjVerificationLinks).values({
    tenantId,
    tokenHash:      hash,
    module:         "keuangan",
    recipientName:  recipient.name,
    recipientPhone: recipient.phone!,
    recipientUserId: recipient.userId,
    paymentIds:     pending.map((p) => p.paymentId),
    expiresAt:      new Date(Date.now() + PJ_LINK_TTL_HOURS * 3_600_000),
  });

  const orgName = await resolveOrgName(tenantDb, slug);
  const url     = await waAppUrl(slug, `/verifikasi/${token}`);

  const MAX_LISTED = 8;
  const lines = pending.slice(0, MAX_LISTED).map((p, i) => {
    const when     = p.submittedAt ?? p.createdAt;
    const claimed  = parseFloat(String(p.amount));
    const base     = parseFloat(String(p.total));
    const code     = p.uniqueCode ?? 0;
    const sender   = cleanUserText(p.payerName || p.customerName) || "(tanpa nama)";
    const via      = [p.method === "qris" ? "QRIS" : p.method === "cash" ? "Tunai" : "Transfer", cleanUserText(p.payerBank, 20)].filter(Boolean).join(" ");
    return `${i + 1}. *${sender}* — dikirim *Rp ${waRupiah(claimed)}*\n` +
           `   Tagihan Rp ${waRupiah(base)}${code ? ` + kode unik ${code} = Rp ${waRupiah(base + code)}` : ""}\n` +
           `   ${p.invoiceNumber} • ${via} • ${formatInTz(when, tz, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`;
  });
  const more = pending.length > MAX_LISTED ? `\n…dan ${pending.length - MAX_LISTED} lainnya (lihat di tautan).` : "";

  const waText =
    `💰 *Verifikasi Pembayaran — ${orgName}*\n\n` +
    `Assalamu'alaikum ${recipient.name}, ada *${pending.length}* pembayaran yang belum diverifikasi:\n\n` +
    `${lines.join("\n\n")}${more}\n\n` +
    `Cek mutasi rekening/QRIS lalu verifikasi tanpa login lewat tautan ini:\n${url}\n\n` +
    `Kata sandi: *4 digit terakhir nomor HP Anda*. Tautan berlaku ${PJ_LINK_TTL_HOURS} jam.`;

  const via = await deliverToRecipient({
    slug, tenantDb, event: "pj_digest_keuangan", recipient,
    subject: `Verifikasi Pembayaran — ${orgName} (${pending.length} menunggu)`,
    waText,
  });
  return via === "none" ? 0 : 1;
}

// ── Digest KEANGGOTAAN (sekretariat) ────────────────────────────────────────────────

async function sendKeanggotaanDigest(opts: {
  slug: string; tenantId: string; tenantType: string | null; tenantDb: TenantDbHandle;
  targets: PjTarget[]; now: Date;
}): Promise<number> {
  const { slug, tenantId, tenantType, tenantDb, targets, now } = opts;
  const since = new Date(now.getTime() - 24 * 3_600_000);

  const base = and(
    eq(tenantMemberships.tenantId, tenantId),
    eq(tenantMemberships.status, "active"),
    tenantType === "forum" ? eq(tenantMemberships.forumStatus, "active") : undefined,
  );

  // Anggota BARU 24 jam terakhir. Forum: saat disetujui/aktif. Cabang/marhalah: yang mendaftar/
  // ditambahkan sendiri (auto_* dari populate massal platform bukan "pendaftar baru").
  const fresh = await db
    .select({
      name:             members.name,
      memberNumber:     members.memberNumber,
      membershipNumber: tenantMemberships.membershipNumber,
      whatsapp:         contacts.whatsapp,
      phone:            contacts.phone,
    })
    .from(tenantMemberships)
    .innerJoin(members, eq(members.id, tenantMemberships.memberId))
    .leftJoin(contacts, eq(contacts.id, members.contactId))
    .where(and(
      base,
      tenantType === "forum"
        ? gte(tenantMemberships.approvedAt, since)
        : and(
            gte(tenantMemberships.createdAt, since),
            notInArray(tenantMemberships.registeredVia, ["auto_cabang", "auto_marhalah"]),
          ),
    ))
    .orderBy(asc(tenantMemberships.createdAt))
    .limit(50);

  // Forum dengan persetujuan: yang menunggu keputusan pengurus.
  let awaitingApproval = 0;
  if (tenantType === "forum") {
    const cfg = await getSetting<MembershipConfigData>(tenantDb, "membership_config", "forum");
    if (cfg?.requireApproval) {
      const [row] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(tenantMemberships)
        .where(and(eq(tenantMemberships.tenantId, tenantId), eq(tenantMemberships.forumStatus, "pending")));
      awaitingApproval = row?.n ?? 0;
    }
  }

  // Aktif tapi belum tercatat masuk grup WA (hanya bila tautan grup diisi).
  let notInGroup = 0;
  const groupUrl = await getSetting<string>(tenantDb, WHATSAPP_GROUP_SETTING_KEY, "general");
  if (isValidWhatsappGroupUrl(groupUrl)) {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(tenantMemberships)
      .where(and(base, isNull(tenantMemberships.waGroupJoinedAt)));
    notInGroup = row?.n ?? 0;
  }

  if (fresh.length === 0 && awaitingApproval === 0) return 0; // tidak ada kabar baru

  const [recipient] = await resolvePjRecipients(tenantDb, targets);
  if (!recipient) return 0;

  const orgName = await resolveOrgName(tenantDb, slug);
  const appBase = (process.env.NEXT_PUBLIC_APP_URL ?? "https://jalakarta.com").replace(/\/$/, "");
  const dashboardUrl = `${appBase}/app/${slug}/members`;
  const parts: string[] = [];
  if (fresh.length > 0) {
    const shown = fresh.slice(0, 10).map((m, i) => {
      const nums = [m.membershipNumber && `No. ${m.membershipNumber}`, m.memberNumber && `IKPM ${m.memberNumber}`]
        .filter(Boolean).join(" • ");
      const hp = displayPhone(m.whatsapp || m.phone);
      return `${i + 1}. *${m.name}*${hp ? ` — ${hp}` : ""}${nums ? `\n   ${nums}` : ""}`;
    });
    parts.push(`*Anggota baru (${fresh.length}):*\n${shown.join("\n")}${fresh.length > 10 ? `\n…dan ${fresh.length - 10} lainnya.` : ""}\nMohon di-follow up untuk langkah selanjutnya.`);
  }
  if (awaitingApproval > 0) {
    parts.push(`*Menunggu persetujuan Anda:* ${awaitingApproval} pendaftar — buka menu Anggota untuk menyetujui.`);
  }
  if (notInGroup > 0) {
    parts.push(`*Belum tercatat masuk grup WhatsApp:* ${notInGroup} anggota aktif.`);
  }

  const waText =
    `📋 *Ringkasan Keanggotaan — ${orgName}*\n\n` +
    `Assalamu'alaikum ${recipient.name},\n\n${parts.join("\n\n")}\n\n` +
    `Dashboard: ${dashboardUrl}`;

  const via = await deliverToRecipient({
    slug, tenantDb, event: "pj_digest_keanggotaan", recipient,
    subject: `Ringkasan Keanggotaan — ${orgName}`,
    waText,
  });
  return via === "none" ? 0 : 1;
}

