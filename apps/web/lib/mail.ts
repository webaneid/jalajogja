import "server-only";
import nodemailer from "nodemailer";

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

function buildTransport(opts: {
  host: string;
  port: number;
  user: string;
  pass: string;
}) {
  return nodemailer.createTransport({
    host:   opts.host,
    port:   opts.port,
    secure: opts.port === 465, // 465 = implicit TLS, 587 = STARTTLS (default nodemailer)
    auth:   { user: opts.user, pass: opts.pass },
  });
}

// ── Platform-level (env var) — dipakai Better Auth sendResetPassword + fallback publik ──

export function isPlatformMailConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
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
    ? `"${displayName}" <${platformFromAddress()}>`
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
