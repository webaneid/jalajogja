import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq, ilike, or, and, isNotNull, inArray } from "drizzle-orm";
import { Eye, Plus, UserCheck, UserX } from "lucide-react";
import { db, profiles, createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";

const PAGE_SIZE = 20;

const ACCOUNT_TYPE_BADGE: Record<string, string> = {
  akun:   "bg-muted text-muted-foreground",
  member: "bg-blue-100 text-blue-700",
};
const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  akun:   "Akun Publik",
  member: "Alumni IKPM",
};

export default async function AkunPage({
  params,
  searchParams,
}: {
  params:       Promise<{ tenant: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { tenant: slug } = await params;
  const { q = "", page = "1" } = await searchParams;

  const access = await getTenantAccess(slug);
  if (!access) redirect("/dashboard-redirect");

  const tenantId    = access.tenant.id;
  const currentPage = Math.max(1, parseInt(page));
  const offset      = (currentPage - 1) * PAGE_SIZE;

  // ── Ambil profile_id yang pernah bertransaksi di tenant ini ──────────────
  const { db: tenantDb, schema } = createTenantDb(slug);

  const invoiceRows = await tenantDb
    .selectDistinct({ profileId: schema.invoices.profileId })
    .from(schema.invoices)
    .where(isNotNull(schema.invoices.profileId));

  const profileIds = invoiceRows
    .map((r) => r.profileId)
    .filter((id): id is string => id !== null);

  // ── baseWhere: punya transaksi di sini ATAU didaftarkan dari sini ─────────
  const byTransaction  = profileIds.length > 0 ? inArray(profiles.id, profileIds) : undefined;
  const byRegistration = eq(profiles.registeredAtTenant, tenantId);
  const baseWhere      = byTransaction ? or(byTransaction, byRegistration)! : byRegistration;

  const searchWhere = q.trim()
    ? or(
        ilike(profiles.name,  `%${q.trim()}%`),
        ilike(profiles.email, `%${q.trim()}%`),
        ilike(profiles.phone, `%${q.trim()}%`),
      )
    : undefined;

  const finalWhere = searchWhere ? and(baseWhere, searchWhere) : baseWhere;

  const [rows, countRows] = await Promise.all([
    db
      .select({
        id:          profiles.id,
        name:        profiles.name,
        email:       profiles.email,
        phone:       profiles.phone,
        accountType: profiles.accountType,
        memberId:    profiles.memberId,
        createdAt:   profiles.createdAt,
      })
      .from(profiles)
      .where(finalWhere)
      .orderBy(desc(profiles.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset),

    db
      .select({ id: profiles.id })
      .from(profiles)
      .where(finalWhere),
  ]);

  const total      = countRows.length;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">Akun Publik</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pengguna umum yang pernah bertransaksi atau didaftarkan di cabang ini.
          </p>
        </div>
        <Link
          href={`/${slug}/akun/new`}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Tambah Akun
        </Link>
      </div>

      {/* Search */}
      <form method="GET" className="flex gap-2 max-w-sm">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Cari nama / email / nomor HP..."
          className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          type="submit"
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Cari
        </button>
        {q && (
          <Link
            href={`/${slug}/akun`}
            className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            Reset
          </Link>
        )}
      </form>

      {/* Tabel */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium">Nama</th>
              <th className="text-left px-4 py-2.5 font-medium">Email</th>
              <th className="text-left px-4 py-2.5 font-medium">Nomor HP</th>
              <th className="text-left px-4 py-2.5 font-medium">Tipe</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {q ? "Tidak ada hasil untuk pencarian ini." : "Belum ada akun publik. Klik \"Tambah Akun\" untuk menambahkan."}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium">{row.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.email}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.phone}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${ACCOUNT_TYPE_BADGE[row.accountType] ?? "bg-muted text-muted-foreground"}`}>
                      {row.accountType === "member"
                        ? <UserCheck className="h-3 w-3" />
                        : <UserX className="h-3 w-3" />
                      }
                      {ACCOUNT_TYPE_LABEL[row.accountType] ?? row.accountType}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/${slug}/akun/${row.id}`}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Detail
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination + total */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{total} akun ditemukan</span>
        {totalPages > 1 && (
          <div className="flex gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
              const sp = new URLSearchParams();
              if (q) sp.set("q", q);
              if (p > 1) sp.set("page", String(p));
              return (
                <Link
                  key={p}
                  href={`/${slug}/akun${sp.size ? `?${sp}` : ""}`}
                  className={`rounded-md px-2.5 py-1 border text-xs ${
                    p === currentPage
                      ? "bg-foreground text-background border-foreground"
                      : "border-border hover:bg-muted/40"
                  }`}
                >
                  {p}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
