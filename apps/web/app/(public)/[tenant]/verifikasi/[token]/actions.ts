"use server";

import { timingSafeEqual } from "crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, pjVerificationLinks, pjVerificationEvents, createTenantDb } from "@jalajogja/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { lastFourDigits } from "@/lib/pj-notification.server";
import {
  loadPjLink, setPjUnlockCookie, hasPjUnlockCookie, resolvePjActorUserId, PJ_MAX_ATTEMPTS,
} from "@/lib/pj-link.server";
import { verifySubmittedPaymentCore } from "@/lib/payment-verification.server";

// Aksi halaman verifikasi PJ (TANPA login). Otorisasi = token acak di URL + kata sandi 4 digit
// terakhir HP penerima + cookie buka-kunci bertanda tangan. Lihat
// docs/arsitektur-notifikasi-pengurus.md § 4.3 + § 5 + § 8.

type Result = { ok: true; message?: string } | { ok: false; error: string };

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function unlockPjLinkAction(slug: string, token: string, pin: string): Promise<Result> {
  const ip = await clientIp();
  // Pengaman luar: per IP, di atas hitungan salah per tautan.
  if (!checkRateLimit(`pj-unlock:${ip}`, 20, 10 * 60_000).allowed) {
    return { ok: false, error: "Terlalu banyak percobaan. Coba lagi beberapa menit lagi." };
  }

  const loaded = await loadPjLink(slug, token);
  if (!loaded.ok) {
    return { ok: false, error: loaded.reason === "locked"
      ? "Tautan terkunci karena terlalu banyak salah memasukkan kata sandi. Tunggu ringkasan berikutnya untuk tautan baru."
      : "Tautan tidak valid atau sudah kedaluwarsa." };
  }

  // Hitung percobaan SECARA ATOMIK SEBELUM membandingkan — tebakan paralel tidak bisa melewati batas:
  // hanya yang mendapat hitungan ≤ batas yang boleh dibandingkan; sisanya ditolak tanpa dicek.
  const [att] = await db
    .update(pjVerificationLinks)
    .set({ failedAttempts: sql`${pjVerificationLinks.failedAttempts} + 1` })
    .where(and(eq(pjVerificationLinks.id, loaded.link.id), sql`${pjVerificationLinks.lockedAt} IS NULL`))
    .returning({ n: pjVerificationLinks.failedAttempts });
  if (!att || att.n > PJ_MAX_ATTEMPTS) {
    await db.update(pjVerificationLinks).set({ lockedAt: new Date() })
      .where(and(eq(pjVerificationLinks.id, loaded.link.id), sql`${pjVerificationLinks.lockedAt} IS NULL`));
    return { ok: false, error: "Terlalu banyak salah. Tautan ini dikunci." };
  }

  const expected = lastFourDigits(loaded.link.recipientPhone);
  const given    = (pin ?? "").replace(/\D/g, "");
  const a = Buffer.from(given), b = Buffer.from(expected);
  const match = expected.length === 4 && given.length === 4 && a.length === b.length && timingSafeEqual(a, b);

  if (!match) {
    if (att.n >= PJ_MAX_ATTEMPTS) {
      await db.update(pjVerificationLinks).set({ lockedAt: new Date() })
        .where(and(eq(pjVerificationLinks.id, loaded.link.id), sql`${pjVerificationLinks.lockedAt} IS NULL`));
      return { ok: false, error: "Terlalu banyak salah. Tautan ini dikunci." };
    }
    return { ok: false, error: `Kata sandi salah. Sisa percobaan: ${PJ_MAX_ATTEMPTS - att.n}.` };
  }

  // Benar: kembalikan hitungan hanya bila belum terkunci.
  await db.update(pjVerificationLinks).set({ failedAttempts: 0 })
    .where(and(eq(pjVerificationLinks.id, loaded.link.id), sql`${pjVerificationLinks.lockedAt} IS NULL`));
  await setPjUnlockCookie(loaded.link);
  revalidatePath(`/${slug}/verifikasi/${token}`);
  return { ok: true };
}

export type PjAction =
  | { kind: "correct" }
  | { kind: "different"; amount: number }
  | { kind: "not_found" };

export async function pjVerifyPaymentAction(
  slug: string, token: string, paymentId: string, action: PjAction,
): Promise<Result> {
  const ip = await clientIp();
  if (!checkRateLimit(`pj-act:${ip}`, 60, 10 * 60_000).allowed) {
    return { ok: false, error: "Terlalu banyak permintaan. Coba lagi sebentar lagi." };
  }
  if (!UUID_RE.test(paymentId)) return { ok: false, error: "Pembayaran tidak valid." };

  const loaded = await loadPjLink(slug, token);
  if (!loaded.ok) return { ok: false, error: "Tautan tidak valid, terkunci, atau sudah kedaluwarsa." };
  if (!(await hasPjUnlockCookie(loaded.link))) return { ok: false, error: "Sesi berakhir. Muat ulang halaman dan masukkan kata sandi." };

  const { link } = loaded;
  const tenantDb = createTenantDb(slug); // slug sudah dicocokkan ke tenant pemilik tautan oleh loadPjLink
  const { db: tdb, schema } = tenantDb;

  const [payment] = await tdb
    .select({ id: schema.payments.id, status: schema.payments.status, amount: schema.payments.amount, sourceType: schema.payments.sourceType })
    .from(schema.payments)
    .where(eq(schema.payments.id, paymentId))
    .limit(1);
  if (!payment || payment.sourceType !== "invoice") return { ok: false, error: "Pembayaran tidak ditemukan." };

  if (payment.status !== "submitted") return { ok: false, error: await alreadyHandledMessage(loaded.tenant.id, paymentId, payment.status) };

  const ipAddr = ip.slice(0, 64);

  if (action.kind === "not_found") {
    await db.insert(pjVerificationEvents).values({
      tenantId: loaded.tenant.id, linkId: link.id, paymentId, action: "not_found",
      actorName: link.recipientName, ipAddress: ipAddr,
    });
    revalidatePath(`/${slug}/verifikasi/${token}`);
    return { ok: true, message: "Ditandai: dana belum ditemukan. Pembayaran tetap menunggu." };
  }

  let amount: number;
  if (action.kind === "correct") {
    amount = parseFloat(String(payment.amount));
  } else {
    amount = Number(action.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) {
      return { ok: false, error: "Nominal tidak valid." };
    }
    amount = Math.round(amount);

    // Jalur tanpa login dibatasi: nominal tidak boleh jauh di atas yang pantas (tagihan tersisa atau
    // yang diklaim pembayar). Selisih besar → minta bendahara memakai dashboard.
    const [inv] = await tdb
      .select({ total: schema.invoices.total, uniqueCode: schema.invoices.uniqueCode, paid: schema.invoices.paidAmount })
      .from(schema.payments)
      .innerJoin(schema.invoices, eq(schema.invoices.id, schema.payments.sourceId))
      .where(eq(schema.payments.id, paymentId))
      .limit(1);
    const remaining = inv ? parseFloat(String(inv.total)) + (inv.uniqueCode ?? 0) - parseFloat(String(inv.paid)) : 0;
    const ceiling   = 2 * Math.max(remaining, parseFloat(String(payment.amount)));
    if (amount > ceiling) {
      return { ok: false, error: "Nominal terlalu jauh dari tagihan. Untuk selisih sebesar ini, verifikasi lewat dashboard." };
    }
  }

  const actorUserId = await resolvePjActorUserId(slug, link);
  if (!actorUserId) return { ok: false, error: "Tenant belum punya pengguna dashboard — hubungi admin." };

  const res = await verifySubmittedPaymentCore({
    slug, paymentId, verifiedAmount: amount, actorUserId,
    journalNote: `(diverifikasi via tautan oleh ${link.recipientName})`,
  });

  if (!res.success) {
    // Keduluan PJ/admin lain → kabari siapa yang memverifikasi, jangan jalankan ulang.
    if (res.error.includes("sudah diproses") || res.error.includes("sudah diverifikasi") || res.error.includes("lunas")) {
      const [fresh] = await tdb.select({ status: schema.payments.status }).from(schema.payments).where(eq(schema.payments.id, paymentId)).limit(1);
      return { ok: false, error: await alreadyHandledMessage(loaded.tenant.id, paymentId, fresh?.status ?? "paid") };
    }
    return { ok: false, error: res.error };
  }

  await db.insert(pjVerificationEvents).values({
    tenantId: loaded.tenant.id, linkId: link.id, paymentId,
    action: action.kind === "correct" ? "confirm" : "confirm_different",
    amount: amount.toFixed(2), actorName: link.recipientName, ipAddress: ipAddr,
  });
  revalidatePath(`/${slug}/verifikasi/${token}`);
  return { ok: true, message: "Pembayaran diverifikasi. Terima kasih." };
}

async function alreadyHandledMessage(tenantId: string, paymentId: string, status: string): Promise<string> {
  if (status === "rejected") return "Pembayaran ini sudah ditolak oleh pengurus.";
  const [ev] = await db
    .select({ name: pjVerificationEvents.actorName, at: pjVerificationEvents.createdAt })
    .from(pjVerificationEvents)
    .where(and(
      eq(pjVerificationEvents.tenantId, tenantId),
      eq(pjVerificationEvents.paymentId, paymentId),
      sql`${pjVerificationEvents.action} IN ('confirm','confirm_different')`,
    ))
    .orderBy(desc(pjVerificationEvents.createdAt))
    .limit(1);
  return ev ? `Sudah diverifikasi oleh ${ev.name}.` : "Sudah diverifikasi oleh pengurus.";
}
