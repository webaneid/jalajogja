import Link from "next/link";
import { eq, and, ilike, or } from "drizzle-orm";
import { UserPlus, Search } from "lucide-react";
import { db, members, tenantMemberships } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";

const STATUS_LABEL: Record<string, string> = {
  active: "Aktif",
  inactive: "Tidak Aktif",
  alumni: "Alumni",
};

const STATUS_COLOR: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  inactive: "bg-zinc-100 text-zinc-600",
  alumni: "bg-blue-100 text-blue-700",
};

const GENDER_LABEL: Record<string, string> = {
  male: "L",
  female: "P",
};

const PAGE_SIZE = 20;

export default async function MembersPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const { tenant: slug } = await params;
  const { q = "", status = "", page = "1" } = await searchParams;

  const access = await getTenantAccess(slug);
  if (!access) redirect("/dashboard-redirect");

  const currentPage = Math.max(1, parseInt(page));
  const offset = (currentPage - 1) * PAGE_SIZE;

  // Query anggota cabang ini saja — JOIN tenant_memberships
  const query = db
    .select({
      id: members.id,
      memberNumber: members.memberNumber,
      stambukNumber: members.stambukNumber,
      name: members.name,
      gender: members.gender,
      status: tenantMemberships.status,
      joinedAt: tenantMemberships.joinedAt,
    })
    .from(members)
    .innerJoin(
      tenantMemberships,
      and(
        eq(tenantMemberships.memberId, members.id),
        eq(tenantMemberships.tenantId, access.tenant.id)
      )
    );

  // Filter kondisional
  const conditions = [];
  if (status && ["active", "inactive", "alumni"].includes(status)) {
    conditions.push(eq(tenantMemberships.status, status as "active" | "inactive" | "alumni"));
  }
  if (q) {
    conditions.push(
      or(
        ilike(members.name, `%${q}%`),
        ilike(members.stambukNumber, `%${q}%`),
        ilike(members.memberNumber, `%${q}%`)
      )
    );
  }

  const rows = await query
    .where(conditions.length ? and(...conditions) : undefined)
    .limit(PAGE_SIZE)
    .offset(offset)
    .orderBy(members.name);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Anggota</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Data anggota {access.tenant.name}
          </p>
        </div>
        <Link
          href={`/${slug}/members/new`}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2
                     text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
        >
          <UserPlus className="h-4 w-4" />
          Tambah Anggota
        </Link>
      </div>

      {/* Filter & Search */}
      <div className="mb-4 flex flex-wrap gap-3">
        <form className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              name="q"
              defaultValue={q}
              placeholder="Cari nama / stambuk / no. anggota..."
              className="h-9 w-64 rounded-md border bg-background pl-9 pr-3 text-sm
                         focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          {status && <input type="hidden" name="status" value={status} />}
          <button
            type="submit"
            className="h-9 rounded-md border bg-background px-3 text-sm hover:bg-accent transition-colors"
          >
            Cari
          </button>
          {(q || status) && (
            <Link
              href={`/${slug}/members`}
              className="h-9 flex items-center px-3 text-sm text-muted-foreground hover:text-foreground"
            >
              Reset
            </Link>
          )}
        </form>

        {/* Filter status */}
        <div className="flex gap-1.5">
          {["", "active", "inactive", "alumni"].map((s) => (
            <Link
              key={s}
              href={`/${slug}/members?status=${s}${q ? `&q=${q}` : ""}`}
              className={`h-9 rounded-md px-3 text-sm font-medium transition-colors flex items-center
                ${status === s
                  ? "bg-primary text-primary-foreground"
                  : "border bg-background text-muted-foreground hover:bg-accent"
                }`}
            >
              {s === "" ? "Semua" : STATUS_LABEL[s]}
            </Link>
          ))}
        </div>
      </div>

      {/* Tabel */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {rows.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            {q || status ? "Tidak ada anggota yang cocok." : "Belum ada anggota. Tambah yang pertama!"}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nama</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Stambuk</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">No. Anggota</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">L/P</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((m) => (
                <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/${slug}/members/${m.id}`}
                      className="font-medium text-foreground hover:text-primary hover:underline"
                    >
                      {m.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{m.stambukNumber ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {m.memberNumber ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {m.gender ? GENDER_LABEL[m.gender] : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium
                      ${STATUS_COLOR[m.status ?? "active"]}`}>
                      {STATUS_LABEL[m.status ?? "active"]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {rows.length === PAGE_SIZE && (
        <div className="mt-4 flex justify-end gap-2">
          {currentPage > 1 && (
            <Link
              href={`/${slug}/members?page=${currentPage - 1}${q ? `&q=${q}` : ""}${status ? `&status=${status}` : ""}`}
              className="rounded-md border bg-background px-3 py-1.5 text-sm hover:bg-accent"
            >
              ← Sebelumnya
            </Link>
          )}
          <Link
            href={`/${slug}/members?page=${currentPage + 1}${q ? `&q=${q}` : ""}${status ? `&status=${status}` : ""}`}
            className="rounded-md border bg-background px-3 py-1.5 text-sm hover:bg-accent"
          >
            Selanjutnya →
          </Link>
        </div>
      )}
    </div>
  );
}
