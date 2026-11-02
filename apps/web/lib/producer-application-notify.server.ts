// Email keputusan Pengajuan Produsen (K16: email saja) — docs/arsitektur-pengajuan-produsen.md § 12.
//  - Alamat tujuan = email AKUN LOGIN pemohon (public."user".email via members.better_auth_user_id) — dibaca dari DB, bukan dari form/klien.
//  - Dikirim lewat sendMailForTenant (SMTP tenant → fallback SMTP platform; nama pengirim = nama tenant).
//  - Fire-and-forget: TIDAK PERNAH melempar dan tidak boleh menggagalkan/menunda keputusan. Kegagalan hanya dicatat (tanpa alamat/isi).
//  - Semua teks dari pengguna (nama, brand, alasan) di-escape HTML.
import "server-only";
import { eq } from "drizzle-orm";
import { db as publicDb, createTenantDb, members, user } from "@jalajogja/db";
import { sendMailForTenant } from "@/lib/mail-dispatch.server";
import { resolveOrgName, waAppUrl } from "@/lib/wa-notify";

type TenantDb = ReturnType<typeof createTenantDb>;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// Subjek = header email: buang CR/LF (cegah penyisipan header) dan batasi panjang
const oneLine = (s: string) => s.replace(/[\r\n\t]+/g, " ").trim().slice(0, 150);
const multiline = (s: string) => esc(s).replace(/\n/g, "<br>");
const APP_URL = () => (process.env.NEXT_PUBLIC_APP_URL ?? "https://jalakarta.com").replace(/\/$/, "");

export type DecisionNotice =
  | { kind: "approved"; sharePercent: string }
  | { kind: "rejected"; reason: string };

/** Pembentuk isi email — MURNI (tanpa DB/jaringan) supaya bisa diuji. Semua teks pengguna di-escape. */
export function buildDecisionEmail(input: {
  org: string; name: string; brand: string; portalUrl: string; reapplyUrl: string;
} & DecisionNotice): { subject: string; html: string } {
  const name = esc(input.name), brand = esc(input.brand), orgE = esc(input.org);
  if (input.kind === "approved") {
    return {
      subject: oneLine(`Pengajuan produsen Anda disetujui — ${input.org}`),
      html: `<p>Halo ${name},</p>
<p>Kabar baik! Pengajuan Anda menjadi produsen di <strong>${orgE}</strong> untuk brand <strong>${brand}</strong> telah <strong>disetujui</strong>.</p>
<p>Bagi hasil yang disepakati: <strong>${esc(String(Number(input.sharePercent)))}%</strong> dari harga jual untuk tenant.</p>
<p>Langkah berikutnya:</p>
<ol>
<li>Masuk ke Portal Produsen: <a href="${esc(input.portalUrl)}">${esc(input.portalUrl)}</a> (gunakan akun yang sama dengan akun anggota Anda).</li>
<li>Bila tenant telah menerbitkan Syarat &amp; Ketentuan Produsen, baca dan tandatangani secara digital — portal terbuka penuh setelah itu.</li>
<li>Lengkapi Profil dan alamat gudang pengiriman Anda.</li>
</ol>
<p>Untuk saat ini pendaftaran produk Anda dilakukan oleh pengurus; kami akan menghubungi Anda.</p>
<p>Terima kasih,<br>${orgE}</p>`,
    };
  }
  return {
    subject: oneLine(`Pengajuan produsen Anda belum dapat disetujui — ${input.org}`),
    html: `<p>Halo ${name},</p>
<p>Terima kasih telah mengajukan diri menjadi produsen di <strong>${orgE}</strong> (brand <strong>${brand}</strong>). Mohon maaf, pengajuan Anda <strong>belum dapat disetujui</strong>.</p>
<p><strong>Alasan:</strong><br>${multiline(input.reason)}</p>
<p>Anda dapat mengajukan kembali dengan formulir baru bila sudah memperbaiki hal di atas: <a href="${esc(input.reapplyUrl)}">${esc(input.reapplyUrl)}</a></p>
<p>Terima kasih,<br>${orgE}</p>`,
  };
}

export async function notifyApplicationDecision(opts: {
  slug: string; tenantClient: TenantDb; memberId: string; brand: string;
} & DecisionNotice): Promise<void> {
  try {
    const [row] = await publicDb.select({ name: members.name, email: user.email }).from(members)
      .innerJoin(user, eq(user.id, members.betterAuthUserId)).where(eq(members.id, opts.memberId)).limit(1);
    if (!row?.email) return;                                     // tanpa akun login = tidak ada alamat tepercaya

    const org = await resolveOrgName(opts.tenantClient, opts.slug);
    const { subject, html } = buildDecisionEmail({
      ...opts, org, name: row.name,
      portalUrl: `${APP_URL()}/app/${opts.slug}/portal-produsen`,
      reapplyUrl: await waAppUrl(opts.slug, "/akun/produsen"),
    });
    const res = await sendMailForTenant(opts.tenantClient, { to: row.email, subject, html });
    if (!res.ok) console.error("[producer-application-notify] gagal kirim email keputusan:", res.error);
  } catch (e) {
    console.error("[producer-application-notify]", e instanceof Error ? e.message : "unknown");
  }
}
