// Halaman verifikasi pembayaran untuk PJ/bendahara — TANPA login, dibuka dari tautan WA/email.
// Pengaman: token acak di URL + kata sandi (4 digit terakhir HP penerima) + cookie bertanda tangan.
// Lihat docs/arsitektur-notifikasi-pengurus.md § 4.3 + § 8.
import type { Metadata } from "next";
import { desc, eq, inArray, or, and, sql } from "drizzle-orm";
import { db, pjVerificationEvents, createTenantDb } from "@jalajogja/db";
import { loadPjLink, hasPjUnlockCookie } from "@/lib/pj-link.server";
import { getTenantTimezone, formatInTz } from "@/lib/tenant-timezone.server";
import { PjUnlockForm, PjPaymentList, type PjPaymentRow } from "./verification-client";

export const metadata: Metadata = {
  title: "Verifikasi Pembayaran",
  robots: { index: false, follow: false },
};

function Card({ title, message }: { title: string; message: string }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-sm w-full rounded-xl border border-border bg-background p-8 text-center space-y-3">
        <p className="text-lg font-semibold">{title}</p>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

export default async function VerifikasiPage({
  params,
}: {
  params: Promise<{ tenant: string; token: string }>;
}) {
  const { tenant: slug, token } = await params;

  const loaded = await loadPjLink(slug, token);
  if (!loaded.ok) {
    return loaded.reason === "locked"
      ? <Card title="Tautan Terkunci" message="Terlalu banyak salah memasukkan kata sandi. Tunggu ringkasan berikutnya untuk mendapat tautan baru." />
      : loaded.reason === "expired"
        ? <Card title="Tautan Kedaluwarsa" message="Tautan ini sudah tidak berlaku. Tunggu ringkasan berikutnya untuk tautan baru, atau verifikasi lewat dashboard." />
        : <Card title="Tautan Tidak Valid" message="Tautan verifikasi ini tidak ditemukan." />;
  }

  const { link, tenant } = loaded;

  if (!(await hasPjUnlockCookie(link))) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
        <div className="max-w-sm w-full rounded-xl border border-border bg-background p-8 space-y-4">
          <div className="text-center space-y-1">
            <p className="text-lg font-semibold">Verifikasi Pembayaran</p>
            <p className="text-sm text-muted-foreground">{tenant.name}</p>
          </div>
          <PjUnlockForm slug={slug} token={token} recipientName={link.recipientName} />
        </div>
      </div>
    );
  }

  const tenantDb = createTenantDb(slug);
  const { db: tdb, schema } = tenantDb;
  const tz = await getTenantTimezone(tenantDb);

  // Daftar = snapshot digest ∪ semua yang menunggu SEKARANG (kondisi dibaca dari DB, bukan dari isi
  // pesan lama) — yang sudah diproses tampil "Sudah diverifikasi oleh …".
  const snapshotIds = (link.paymentIds ?? []).slice(0, 200);
  const rows = await tdb
    .select({
      id:            schema.payments.id,
      status:        schema.payments.status,
      amount:        schema.payments.amount,
      method:        schema.payments.method,
      payerName:     schema.payments.payerName,
      payerBank:     schema.payments.payerBank,
      payerNote:     schema.payments.payerNote,
      submittedAt:   schema.payments.submittedAt,
      createdAt:     schema.payments.createdAt,
      confirmedAt:   schema.payments.confirmedAt,
      invoiceNumber: schema.invoices.invoiceNumber,
      total:         schema.invoices.total,
      uniqueCode:    schema.invoices.uniqueCode,
      customerName:  schema.invoices.customerName,
    })
    .from(schema.payments)
    .innerJoin(schema.invoices, eq(schema.invoices.id, schema.payments.sourceId))
    .where(and(
      eq(schema.payments.sourceType, "invoice"),
      or(
        eq(schema.payments.status, "submitted"),
        snapshotIds.length > 0 ? inArray(schema.payments.id, snapshotIds) : sql`false`,
      ),
    ))
    .orderBy(desc(schema.payments.submittedAt))
    .limit(200);

  const ids = rows.map((r) => r.id);
  const events = ids.length === 0 ? [] : await db
    .select({
      paymentId: pjVerificationEvents.paymentId,
      action:    pjVerificationEvents.action,
      actorName: pjVerificationEvents.actorName,
      amount:    pjVerificationEvents.amount,
      createdAt: pjVerificationEvents.createdAt,
    })
    .from(pjVerificationEvents)
    .where(and(eq(pjVerificationEvents.tenantId, tenant.id), inArray(pjVerificationEvents.paymentId, ids)))
    .orderBy(desc(pjVerificationEvents.createdAt));

  const fmt = (d: Date | null) =>
    d ? formatInTz(d, tz, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";

  const items: PjPaymentRow[] = rows.map((r) => {
    const evs        = events.filter((e) => e.paymentId === r.id);
    const confirmEv  = evs.find((e) => e.action === "confirm" || e.action === "confirm_different");
    const flagEv     = evs.find((e) => e.action === "not_found");
    const base       = parseFloat(String(r.total));
    const code       = r.uniqueCode ?? 0;
    const state: PjPaymentRow["state"] =
      r.status === "submitted" ? "pending" : r.status === "paid" ? "verified" : r.status === "rejected" ? "rejected" : "other";
    return {
      id:            r.id,
      sender:        r.payerName || r.customerName,
      invoiceNumber: r.invoiceNumber,
      via:           [r.method === "qris" ? "QRIS" : r.method === "cash" ? "Tunai" : "Transfer", r.payerBank].filter(Boolean).join(" • "),
      note:          r.payerNote,
      sentAt:        fmt(r.submittedAt ?? r.createdAt),
      claimed:       parseFloat(String(r.amount)),
      billBase:      base,
      uniqueCode:    code,
      state,
      verifiedBy:    state === "verified" ? (confirmEv?.actorName ?? "pengurus (dashboard)") : null,
      verifiedAt:    state === "verified" ? fmt(confirmEv?.createdAt ?? r.confirmedAt) : null,
      verifiedAmount: state === "verified" ? (confirmEv?.amount ? parseFloat(String(confirmEv.amount)) : parseFloat(String(r.amount))) : null,
      flaggedBy:     state === "pending" && flagEv ? flagEv.actorName : null,
      flaggedAt:     state === "pending" && flagEv ? fmt(flagEv.createdAt) : null,
    };
  });

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">
      <div className="space-y-1">
        <h1 className="text-xl font-bold">Verifikasi Pembayaran</h1>
        <p className="text-sm text-muted-foreground">
          {tenant.name} • untuk {link.recipientName}. Cocokkan dengan mutasi rekening/QRIS, lalu pilih
          hasilnya. Siapa pun dari pengurus keuangan boleh memverifikasi.
        </p>
      </div>
      <PjPaymentList slug={slug} token={token} items={items} />
    </div>
  );
}
