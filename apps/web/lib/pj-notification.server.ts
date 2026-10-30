import "server-only";
import { createHash, randomBytes } from "crypto";
import { and, asc, eq, gte, inArray, isNull, notInArray, sql } from "drizzle-orm";
import {
  db, tenants, tenantMemberships, members, contacts, pjVerificationLinks,
  createTenantDb, getSetting, upsertSetting,
} from "@jalajogja/db";
import { sendWaNotification, type WaNotifKey } from "@/lib/whatsapp";
import { resolveOrgName, waAppUrl, waRupiah, resolveChannelMode } from "@/lib/wa-notify";
import { sendMailForTenant } from "@/lib/mail-dispatch.server";
import { getTenantTimezone, formatInTz, todayInTz } from "@/lib/tenant-timezone.server";
import { normalizePhone, displayPhone } from "@/lib/phone";
import {
  PJ_CONFIG_KEY, type OfficerNotificationConfig, type PjTarget, type PjModule,
} from "@/lib/pj-config";
import { isValidWhatsappGroupUrl, WHATSAPP_GROUP_SETTING_KEY } from "@/lib/whatsapp-group";
import { renderTemplateString } from "@/lib/wa-templates";
import {
  PJ_DIGEST_TEMPLATE_DEFAULTS, PJ_DIGEST_TEMPLATE_SETTING_KEY, type PjDigestTemplateKey,
} from "@/lib/pj-digest-templates";
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
const DAILY_MODULES       = ["keanggotaan", "toko", "donasi", "event"] as const;

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

// Kerangka teks: override tenant (settings) bila ada & tidak kosong, kalau tidak default kode.
async function renderPjTemplate(
  tenantDb: TenantDbHandle, key: PjDigestTemplateKey, vars: Record<string, string>,
): Promise<string> {
  let tpl = PJ_DIGEST_TEMPLATE_DEFAULTS[key];
  try {
    const custom = await getSetting<Record<string, string>>(tenantDb, PJ_DIGEST_TEMPLATE_SETTING_KEY, "notif");
    const t = custom?.[key];
    if (typeof t === "string" && t.trim()) tpl = t;
  } catch { /* pakai default */ }
  return renderTemplateString(tpl, vars);
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

  // Urutan kanal mengikuti channel_mode tenant (docs/arsitektur-notifikasi-email.md § 3.3):
  // email_first (default)/email_only → email dulu, WA hanya cadangan (tidak untuk email_only);
  // both → keduanya; wa_only → perilaku lama (WA dulu, email cadangan).
  const mode = await resolveChannelMode(tenantDb);
  const trySendWa = async () => {
    if (!recipient.phone) return false;
    const res = await sendWaNotification({ slug, event, to: recipient.phone, message: waText, skipEventToggle: true });
    return res.ok;
  };
  const html = `<div style="font-family:sans-serif;white-space:pre-wrap">${escapeHtml(waText.replace(/\*/g, ""))
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>')}</div>`;
  const trySendEmail = async () =>
    !!recipient.email && (await sendMailForTenant(tenantDb, { to: recipient.email, subject, html })).ok;

  if (mode === "wa_only") {
    if (await trySendWa()) return "wa";
    return (await trySendEmail()) ? "email" : "none";
  }
  if (mode === "both") {
    const [w, e] = [await trySendWa(), await trySendEmail()];
    return e ? "email" : w ? "wa" : "none";
  }
  if (await trySendEmail()) return "email";
  if (mode === "email_only") return "none";
  return (await trySendWa()) ? "wa" : "none";
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
export async function runPjDigests(now = new Date()): Promise<Record<PjModule, number>> {
  const activeTenants = await db
    .select({ id: tenants.id, slug: tenants.slug, tenantType: tenants.tenantType })
    .from(tenants)
    .where(eq(tenants.isActive, true));

  const sent: Record<PjModule, number> = { keuangan: 0, keanggotaan: 0, toko: 0, donasi: 0, event: 0 };

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
            slug: t.slug, tenantId: t.id, tenantDb, tz, targets: keu.targets, backup: keu.backup, now,
            rotationIndex: dayOfYear(localDate) * KEUANGAN_SLOT_HOURS.length + slotIdx,
            isEscalationSlot: hour === DAILY_DIGEST_HOUR,
          });
        }
      }

      // Ringkasan harian (16.00 lokal): satu PJ per modul, tidak pernah pesan kosong.
      if (hour === DAILY_DIGEST_HOUR) {
        const stamp = `${localDate}T${hour}`;
        for (const mod of DAILY_MODULES) {
          const mc = config[mod];
          if (!mc?.enabled || mc.targets.length === 0 || state[mod] === stamp) continue;
          state[mod] = stamp;
          await upsertSetting(tenantDb, STATE_KEY, "notif", state); // tandai SEBELUM kirim
          try {
            sent[mod] += mod === "keanggotaan"
              ? await sendKeanggotaanDigest({
                  slug: t.slug, tenantId: t.id, tenantType: t.tenantType, tenantDb, targets: mc.targets, now,
                })
              : await sendActivityDigest({ slug: t.slug, tenantDb, tz, module: mod, targets: mc.targets, now });
          } catch (err) {
            console.error(`[runPjDigests] ${t.slug}/${mod} gagal:`, err);
          }
        }
      }
    } catch (err) {
      console.error(`[runPjDigests] tenant ${t.slug} gagal:`, err);
    }
  }
  return sent;
}

// ── Digest KEUANGAN ──────────────────────────────────────────────────────────────────

type PendingPayment = {
  paymentId: string; amount: string; method: string; payerName: string | null; payerBank: string | null;
  submittedAt: Date | null; createdAt: Date; invoiceNumber: string; total: string; uniqueCode: number | null;
  customerName: string;
};

const ESCALATION_HOURS = 48;

// Buat tautan verifikasi + kirim satu pesan keuangan ke satu penerima (WA→email). 1 = terkirim.
async function dispatchKeuangan(opts: {
  slug: string; tenantId: string; tenantDb: TenantDbHandle; tz: string;
  recipient: PjRecipient; pending: PendingPayment[]; templateKey: "keuangan" | "keuangan_backup"; reason?: string;
}): Promise<number> {
  const { slug, tenantId, tenantDb, tz, recipient, pending, templateKey, reason } = opts;

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

  const waText = await renderPjTemplate(tenantDb, templateKey, {
    orgName, name: cleanUserText(recipient.name, 60), count: String(pending.length),
    list: lines.join("\n\n"), more, url, ttlHours: String(PJ_LINK_TTL_HOURS), reason: reason ?? "",
  });

  const via = await deliverToRecipient({
    slug, tenantDb, event: "pj_digest_keuangan", recipient,
    subject: `${templateKey === "keuangan_backup" ? "Cadangan — " : ""}Verifikasi Pembayaran — ${orgName} (${pending.length} menunggu)`,
    waText,
  });
  return via === "none" ? 0 : 1;
}

async function sendKeuanganDigest(opts: {
  slug: string; tenantId: string; tenantDb: TenantDbHandle; tz: string;
  targets: PjTarget[]; backup: PjTarget | null | undefined; rotationIndex: number; isEscalationSlot: boolean; now: Date;
}): Promise<number> {
  const { slug, tenantId, tenantDb, tz, targets, backup, rotationIndex, isEscalationSlot, now } = opts;
  const { db: tdb, schema } = tenantDb;

  // SEMUA yang masih belum diverifikasi — bukan hanya yang baru (pengingat otomatis).
  const pending: PendingPayment[] = await tdb
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

  const hasPhone = (r: PjRecipient) => !!r.phone && lastFourDigits(r.phone).length === 4;
  const recipients = await resolvePjRecipients(tenantDb, targets);

  // Rotasi bergantian; lewati yang tidak punya nomor HP (kata sandi tautan = 4 digit HP-nya).
  let recipient: PjRecipient | null = null;
  for (let i = 0; i < recipients.length; i++) {
    const cand = recipients[(rotationIndex + i) % recipients.length];
    if (hasPhone(cand)) { recipient = cand; break; }
  }

  let sent = 0;
  if (recipient) {
    sent += await dispatchKeuangan({ slug, tenantId, tenantDb, tz, recipient, pending, templateKey: "keuangan" });
  } else {
    console.warn(`[pj-digest] ${slug}: tidak ada PJ keuangan utama yang bisa dihubungi.`);
  }

  // Cadangan (docs § 8.4): (a) tak ada PJ utama yang bisa dihubungi → kirim SEMUA; (b) slot 16.00 →
  // yang menunggu > 48 jam.
  if (backup) {
    const cutoff = now.getTime() - ESCALATION_HOURS * 3_600_000;
    const stale  = pending.filter((p) => (p.submittedAt ?? p.createdAt).getTime() < cutoff);
    const list   = !recipient ? pending : (isEscalationSlot ? stale : []);
    if (list.length > 0) {
      const [bk] = await resolvePjRecipients(tenantDb, [backup]);
      if (bk && hasPhone(bk) && !recipients.some((r) => r.phone && r.phone === bk.phone)) {
        sent += await dispatchKeuangan({
          slug, tenantId, tenantDb, tz, recipient: bk, pending: list, templateKey: "keuangan_backup",
          reason: !recipient
            ? "Penanggung jawab utama belum dapat dihubungi, sehingga seluruh pembayaran yang menunggu dikirim kepada Anda."
            : `Ada ${list.length} pembayaran yang belum diverifikasi lebih dari ${ESCALATION_HOURS} jam.`,
        });
      }
    }
  }
  return sent;
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

  const waText = await renderPjTemplate(tenantDb, "keanggotaan", {
    orgName, name: cleanUserText(recipient.name, 60), ringkasan: parts.join("\n\n"), dashboardUrl,
  });

  const via = await deliverToRecipient({
    slug, tenantDb, event: "pj_digest_keanggotaan", recipient,
    subject: `Ringkasan Keanggotaan — ${orgName}`,
    waText,
  });
  return via === "none" ? 0 : 1;
}



// ── Digest TOKO / DONASI / EVENT ─────────────────────────────────────────────────────────
// Informasi saja (tanpa tautan verifikasi) + tautan ke dashboard. Lihat docs § 8.3.

async function sendActivityDigest(opts: {
  slug: string; tenantDb: TenantDbHandle; tz: string;
  module: "toko" | "donasi" | "event"; targets: PjTarget[]; now: Date;
}): Promise<number> {
  const { slug, tenantDb, tz, module: mod, targets, now } = opts;
  const { db: tdb, schema } = tenantDb;
  const since = new Date(now.getTime() - 24 * 3_600_000);
  const MAX = 10;
  const when = (d: Date) => formatInTz(d, tz, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  let title = "";
  let body  = "";
  let path  = "";

  if (mod === "toko") {
    title = "Pesanan Toko"; path = "toko/pesanan";
    // Semua pesanan lunas yang belum diproses (bukan hanya yang baru) — pengingat otomatis.
    const lines = await tdb
      .select({
        invoiceId:    schema.invoiceShippingLines.invoiceId,
        courier:      schema.invoiceShippingLines.courier,
        service:      schema.invoiceShippingLines.service,
        method:       schema.invoiceShippingLines.deliveryMethod,
        cityName:     schema.invoices.shippingCityName,
        invoiceNumber: schema.invoices.invoiceNumber,
        customerName: schema.invoices.customerName,
        createdAt:    schema.invoices.createdAt,
      })
      .from(schema.invoiceShippingLines)
      .innerJoin(schema.invoices, eq(schema.invoices.id, schema.invoiceShippingLines.invoiceId))
      .where(and(
        eq(schema.invoiceShippingLines.sellerType, "tenant"),
        eq(schema.invoiceShippingLines.status, "pending"),
        eq(schema.invoices.status, "paid"),
      ))
      .orderBy(asc(schema.invoices.createdAt))
      .limit(100);
    if (lines.length === 0) return 0;

    const ids = [...new Set(lines.map((l) => l.invoiceId))];
    const items = await tdb
      .select({ invoiceId: schema.invoiceItems.invoiceId, name: schema.invoiceItems.name, qty: schema.invoiceItems.quantity })
      .from(schema.invoiceItems)
      .where(and(inArray(schema.invoiceItems.invoiceId, ids), eq(schema.invoiceItems.itemType, "product")));
    const itemsBy = new Map<string, string[]>();
    for (const it of items) itemsBy.set(it.invoiceId, [...(itemsBy.get(it.invoiceId) ?? []), `${cleanUserText(it.name, 40)} ×${it.qty}`]);

    const rows = lines.slice(0, MAX).map((l, i) => {
      const ship = l.method === "pickup" ? "Ambil sendiri" : [l.courier?.toUpperCase(), l.service].filter(Boolean).join(" ") + (l.cityName ? ` → ${cleanUserText(l.cityName, 30)}` : "");
      return `${i + 1}. *${cleanUserText(l.customerName) || "(tanpa nama)"}* — ${l.invoiceNumber}\n   ${(itemsBy.get(l.invoiceId) ?? ["(tanpa barang)"]).slice(0, 3).join(", ")}\n   ${ship || "-"} • dipesan ${when(l.createdAt)}`;
    });
    body = `Ada *${lines.length}* pesanan yang sudah dibayar dan belum diproses:\n\n${rows.join("\n\n")}${lines.length > MAX ? `\n…dan ${lines.length - MAX} lainnya.` : ""}`;
  }

  if (mod === "donasi") {
    title = "Donasi Masuk"; path = "donasi";
    const allRows = await tdb
      .select({
        itemId:    schema.invoiceItems.id,
        name:      schema.invoices.customerName,
        itemName:  schema.invoiceItems.name,
        desc:      schema.invoiceItems.description,
        total:     schema.invoiceItems.total,
        confirmed: schema.payments.confirmedAt,
      })
      .from(schema.invoiceItems)
      .innerJoin(schema.invoices, eq(schema.invoices.id, schema.invoiceItems.invoiceId))
      .innerJoin(schema.invoicePayments, eq(schema.invoicePayments.invoiceId, schema.invoices.id))
      .innerJoin(schema.payments, eq(schema.payments.id, schema.invoicePayments.paymentId))
      .where(and(
        eq(schema.invoiceItems.itemType, "donation"),
        eq(schema.invoices.status, "paid"),
        eq(schema.payments.status, "paid"),
        gte(schema.payments.confirmedAt, since),
      ))
      .orderBy(asc(schema.payments.confirmedAt))
      .limit(100);
    // Satu item bisa ikut >1 payment lunas dalam jendela waktu (JOIN) — hitung sekali per item.
    const seen = new Set<string>();
    const rows = allRows.filter((r) => (seen.has(r.itemId) ? false : (seen.add(r.itemId), true)));
    if (rows.length === 0) return 0;

    const total = rows.reduce((s, r) => s + parseFloat(String(r.total)), 0);
    const list = rows.slice(0, MAX).map((r, i) => {
      const donor = (r.desc ?? "").trim().toLowerCase() === "anonim" ? "Anonim" : (cleanUserText(r.name) || "(tanpa nama)");
      return `${i + 1}. *${donor}* — Rp ${waRupiah(parseFloat(String(r.total)))}\n   ${cleanUserText(r.itemName, 60)}${r.confirmed ? ` • ${when(r.confirmed)}` : ""}`;
    });
    body = `Donasi yang dikonfirmasi 24 jam terakhir: *${rows.length}* donasi, total *Rp ${waRupiah(total)}*.\n\n${list.join("\n")}${rows.length > MAX ? `\n…dan ${rows.length - MAX} lainnya.` : ""}`;
  }

  if (mod === "event") {
    title = "Pendaftar Event"; path = "event/acara";
    const rows = await tdb
      .select({
        name:    schema.eventRegistrations.attendeeName,
        phone:   schema.eventRegistrations.attendeePhone,
        at:      schema.eventRegistrations.createdAt,
        event:   schema.events.title,
      })
      .from(schema.eventRegistrations)
      .leftJoin(schema.events, eq(schema.events.id, schema.eventRegistrations.eventId))
      .where(and(
        gte(schema.eventRegistrations.createdAt, since),
        // pending = tiket berbayar yang belum lunas — bukan pendaftar sungguhan.
        inArray(schema.eventRegistrations.status, ["confirmed", "attended"]),
      ))
      .orderBy(asc(schema.eventRegistrations.createdAt))
      .limit(100);
    if (rows.length === 0) return 0;

    const list = rows.slice(0, MAX).map((r, i) =>
      `${i + 1}. *${cleanUserText(r.name) || "(tanpa nama)"}*${r.phone ? ` — ${displayPhone(r.phone)}` : ""}\n   ${cleanUserText(r.event, 60) || "-"} • ${when(r.at)}`);
    body = `Pendaftar event baru 24 jam terakhir: *${rows.length}* orang.\n\n${list.join("\n")}${rows.length > MAX ? `\n…dan ${rows.length - MAX} lainnya.` : ""}`;
  }

  const [recipient] = await resolvePjRecipients(tenantDb, targets);
  if (!recipient) return 0;

  const orgName = await resolveOrgName(tenantDb, slug);
  const appBase = (process.env.NEXT_PUBLIC_APP_URL ?? "https://jalakarta.com").replace(/\/$/, "");
  const waText = await renderPjTemplate(tenantDb, mod, {
    orgName, name: cleanUserText(recipient.name, 60), ringkasan: body, dashboardUrl: `${appBase}/app/${slug}/${path}`,
  });

  const via = await deliverToRecipient({
    slug, tenantDb, event: `pj_digest_${mod}` as WaNotifKey, recipient,
    subject: `${title} — ${orgName}`, waText,
  });
  return via === "none" ? 0 : 1;
}
