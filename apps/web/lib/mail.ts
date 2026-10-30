import "server-only";
import nodemailer from "nodemailer";
import { createHash } from "crypto";

// lib/mail.ts
// Dua jalur pengiriman email, dua tujuan berbeda:
// - sendPlatformMail(): SMTP platform (env var, satu akun untuk semua tenant) — dipakai
//   untuk hal yang WAJIB selalu jalan terlepas tenant sudah setting SMTP sendiri atau
//   belum (reset password, fallback registrasi). Kredensial di server, tidak pernah
//   tergantung konfigurasi tenant yang bisa kosong/salah.
// - sendTenantMail(): SMTP milik tenant sendiri (tersimpan di settings.smtp_config) —
//   untuk notifikasi bisnis bermerek tenant (anggota baru, pembayaran, dst).

export type SendMailResult = { ok: true } | { ok: false; error: string };

// Cegah header injection: CR/LF tidak boleh ada di to/subject/nama pengirim.
export function stripHeaderChars(s: string): string {
  return s.replace(/[\r\n]+/g, " ").trim();
}

const EMAIL_RE = /^[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]+$/;
export function isValidEmailAddress(s: string): boolean {
  return s.length <= 254 && EMAIL_RE.test(s);
}

// Nama tampilan aman untuk header From: tanpa kutip, kurung sudut, CR/LF.
function safeDisplayName(s: string): string {
  return stripHeaderChars(s).replace(/["<>\\]/g, "").slice(0, 80);
}

// Transport di-pool & di-cache per kredensial: cron pengingat bisa memicu ratusan email sekaligus —
// tanpa pool tiap email membuka koneksi SMTP baru dan penyedia (Gmail dkk.) memblokir akun karena
// lonjakan koneksi. Pool membatasi koneksi paralel + laju kirim; email lebih diantre, bukan dibuang.
type PooledTransport = nodemailer.Transporter<unknown>;
const transportCache = new Map<string, PooledTransport>();
const MAX_CACHED_TRANSPORTS = 50;

function buildTransport(opts: {
  host: string;
  port: number;
  user: string;
  pass: string;
}) {
  const key = `${opts.host}|${opts.port}|${opts.user}|${createHash("sha256").update(opts.pass).digest("hex").slice(0, 16)}`;
  const cached = transportCache.get(key);
  if (cached) return cached;

  if (transportCache.size >= MAX_CACHED_TRANSPORTS) {
    const oldest = transportCache.keys().next().value;
    if (oldest) { transportCache.get(oldest)?.close(); transportCache.delete(oldest); }
  }
  const transport: PooledTransport = nodemailer.createTransport({
    host:   opts.host,
    port:   opts.port,
    secure: opts.port === 465, // 465 = implicit TLS, 587 = STARTTLS (default nodemailer)
    auth:   { user: opts.user, pass: opts.pass },
    pool:           true,
    maxConnections: 3,
    maxMessages:    100,
    rateDelta:      1000,
    rateLimit:      5, // maks 5 email/detik per transport
  });
  transportCache.set(key, transport);
  return transport;
}

// ── Platform-level (env var) — dipakai Better Auth sendResetPassword + fallback publik ──

export function isPlatformMailConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

// Domain pengirim yang SUDAH diverifikasi (SPF/DKIM) di penyedia SMTP platform — env SMTP_VERIFIED_DOMAINS,
// dipisah koma. Alamat From khusus-tenant lewat SMTP platform HANYA boleh memakai domain di daftar ini
// (mencegah pemalsuan pengirim). Ditegakkan di sini (lapisan terbawah), bukan hanya di UI/action.
// docs/arsitektur-notifikasi-email.md § 7 poin 4.
export function getVerifiedSenderDomains(): string[] {
  return (process.env.SMTP_VERIFIED_DOMAINS ?? "")
    .split(",").map((d) => d.trim().toLowerCase()).filter(Boolean);
}

export function isVerifiedSenderAddress(addr: string): boolean {
  const a = addr.trim().toLowerCase();
  if (!isValidEmailAddress(a)) return false;
  return getVerifiedSenderDomains().includes(a.slice(a.lastIndexOf("@") + 1));
}

// Alamat murni dari SMTP_FROM ('"Jalakarta" <no-reply@x>' atau 'no-reply@x'); fallback SMTP_USER.
function platformFromAddress(): string {
  const raw = process.env.SMTP_FROM ?? "";
  const m = raw.match(/<([^>]+)>/);
  const addr = (m ? m[1] : raw).trim();
  return isValidEmailAddress(addr) ? addr : (process.env.SMTP_USER ?? "");
}

export async function sendPlatformMail(opts: {
  to: string;
  subject: string;
  html: string;
  /** Nama tampilan pengirim (mis. nama tenant). Alamat TETAP alamat platform (SPF/DKIM). */
  fromName?: string;
  /** Alamat From khusus tenant (mis. noreply@domain-tenant.or.id) — dipakai HANYA bila domainnya ada di SMTP_VERIFIED_DOMAINS. */
  fromAddress?: string | null;
  /** Alamat balasan (mis. email kontak tenant) — divalidasi, diabaikan bila tidak valid. */
  replyTo?: string | null;
}): Promise<SendMailResult> {
  if (!isPlatformMailConfigured()) {
    return { ok: false, error: "SMTP platform belum dikonfigurasi di server." };
  }

  const host = process.env.SMTP_HOST!;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER!;
  const pass = process.env.SMTP_PASS!;
  const to = stripHeaderChars(opts.to);
  if (!isValidEmailAddress(to)) return { ok: false, error: "Alamat email tujuan tidak valid." };
  const displayName = opts.fromName ? safeDisplayName(opts.fromName) : "";
  const from = displayName
    ? `"${displayName}" <${opts.fromAddress && isVerifiedSenderAddress(opts.fromAddress) ? opts.fromAddress.trim() : platformFromAddress()}>`
    : (process.env.SMTP_FROM ?? `"Jalakarta" <${user}>`);
  const replyTo = opts.replyTo && isValidEmailAddress(opts.replyTo.trim()) ? opts.replyTo.trim() : undefined;

  try {
    const transport = buildTransport({ host, port, user, pass });
    await transport.sendMail({ from, to, replyTo, subject: stripHeaderChars(opts.subject), html: opts.html });
    return { ok: true };
  } catch (err) {
    console.error("[mail] sendPlatformMail gagal:", err);
    return { ok: false, error: "Gagal mengirim email." };
  }
}

// ── Per-tenant (settings.smtp_config) — dipakai notifikasi bisnis + tombol test email ──

export type TenantSmtpConfig = {
  host:      string;
  port:      number;
  user:      string;
  password:  string;
  fromName:  string;
  fromEmail: string;
};

export async function sendTenantMail(
  config: TenantSmtpConfig,
  opts: { to: string; subject: string; html: string; replyTo?: string | null },
): Promise<SendMailResult> {
  if (!config.host || !config.user || !config.password) {
    return { ok: false, error: "SMTP tenant belum dikonfigurasi lengkap." };
  }
  const to = stripHeaderChars(opts.to);
  if (!isValidEmailAddress(to)) return { ok: false, error: "Alamat email tujuan tidak valid." };

  try {
    const transport = buildTransport({
      host: config.host,
      port: config.port || 587,
      user: config.user,
      pass: config.password,
    });
    const fromEmail = config.fromEmail || config.user;
    const replyTo = opts.replyTo && isValidEmailAddress(opts.replyTo.trim()) ? opts.replyTo.trim() : undefined;
    await transport.sendMail({
      from:    `"${safeDisplayName(config.fromName || "Notifikasi")}" <${stripHeaderChars(fromEmail)}>`,
      to,
      replyTo,
      subject: stripHeaderChars(opts.subject),
      html:    opts.html,
    });
    return { ok: true };
  } catch (err) {
    console.error("[mail] sendTenantMail gagal:", err);
    const message = err instanceof Error ? err.message : "Gagal mengirim email.";
    return { ok: false, error: message };
  }
}
