import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import {
  db, tenants, tenantMemberships, members, contacts, createTenantDb, getSetting,
} from "@jalajogja/db";
import { sendWaNotification } from "@/lib/whatsapp";
import { renderTemplateString } from "@/lib/wa-templates";
import { resolveWaTemplateText, resolveOrgName, waAppUrl } from "@/lib/wa-notify";
import { sendTenantMail, sendPlatformMail, isPlatformMailConfigured, type TenantSmtpConfig } from "@/lib/mail";

// Notifikasi ke ANGGOTA saat keanggotaannya di sebuah tenant menjadi aktif: nomor anggota + arahan
// ke /akun. WA bila terkirim, kalau tidak → email (SMTP tenant, fallback SMTP platform). Lihat
// docs/arsitektur-gabung-forum.md § 9c.
//
// Idempoten dan AT-MOST-ONCE: penanda tenant_memberships.activation_notified_at di-claim lewat
// UPDATE ... WHERE activation_notified_at IS NULL RETURNING — hanya satu pemanggil yang menang,
// meski fungsi ini terpanggil dari banyak titik/bersamaan (aktivasi bayar, join, approve admin,
// kunjungan /akun). Kalau kedua kanal gagal, penanda TIDAK dikembalikan (anggota lama tidak boleh
// tiba-tiba menerima pesan terlambat bila admin baru menyalakan WA/SMTP bulan depan).
//
// Fire-and-forget: tidak pernah throw ke pemanggil — kegagalan notifikasi tidak boleh
// menggagalkan aktivasi. Panggil sebagai `void notifyMembershipActivated(...)`.

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function notifyMembershipActivated(opts: {
  slug:     string;
  memberId: string;
}): Promise<void> {
  try {
    const { slug, memberId } = opts;

    const [tenantRow] = await db
      .select({ id: tenants.id, tenantType: tenants.tenantType })
      .from(tenants)
      .where(eq(tenants.slug, slug))
      .limit(1);
    if (!tenantRow) return;

    // Claim penanda secara atomik. Syarat "aktif" dicek DI SINI (bukan percaya pemanggil):
    // status='active', dan untuk forum juga forum_status='active'.
    const claimed = await db
      .update(tenantMemberships)
      .set({ activationNotifiedAt: new Date() })
      .where(and(
        eq(tenantMemberships.tenantId, tenantRow.id),
        eq(tenantMemberships.memberId, memberId),
        eq(tenantMemberships.status, "active"),
        isNull(tenantMemberships.activationNotifiedAt),
        tenantRow.tenantType === "forum" ? eq(tenantMemberships.forumStatus, "active") : undefined,
      ))
      .returning({ membershipNumber: tenantMemberships.membershipNumber });
    if (claimed.length === 0) return; // sudah pernah diberi tahu / belum aktif

    const [person] = await db
      .select({
        name:         members.name,
        memberNumber: members.memberNumber,
        whatsapp:     contacts.whatsapp,
        phone:        contacts.phone,
        email:        contacts.email,
      })
      .from(members)
      .leftJoin(contacts, eq(contacts.id, members.contactId))
      .where(eq(members.id, memberId))
      .limit(1);
    if (!person) return;

    const tenantDb = createTenantDb(slug);
    const orgName  = await resolveOrgName(tenantDb, slug);
    const akunUrl  = await waAppUrl(slug, "/akun");

    // Hanya baris yang ADA nomornya — jangan tampilkan baris kosong.
    const numberLines: string[] = [];
    const localNumber = claimed[0].membershipNumber;
    if (localNumber)          numberLines.push(`Nomor Anggota ${orgName}: *${localNumber}*`);
    if (person.memberNumber)  numberLines.push(`Nomor Anggota IKPM: *${person.memberNumber}*`);
    const numberInfo = numberLines.length > 0 ? `\n${numberLines.join("\n")}\n` : "";

    const vars = { name: person.name, orgName, numberInfo, akunUrl };

    // ── 1. WhatsApp ───────────────────────────────────────────────────────────────
    const waTarget = person.whatsapp || person.phone;
    if (waTarget) {
      const tpl = await resolveWaTemplateText(tenantDb, "membership_activated");
      if (tpl) {
        const res = await sendWaNotification({
          slug, event: "membership_activated", to: waTarget,
          message: renderTemplateString(tpl, vars),
        });
        if (res.ok) return;
      }
    }

    // ── 2. Email (WA tidak ada / tidak terkirim) ──────────────────────────────────
    if (!person.email) return;
    const subject = `Keanggotaan Aktif — ${orgName}`;
    const html = `<p>Halo ${escapeHtml(person.name)},</p>
      <p>Keanggotaan Anda di <strong>${escapeHtml(orgName)}</strong> sudah <strong>aktif</strong>.</p>
      ${numberLines.length > 0
        ? `<p>${numberLines.map((l) => escapeHtml(l.replace(/\*/g, ""))).join("<br/>")}</p>`
        : ""}
      <p><a href="${escapeHtml(akunUrl)}">Lihat kartu keanggotaan Anda</a></p>
      <p>Wassalamu'alaikum wr. wb.<br/>${escapeHtml(orgName)}</p>`;

    const smtp = await getSetting<TenantSmtpConfig>(tenantDb, "smtp_config", "mail");
    if (smtp) {
      const sent = await sendTenantMail(smtp, { to: person.email, subject, html });
      if (sent.ok) return;
    }
    if (isPlatformMailConfigured()) {
      await sendPlatformMail({ to: person.email, subject, html });
    }
  } catch (err) {
    console.error("[notifyMembershipActivated]", err);
  }
}
