import { NextRequest, NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db, profiles, createTenantDb } from "@jalajogja/db";
import { auth } from "@/lib/auth";

// ─── GET /api/akun/transaksi?slug={tenantSlug} ────────────────────────────────
// Riwayat transaksi (invoices) milik akun yang sedang login di tenant tertentu.
// Hanya invoice dengan profile_id yang cocok yang dikembalikan.
//
// Query params:
//   slug     (wajib) — slug tenant yang dituju
//   page     (opsional, default 1)
//   limit    (opsional, default 20, max 50)
//
// Response: { data: Invoice[], total, page, limit }

export async function GET(req: NextRequest) {
  // ── Auth check ────────────────────────────────────────────────────────────
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Login diperlukan." }, { status: 401 });
  }

  // ── Resolve profile ───────────────────────────────────────────────────────
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.betterAuthUserId, session.user.id),
  });

  if (!profile) {
    return NextResponse.json({ error: "Profil akun tidak ditemukan." }, { status: 404 });
  }
  if (profile.deletedAt) {
    return NextResponse.json({ error: "Akun sudah dihapus." }, { status: 410 });
  }

  // ── Params ────────────────────────────────────────────────────────────────
  const { searchParams } = new URL(req.url);
  const slug  = searchParams.get("slug")?.trim();
  const page  = Math.max(1, parseInt(searchParams.get("page")  ?? "1",  10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));

  if (!slug) {
    return NextResponse.json({ error: "Parameter slug wajib diisi." }, { status: 400 });
  }

  // ── Query invoices di tenant ──────────────────────────────────────────────
  const { db: tenantDb, schema } = createTenantDb(slug);

  const offset = (page - 1) * limit;

  const [rows, countRows] = await Promise.all([
    tenantDb
      .select({
        id:            schema.invoices.id,
        invoiceNumber: schema.invoices.invoiceNumber,
        sourceType:    schema.invoices.sourceType,
        customerName:  schema.invoices.customerName,
        total:         schema.invoices.total,
        paidAmount:    schema.invoices.paidAmount,
        status:        schema.invoices.status,
        dueDate:       schema.invoices.dueDate,
        createdAt:     schema.invoices.createdAt,
      })
      .from(schema.invoices)
      .where(eq(schema.invoices.profileId, profile.id))
      .orderBy(desc(schema.invoices.createdAt))
      .limit(limit)
      .offset(offset),

    tenantDb
      .select({ id: schema.invoices.id })
      .from(schema.invoices)
      .where(eq(schema.invoices.profileId, profile.id)),
  ]);

  return NextResponse.json({
    success: true,
    data:    rows.map((r) => ({
      ...r,
      total:     parseFloat(String(r.total)),
      paidAmount: parseFloat(String(r.paidAmount)),
    })),
    total: countRows.length,
    page,
    limit,
  });
}
