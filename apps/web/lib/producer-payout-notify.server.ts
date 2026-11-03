// Notifikasi pencairan produsen — docs/arsitektur-pencairan-produsen.md § 13.4 (D10).
//  - Ke BENDAHARA (PJ modul Keuangan, kanal mengikuti channel_mode tenant: WA bila aktif/cadangan, email); bila PJ belum diatur → semua pengurus
//    ber-izin Keuangan penuh (email).
//  - Ke PRODUSEN: disetujui / ditolak / dibayar (lengkap dengan nominal & tautan bukti).
//  - Pengingat saldo menganggur 30 hari (EMAIL saja, ke email akun login).
// Semua fire-and-forget: TIDAK PERNAH melempar dan tidak boleh menggagalkan aksi uang. Teks pengguna dinetralkan (tanpa URL/format).
import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db as publicDb, createTenantDb, members, contacts, user, getSetting, upsertSetting, computeEligible, getPayoutSettings, tenants } from "@jalajogja/db";
import { PJ_CONFIG_KEY, type OfficerNotificationConfig } from "@/lib/pj-config";
import { resolvePjRecipients, deliverToRecipient, type PjRecipient } from "@/lib/pj-notification.server";
import { sendMailForTenant } from "@/lib/mail-dispatch.server";
import { resolveOrgName } from "@/lib/wa-notify";
import { hasFullAccess } from "@/lib/permissions";
import { normalizePhone } from "@/lib/phone";

type Tc = ReturnType<typeof createTenantDb>;
const APP_URL = () => (process.env.NEXT_PUBLIC_APP_URL ?? "https://jalakarta.com").replace(/\/$/, "");
export const rp = (n: number | string) => `Rp${Math.round(Number(n)).toLocaleString("id-ID")}`;
const oneLine = (s: string) => s.replace(/[\r\n\t]+/g, " ").trim().slice(0, 150);
const safeText = (s: string | null | undefined, max = 60) => (s ?? "").replace(/https?:\/\/\S+/gi, "").replace(/[*_~`<>]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const asHtml = (text: string) => `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;white-space:pre-wrap">${esc(text.replace(/\*/g, "")).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>')}</div>`;

// ── Teks (MURNI, bisa diuji) ──────────────────────────────────────────────────────────────────────────────────
export type PayoutNoticeInput = { org: string; producerName: string; number: string; subtotal: number; url: string };
export const textRequested = (i: PayoutNoticeInput & { bank: string; last4: string; holder: string }) =>
  `*Pengajuan pencairan produsen* — ${i.org}\n\n${safeText(i.producerName)} mengajukan pencairan *${rp(i.subtotal)}* (${i.number}).\nRekening: ${safeText(i.bank, 30)} ••••${i.last4.replace(/\D/g, "").slice(-4)} a.n. ${safeText(i.holder)}\n\nTinjau & proses: ${i.url}`;
export const textBankChanged = (i: { org: string; producerName: string; bank: string; last4: string; effective: string; url: string }) =>
  `*Rekening pencairan produsen diganti* — ${i.org}\n\n${safeText(i.producerName)} mengganti rekening pencairan ke ${safeText(i.bank, 30)} ••••${i.last4.replace(/\D/g, "").slice(-4)}. Berlaku mulai ${i.effective}. Jika ini mencurigakan, hubungi produsen yang bersangkutan.\n\n${i.url}`;
export const textApproved = (i: PayoutNoticeInput & { slaDays: number }) =>
  `Halo ${safeText(i.producerName)},\n\nPengajuan pencairan *${i.number}* sebesar *${rp(i.subtotal)}* telah *disetujui* ${i.org}. Dana akan ditransfer paling lambat ${i.slaDays} hari kerja. Biaya transfer dipotong dari pencairan.\n\nLihat rincian: ${i.url}`;
export const textRejected = (i: PayoutNoticeInput & { reason: string }) =>
  `Halo ${safeText(i.producerName)},\n\nPengajuan pencairan *${i.number}* (${rp(i.subtotal)}) belum dapat diproses oleh ${i.org}.\nAlasan: ${safeText(i.reason, 300)}\n\nSaldo Anda tetap utuh dan bisa diajukan kembali: ${i.url}`;
export const textPaid = (i: PayoutNoticeInput & { fee: number; net: number; bank: string; last4: string }) =>
  `Halo ${safeText(i.producerName)},\n\nPencairan *${i.number}* sudah *ditransfer* oleh ${i.org}.\nJumlah pencairan: ${rp(i.subtotal)}\nBiaya transfer: ${rp(i.fee)}\n*Diterima: ${rp(i.net)}*\nKe: ${safeText(i.bank, 30)} ••••${i.last4.replace(/\D/g, "").slice(-4)}\n\nBukti transfer & rincian: ${i.url}`;
export const textReminder = (i: { org: string; name: string; amount: number; count: number; url: string }) =>
  `Halo ${safeText(i.name)},\n\nSaat ini ada ${rp(i.amount)} dari ${i.count} pengiriman yang sudah selesai dan siap Anda cairkan. Dana ini hak Anda dan tersimpan di ${i.org}.\n\nSilakan ajukan pencairan lewat Portal Produsen → Pencairan: ${i.url}\nPengajuan diproses paling lambat beberapa hari kerja.`;

// ── Pengiriman ──────────────────────────────────────────────────────────────────────────────────────────────────
async function deliver(slug: string, tc: Tc, recipient: PjRecipient, subject: string, text: string) {
  return deliverToRecipient({ slug, tenantDb: tc, event: "payment_confirmed", recipient, subject: oneLine(subject), waText: text });
}

/** Ke bendahara: PJ keuangan (+ cadangan) bila diatur & terjangkau; kalau tidak, semua pengurus ber-izin Keuangan penuh lewat email. */
export async function notifyTreasurers(slug: string, tc: Tc, subject: string, text: string): Promise<void> {
  try {
    const cfg = await getSetting<OfficerNotificationConfig>(tc, PJ_CONFIG_KEY, "notif").catch(() => null);
    const k = cfg?.keuangan;
    const targets = k?.enabled ? [...(k.targets ?? []), ...(k.backup ? [k.backup] : [])] : [];
    let reached = 0;
    if (targets.length) {
      for (const r of (await resolvePjRecipients(tc, targets)).slice(0, 5)) {
        if ((await deliver(slug, tc, r, subject, text)) !== "none") reached++;
      }
    }
    if (reached > 0) return;

    const { db: tdb, schema } = tc;
    const users = await tdb.select({ role: schema.users.role, authId: schema.users.betterAuthUserId, permissions: schema.customRoles.permissions })
      .from(schema.users).leftJoin(schema.customRoles, eq(schema.customRoles.id, schema.users.customRoleId));
    const approvers = users.filter((u) => hasFullAccess({ role: u.role, customRole: u.permissions ? { permissions: u.permissions } : null }, "keuangan")).slice(0, 10);
    if (!approvers.length) return;
    const rows = await publicDb.select({ email: user.email }).from(user).where(inArray(user.id, approvers.map((a) => a.authId)));
    for (const to of new Set(rows.map((r) => r.email).filter((e): e is string => !!e))) {
      const res = await sendMailForTenant(tc, { to, subject: oneLine(subject), html: asHtml(text) });
      if (!res.ok) console.error("[producer-payout-notify] email bendahara gagal:", res.error);
    }
  } catch (e) { console.error("[producer-payout-notify] bendahara:", e instanceof Error ? e.message : "unknown"); }
}

async function producerRecipient(tc: Tc, producerId: string): Promise<{ recipient: PjRecipient; loginEmail: string | null } | null> {
  const [p] = await tc.db.select({ memberId: tc.schema.producers.memberId }).from(tc.schema.producers).where(eq(tc.schema.producers.id, producerId)).limit(1);
  if (!p?.memberId) return null;
  const [row] = await publicDb.select({ name: members.name, wa: contacts.whatsapp, phone: contacts.phone, cEmail: contacts.email, loginEmail: user.email })
    .from(members).leftJoin(contacts, eq(contacts.id, members.contactId)).leftJoin(user, eq(user.id, members.betterAuthUserId)).where(eq(members.id, p.memberId)).limit(1);
  if (!row) return null;
  return { recipient: { name: row.name, phone: normalizePhone(row.wa || row.phone), email: row.loginEmail || row.cEmail || null, userId: null }, loginEmail: row.loginEmail ?? null };
}

/** Ke produsen (WA bila aktif, jika tidak email — mengikuti channel_mode tenant). */
export async function notifyProducer(slug: string, tc: Tc, producerId: string, subject: string, text: string): Promise<void> {
  try {
    const r = await producerRecipient(tc, producerId);
    if (!r) return;
    await deliver(slug, tc, r.recipient, subject, text);
  } catch (e) { console.error("[producer-payout-notify] produsen:", e instanceof Error ? e.message : "unknown"); }
}

export const payoutPortalUrl = (slug: string, id: string) => `${APP_URL()}/app/${slug}/portal-produsen/pencairan/${id}`;
export const payoutAdminUrl  = (slug: string, id: string) => `${APP_URL()}/app/${slug}/toko/pencairan/${id}`;

export async function notifyPayoutRequested(slug: string, tc: Tc, p: { id: string; number: string; subtotal: number; producerName: string; bank: string; last4: string; holder: string }) {
  const org = await resolveOrgName(tc, slug);
  await notifyTreasurers(slug, tc, `Pengajuan pencairan produsen ${p.number} — ${org}`, textRequested({ org, producerName: p.producerName, number: p.number, subtotal: p.subtotal, url: payoutAdminUrl(slug, p.id), bank: p.bank, last4: p.last4, holder: p.holder }));
}

export async function notifyBankChanged(slug: string, tc: Tc, p: { producerName: string; bank: string; last4: string; effectiveAt: Date; immediate: boolean }) {
  const org = await resolveOrgName(tc, slug);
  const effective = p.immediate ? "sekarang" : new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(p.effectiveAt) + " WIB";
  await notifyTreasurers(slug, tc, `Rekening pencairan produsen diganti — ${org}`, textBankChanged({ org, producerName: p.producerName, bank: p.bank, last4: p.last4, effective, url: `${APP_URL()}/app/${slug}/toko/pencairan` }));
}

/** Ke PEMILIK rekening sendiri: pengingat keamanan bahwa rekening pencairan diganti. */
export async function notifyProducerBankChanged(slug: string, tc: Tc, producerId: string, p: { bank: string; last4: string; effectiveAt: Date; immediate: boolean }) {
  const org = await resolveOrgName(tc, slug);
  const when = p.immediate ? "sekarang" : new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(p.effectiveAt) + " WIB";
  await notifyProducer(slug, tc, producerId, `Rekening pencairan Anda diganti — ${org}`,
    `Rekening pencairan Anda di ${org} diganti ke ${safeText(p.bank, 30)} ••••${p.last4.replace(/\D/g, "").slice(-4)} (berlaku ${when}).\n\nJika ini BUKAN Anda, segera hubungi pengurus dan ganti kata sandi akun Anda: ${APP_URL()}/app/${slug}/portal-produsen/pencairan`);
}

export async function notifyPayoutDecision(slug: string, tc: Tc, kind: "approved" | "rejected" | "paid", p: {
  id: string; number: string; subtotal: number; producerId: string; producerName: string; slaDays?: number; reason?: string; fee?: number; net?: number; bank?: string; last4?: string;
}) {
  const org = await resolveOrgName(tc, slug);
  const base = { org, producerName: p.producerName, number: p.number, subtotal: p.subtotal, url: payoutPortalUrl(slug, p.id) };
  if (kind === "approved") return notifyProducer(slug, tc, p.producerId, `Pencairan ${p.number} disetujui — ${org}`, textApproved({ ...base, slaDays: p.slaDays ?? 3 }));
  if (kind === "rejected") return notifyProducer(slug, tc, p.producerId, `Pencairan ${p.number} belum dapat diproses — ${org}`, textRejected({ ...base, reason: p.reason ?? "" }));
  return notifyProducer(slug, tc, p.producerId, `Pencairan ${p.number} sudah ditransfer — ${org}`, textPaid({ ...base, fee: p.fee ?? 0, net: p.net ?? p.subtotal, bank: p.bank ?? "", last4: p.last4 ?? "" }));
}

// ── Pengingat saldo menganggur (cron harian) ─────────────────────────────────────────────────────────────────
const REMIND_DAYS = 30;
const REMIND_KEY = "producer_balance_reminders";

export async function runProducerBalanceReminders(now: Date = new Date()): Promise<{ sent: number; tenantsFailed: string[] }> {
  let sent = 0; const tenantsFailed: string[] = [];
  const active = await publicDb.select({ slug: tenants.slug }).from(tenants).where(eq(tenants.isActive, true));
  const cutoff = now.getTime() - REMIND_DAYS * 86_400_000;
  for (const t of active) {
    try {
      const tc = createTenantDb(t.slug); const { db, schema: s } = tc;
      const settings = await getPayoutSettings(tc);
      const state = ((await getSetting<Record<string, string>>(tc, REMIND_KEY, "notif").catch(() => null)) ?? {}) as Record<string, string>;
      const producers = await db.select({ id: s.producers.id, memberId: s.producers.memberId }).from(s.producers).where(and(eq(s.producers.isActive, true)));
      let changed = false; let org: string | null = null;
      for (const p of producers) {
        if (!p.memberId) continue;
        if (state[p.id] && new Date(state[p.id]).getTime() > cutoff) continue;
        const [lastReq] = await db.select({ at: s.producerPayouts.requestedAt }).from(s.producerPayouts).where(eq(s.producerPayouts.producerId, p.id)).orderBy(desc(s.producerPayouts.requestedAt)).limit(1);
        if (lastReq && lastReq.at.getTime() > cutoff) continue;
        const el = await computeEligible(tc, p.id);
        if (el.subtotal < settings.minAmount || el.creditsTotal <= 0) continue;
        const rec = await producerRecipient(tc, p.id);
        if (!rec?.loginEmail) continue;                                  // email saja, ke alamat akun login yang tepercaya
        org ??= await resolveOrgName(tc, t.slug);
        const text = textReminder({ org, name: rec.recipient.name, amount: el.subtotal, count: el.lines.filter((l) => l.shippingLineId).length, url: `${APP_URL()}/app/${t.slug}/portal-produsen/pencairan` });
        const res = await sendMailForTenant(tc, { to: rec.loginEmail, subject: oneLine(`Saldo Anda di ${org} siap dicairkan — ${rp(el.subtotal)}`), html: asHtml(text) });
        if (res.ok) { state[p.id] = now.toISOString(); changed = true; sent++; }
      }
      if (changed) await upsertSetting(tc, REMIND_KEY, "notif", state);
    } catch (e) { tenantsFailed.push(t.slug); console.error("[producer-balance-reminder]", t.slug, e instanceof Error ? e.message : "unknown"); }
  }
  return { sent, tenantsFailed };
}
