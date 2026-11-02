// Antrean Pengajuan Produsen (pengurus) — docs/arsitektur-pengajuan-produsen.md § 10.
// Lihat = hasReadAccess(anggota); tombol aksi ada di halaman detail (hasFullAccess(anggota)). Data pribadi pemohon → tidak ada versi publik.
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTenantAccess } from "@/lib/tenant";
import { hasReadAccess } from "@/lib/permissions";
import { createTenantDb } from "@jalajogja/db";
import { listApplications, REVIEW_STATUSES, type ReviewStatus } from "@/lib/producer-application-review.server";

const LABEL: Record<ReviewStatus, string> = { pending: "Menunggu", approved: "Disetujui", rejected: "Ditolak", cancelled: "Dibatalkan" };
const PAGE_SIZE = 20;
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "—");

export default async function PengajuanProdusenPage({
  params, searchParams,
}: { params: Promise<{ tenant: string }>; searchParams: Promise<{ status?: string; q?: string; page?: string }> }) {
  const { tenant: slug } = await params;
  const sp = await searchParams;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/app/login");
  if (!hasReadAccess(access.tenantUser, "anggota")) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">Pengajuan Produsen</h1>
        <p className="mt-2 text-sm text-muted-foreground">Anda tidak punya akses ke data anggota, jadi pengajuan produsen tidak ditampilkan.</p>
      </div>
    );
  }

  const status: ReviewStatus = (REVIEW_STATUSES as readonly string[]).includes(sp.status ?? "") ? (sp.status as ReviewStatus) : "pending";
  const q = (sp.q ?? "").slice(0, 100);
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const { rows, total } = await listApplications(createTenantDb(slug), { status, q, page, pageSize: PAGE_SIZE });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const base = `/app/${slug}/toko/produsen/pengajuan`;
  const href = (over: Record<string, string | number>) => {
    const p = new URLSearchParams({ status, ...(q ? { q } : {}), ...Object.fromEntries(Object.entries(over).map(([k, v]) => [k, String(v)])) });
    return `${base}?${p.toString()}`;
  };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl">
      <div>
        <h1 className="text-xl font-semibold">Pengajuan Produsen</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Kurasi anggota yang mengajukan diri menjadi produsen.</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {REVIEW_STATUSES.map((s) => (
            <Link key={s} href={`${base}?status=${s}`}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${s === status ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}>
              {LABEL[s]}
            </Link>
          ))}
        </div>
        <form action={base} className="flex gap-2">
          <input type="hidden" name="status" value={status} />
          <input name="q" defaultValue={q} placeholder="Cari brand / nama pemohon" maxLength={100}
            className="h-8 w-56 rounded-md border border-input bg-background px-3 text-sm" />
          <button className="h-8 rounded-md border border-border px-3 text-xs hover:bg-muted">Cari</button>
        </form>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
          {q ? "Tidak ada pengajuan yang cocok." : `Belum ada pengajuan berstatus ${LABEL[status].toLowerCase()}.`}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr><th className="px-3 py-2">Brand</th><th className="px-3 py-2">Pemohon</th><th className="px-3 py-2">Tawaran</th><th className="px-3 py-2">Dikirim</th>{status !== "pending" && <th className="px-3 py-2">Diputuskan</th>}<th className="px-3 py-2" /></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/20">
                  <td className="px-3 py-2 font-medium">{r.brandName}</td>
                  <td className="px-3 py-2">{r.memberName}{r.memberNumber && <span className="block text-xs text-muted-foreground">{r.memberNumber}</span>}</td>
                  <td className="px-3 py-2">{r.offeredSharePercent ? `${r.offeredSharePercent}%` : "—"}</td>
                  <td className="px-3 py-2">{fmt(r.submittedAt)}</td>
                  {status !== "pending" && <td className="px-3 py-2">{fmt(r.reviewedAt)}</td>}
                  <td className="px-3 py-2 text-right"><Link href={`${base}/${r.id}`} className="text-primary hover:underline">{status === "pending" ? "Tinjau" : "Lihat"}</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Halaman {page} dari {pages} · {total} pengajuan</span>
          <div className="flex gap-2">
            {page > 1 && <Link href={href({ page: page - 1 })} className="rounded-md border border-border px-3 py-1 hover:bg-muted">Sebelumnya</Link>}
            {page < pages && <Link href={href({ page: page + 1 })} className="rounded-md border border-border px-3 py-1 hover:bg-muted">Berikutnya</Link>}
          </div>
        </div>
      )}
    </div>
  );
}
