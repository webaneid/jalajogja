import { NextRequest, NextResponse } from "next/server";
import { eq, desc, or }             from "drizzle-orm";
import { auth }                      from "@/lib/auth";
import { getAkunIdentity }           from "@/lib/akun-identity";
import { createTenantDb }            from "@jalajogja/db";

// ─── GET /api/akun/transaksi?slug={tenantSlug} ────────────────────────────────
// Riwayat transaksi (invoices) milik akun yang sedang login.
// Bekerja untuk dua jenis akun:
//   - Anggota IKPM → filter by invoices.member_id
//   - Akun Publik  → filter by invoices.profile_id
//
// Query params: slug (wajib), page (default 1), limit (default 20, max 50)

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id)
    return NextResponse.json({ error: "Login diperlukan." }, { status: 401 });

  const identity = await getAkunIdentity(session.user.id);
  if (!identity)
    return NextResponse.json({ error: "Akun tidak ditemukan." }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const slug  = searchParams.get("slug")?.trim();
  const page  = Math.max(1, parseInt(searchParams.get("page")  ?? "1",  10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));

  if (!slug)
    return NextResponse.json({ error: "Parameter slug wajib diisi." }, { status: 400 });

  const { db: tenantDb, schema } = createTenantDb(slug);
  const offset = (page - 1) * limit;

  // ── Build filter sesuai tipe akun ─────────────────────────────────────────
  let whereClause;
  if (identity.type === "member" && identity.memberId) {
    // Anggota IKPM: filter by member_id (bisa juga punya profile_id suatu saat)
    whereClause = eq(schema.invoices.memberId, identity.memberId);
  } else if (identity.profileId) {
    // Akun publik: filter by profile_id
    whereClause = eq(schema.invoices.profileId, identity.profileId);
  } else {
    return NextResponse.json({ data: [], total: 0, page, limit });
  }

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
      .where(whereClause)
      .orderBy(desc(schema.invoices.createdAt))
      .limit(limit)
      .offset(offset),

    tenantDb
      .select({ id: schema.invoices.id })
      .from(schema.invoices)
      .where(whereClause),
  ]);

  return NextResponse.json({
    success: true,
    data:    rows.map((r) => ({
      ...r,
      total:      parseFloat(String(r.total     ?? 0)),
      paidAmount: parseFloat(String(r.paidAmount ?? 0)),
    })),
    total: countRows.length,
    page,
    limit,
  });
}
