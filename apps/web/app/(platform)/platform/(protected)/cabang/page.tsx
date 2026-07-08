import { db, refIkpmCabang, tenants } from "@jalajogja/db";
import { eq, desc, count, sql } from "drizzle-orm";
import Link from "next/link";
import { Plus, MapPin, Building2 } from "lucide-react";
import { CabangActions } from "./cabang-actions";

export default async function PlatformCabangPage() {
  // Ambil semua cabang + cek apakah sudah punya tenant aktif
  const rows = await db
    .select({
      id:         refIkpmCabang.id,
      kode:       refIkpmCabang.kode,
      nama:       refIkpmCabang.nama,
      namaPendek: refIkpmCabang.namaPendek,
      kota:       refIkpmCabang.kota,
      provinsi:   refIkpmCabang.provinsi,
      isActive:   refIkpmCabang.isActive,
      // Hitung berapa tenant yang terhubung ke cabang ini
      tenantCount: sql<number>`count(${tenants.id})::int`,
    })
    .from(refIkpmCabang)
    .leftJoin(tenants, eq(tenants.refCabangId, refIkpmCabang.id))
    .groupBy(refIkpmCabang.id)
    .orderBy(refIkpmCabang.provinsi, refIkpmCabang.nama);

  const total         = rows.length;
  const denganTenant  = rows.filter(r => r.tenantCount > 0).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">PC IKPM Resmi</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {total} cabang terdaftar · {denganTenant} sudah punya tenant aktif
          </p>
        </div>
        <Link
          href="/platform/cabang/new"
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus size={14} />
          Tambah Cabang
        </Link>
      </div>

      <div className="rounded-xl border border-border bg-background overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs text-muted-foreground">
            <tr>
              <th className="text-left px-5 py-2.5 font-medium">Nama Cabang</th>
              <th className="text-left px-5 py-2.5 font-medium">Kode</th>
              <th className="text-left px-5 py-2.5 font-medium">Lokasi</th>
              <th className="text-left px-5 py-2.5 font-medium">Status</th>
              <th className="text-left px-5 py-2.5 font-medium">Tenant</th>
              <th className="px-5 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">
                  Belum ada data PC IKPM. Tambahkan atau jalankan migration seed data.
                </td>
              </tr>
            ) : rows.map(r => (
              <tr key={r.id} className="hover:bg-muted/20">
                <td className="px-5 py-3">
                  <p className="font-medium">{r.nama}</p>
                  {r.namaPendek && r.namaPendek !== r.nama && (
                    <p className="text-xs text-muted-foreground">{r.namaPendek}</p>
                  )}
                </td>
                <td className="px-5 py-3">
                  <span className="font-mono text-xs text-muted-foreground">{r.kode ?? "—"}</span>
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin size={11} />
                    {r.kota ? `${r.kota}, ` : ""}{r.provinsi ?? "—"}
                  </div>
                </td>
                <td className="px-5 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    r.isActive ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
                  }`}>
                    {r.isActive ? "Aktif" : "Non-aktif"}
                  </span>
                </td>
                <td className="px-5 py-3">
                  {r.tenantCount > 0 ? (
                    <span className="flex items-center gap-1 text-xs text-blue-600 font-medium">
                      <Building2 size={11} />
                      Ada tenant
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Belum ada</span>
                  )}
                </td>
                <td className="px-5 py-3 text-right">
                  <CabangActions id={r.id} isActive={r.isActive} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
