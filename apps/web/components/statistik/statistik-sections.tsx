import { Users, School, Briefcase, IdCard } from "lucide-react";
import type { MemberStatisticsData } from "@/lib/member-statistics.server";
import type { EkosistemModulesConfig } from "@/lib/ekosistem-modules";

// Ekstraksi MURNI dari app/(public)/[tenant]/statistik/page.tsx (2026-08-07) — render JSX
// dipindah apa adanya (zero perubahan visual), supaya bisa dipakai bersama oleh halaman
// publik per-tenant DAN menu admin "Ringkasan Tenant" (khusus tenant tipe "pusat"). Lihat
// docs/arsitektur-backbone-ikpm.md § "E. Statistik detail — REUSE penuh dari /{slug}/statistik".
//
// Komponen ini SENGAJA tidak merender header/judul halaman — hanya keempat blok <section>
// (Anggota/Pesantren/Usaha/Profesional) — supaya tiap caller bebas menaruh header sesuai
// konteksnya sendiri (statistik publik pakai h1 "Statistik"; drill-down admin pakai
// breadcrumb+nama tenant target).

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-border p-5 flex flex-col gap-1">
      <p className="text-3xl font-bold tabular-nums">{typeof value === "number" ? value.toLocaleString("id-ID") : value}</p>
      <p className="text-sm font-medium">{label}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function BarList({ items, total }: { items: { label: string; value: number }[]; total: number }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground italic">Belum ada data.</p>;
  const max = Math.max(...items.map(i => i.value), 1);
  return (
    <div className="space-y-2">
      {items.map(item => {
        const pct = Math.round((item.value / max) * 100);
        const totalPct = total > 0 ? Math.round((item.value / total) * 100) : 0;
        return (
          <div key={item.label} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-foreground/80 truncate max-w-[70%]">{item.label}</span>
              <span className="text-muted-foreground tabular-nums">
                {item.value.toLocaleString("id-ID")} ({totalPct}%)
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-primary/70 transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 text-base font-bold mt-2">
      <Icon className="h-5 w-5 text-primary" />
      {title}
    </div>
  );
}

const genderLabel: Record<string, string> = { male: "Laki-laki", female: "Perempuan" };
const waliSantriLabel: Record<string, string> = {
  gontor:  "Wali Santri PM Gontor",
  alumni:  "Wali Santri PM Alumni Gontor",
  lain:    "Wali Santri Pesantren Lain",
  bukan:   "Bukan Wali Santri",
};
const domisiliLabel: Record<string, string> = {
  permanent: "Domisili Tetap",
  temporary: "Domisili Sementara / Perantau",
};

export function StatistikSections({
  data, enabledModules,
}: {
  data: MemberStatisticsData;
  enabledModules: EkosistemModulesConfig;
}) {
  const {
    totalAnggota, activeTotal, alumniTotal,
    punyaUsahaTotal, punyaPesantrenTotal, punyaProfesionalTotal,
    genderRows, kabupatenAnggotaRows, domisiliRows, angkatanRows, profesiRows, waliSantriRows,
    totalPesantren, sumSantri, kurikulumRows, kategoriSantriRows, modelPendidikanRows, jenisPondokRows,
    totalUsaha, sektorRows, kategoriUsahaRows, legalitasRows, karyawanRows, cabangUsahaRows, kabupatenUsahaRows,
    totalProfesional, kategoriProfesionalRows, jenisProfesionalRows, kabupatenProfesionalRows,
  } = data;

  return (
    <>
      {/* ── Statistik Anggota ──────────────────────────────────────────── */}
      <section className="space-y-6">
        <SectionTitle icon={Users} title="Statistik Anggota" />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total Anggota"   value={totalAnggota} />
          <StatCard label="Anggota Aktif"   value={activeTotal} />
          <StatCard label="Alumni"          value={alumniTotal} />
          <StatCard label="Memiliki Usaha"  value={punyaUsahaTotal}
            sub={totalAnggota > 0 ? `${Math.round(punyaUsahaTotal / totalAnggota * 100)}% dari total` : undefined} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Memiliki Pesantren" value={punyaPesantrenTotal}
            sub={totalAnggota > 0 ? `${Math.round(punyaPesantrenTotal / totalAnggota * 100)}% dari total` : undefined} />
          <StatCard label="Memiliki Data Profesional" value={punyaProfesionalTotal}
            sub={totalAnggota > 0 ? `${Math.round(punyaProfesionalTotal / totalAnggota * 100)}% dari total` : undefined} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-xl border border-border p-5 space-y-4">
            <p className="text-sm font-semibold">Distribusi Gender</p>
            <BarList
              items={genderRows.map(r => ({ label: genderLabel[r.gender ?? ""] ?? (r.gender ?? "Tidak diketahui"), value: Number(r.total) }))}
              total={totalAnggota}
            />
          </div>
          <div className="rounded-xl border border-border p-5 space-y-4">
            <p className="text-sm font-semibold">Kategori Profesi</p>
            <BarList
              items={profesiRows.map(r => ({ label: r.category, value: Number(r.total) }))}
              total={totalAnggota}
            />
          </div>
          <div className="rounded-xl border border-border p-5 space-y-4">
            <p className="text-sm font-semibold">Wali Santri</p>
            <BarList
              items={waliSantriRows.map(r => ({ label: waliSantriLabel[r.wali ?? ""] ?? (r.wali ?? "Tidak diketahui"), value: Number(r.total) }))}
              total={totalAnggota}
            />
          </div>
          <div className="rounded-xl border border-border p-5 space-y-4">
            <p className="text-sm font-semibold">Status Domisili</p>
            <BarList
              items={domisiliRows.map(r => ({ label: domisiliLabel[r.status ?? ""] ?? (r.status ?? "Tidak diketahui"), value: Number(r.total) }))}
              total={totalAnggota}
            />
          </div>
          <div className="rounded-xl border border-border p-5 space-y-4">
            <p className="text-sm font-semibold">Top 10 Kabupaten / Kota Domisili</p>
            <BarList
              items={kabupatenAnggotaRows.map(r => ({ label: r.regency ?? "Tidak diketahui", value: Number(r.total) }))}
              total={totalAnggota}
            />
          </div>
          <div className="rounded-xl border border-border p-5 space-y-4">
            <p className="text-sm font-semibold">Top 10 Angkatan</p>
            <BarList
              items={angkatanRows.map(r => {
                const base = r.year ? String(r.year) : "Tidak diketahui";
                let label = base;
                if (r.year === 1999) {
                  label = r.period === "awal" ? "1999 (Awal)" : r.period === "akhir" ? "1999 (Akhir)" : "1999 (Belum ditentukan)";
                }
                return { label, value: Number(r.total) };
              })}
              total={totalAnggota}
            />
          </div>
        </div>
      </section>

      {/* ── Statistik Pesantren — hilang kalau modul Pesantren dimatikan admin ── */}
      {enabledModules.pesantren && (
      <section className="space-y-6">
        <SectionTitle icon={School} title="Statistik Pesantren" />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total Pesantren"    value={totalPesantren} />
          <StatCard label="Total Santri"        value={(Number(sumSantri.putra) + Number(sumSantri.putri)).toLocaleString("id-ID")} />
          <StatCard label="Santri Putra"        value={Number(sumSantri.putra).toLocaleString("id-ID")} />
          <StatCard label="Santri Putri"        value={Number(sumSantri.putri).toLocaleString("id-ID")} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Asatidz (Putra)"    value={Number(sumSantri.asatidz).toLocaleString("id-ID")} />
          <StatCard label="Asatidzah (Putri)"  value={Number(sumSantri.asatidzah).toLocaleString("id-ID")} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-xl border border-border p-5 space-y-4">
            <p className="text-sm font-semibold">Distribusi Kurikulum</p>
            <BarList
              items={kurikulumRows.map(r => ({ label: r.kurikulum ?? "Lainnya", value: Number(r.total) }))}
              total={totalPesantren}
            />
          </div>
          <div className="rounded-xl border border-border p-5 space-y-4">
            <p className="text-sm font-semibold">Kategori Santri</p>
            <BarList
              items={kategoriSantriRows.map(r => ({ label: r.kategori ?? "Tidak diketahui", value: Number(r.total) }))}
              total={totalPesantren}
            />
          </div>
          <div className="rounded-xl border border-border p-5 space-y-4">
            <p className="text-sm font-semibold">Model Pendidikan</p>
            <BarList
              items={modelPendidikanRows.map(r => ({ label: r.model ?? "Tidak diketahui", value: Number(r.total) }))}
              total={totalPesantren}
            />
          </div>
          <div className="rounded-xl border border-border p-5 space-y-4">
            <p className="text-sm font-semibold">Jenis Pondok</p>
            <BarList
              items={jenisPondokRows.map(r => ({ label: r.jenis ?? "Tidak diketahui", value: Number(r.total) }))}
              total={totalPesantren}
            />
          </div>
        </div>
      </section>
      )}

      {/* ── Statistik Usaha — hilang kalau modul Usaha dimatikan admin ── */}
      {enabledModules.usaha && (
      <section className="space-y-6">
        <SectionTitle icon={Briefcase} title="Statistik Usaha" />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total Usaha Aktif"  value={totalUsaha} />
          <StatCard label="Anggota Berusaha"    value={punyaUsahaTotal}
            sub={totalAnggota > 0 ? `${Math.round(punyaUsahaTotal / totalAnggota * 100)}% dari total anggota` : undefined} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="rounded-xl border border-border p-5 space-y-4">
            <p className="text-sm font-semibold">Distribusi Sektor</p>
            <BarList
              items={sektorRows.map(r => ({ label: r.sector ?? "Tidak diketahui", value: Number(r.total) }))}
              total={totalUsaha}
            />
          </div>
          <div className="rounded-xl border border-border p-5 space-y-4">
            <p className="text-sm font-semibold">Distribusi Kategori</p>
            <BarList
              items={kategoriUsahaRows.map(r => ({ label: r.category ?? "Tidak diketahui", value: Number(r.total) }))}
              total={totalUsaha}
            />
          </div>
          <div className="rounded-xl border border-border p-5 space-y-4">
            <p className="text-sm font-semibold">Distribusi Legalitas</p>
            <BarList
              items={legalitasRows.map(r => ({ label: r.legality ?? "Tidak diketahui", value: Number(r.total) }))}
              total={totalUsaha}
            />
          </div>
          <div className="rounded-xl border border-border p-5 space-y-4">
            <p className="text-sm font-semibold">Jumlah Karyawan</p>
            <BarList
              items={karyawanRows.map(r => ({ label: r.employees ?? "Tidak diketahui", value: Number(r.total) }))}
              total={totalUsaha}
            />
          </div>
          <div className="rounded-xl border border-border p-5 space-y-4">
            <p className="text-sm font-semibold">Jumlah Cabang Usaha</p>
            <BarList
              items={cabangUsahaRows.map(r => ({ label: r.branches ?? "Tidak diketahui", value: Number(r.total) }))}
              total={totalUsaha}
            />
          </div>
          <div className="rounded-xl border border-border p-5 space-y-4">
            <p className="text-sm font-semibold">Top 10 Kabupaten / Kota</p>
            <BarList
              items={kabupatenUsahaRows.map(r => ({ label: r.regency ?? "Tidak diketahui", value: Number(r.total) }))}
              total={totalUsaha}
            />
          </div>
        </div>
      </section>
      )}

      {/* ── Statistik Profesional — hilang kalau modul Profesional dimatikan admin ── */}
      {enabledModules.profesional && (
      <section className="space-y-6">
        <SectionTitle icon={IdCard} title="Statistik Profesional" />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total Data Profesional" value={totalProfesional} />
          <StatCard label="Anggota Profesional"     value={punyaProfesionalTotal}
            sub={totalAnggota > 0 ? `${Math.round(punyaProfesionalTotal / totalAnggota * 100)}% dari total anggota` : undefined} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="rounded-xl border border-border p-5 space-y-4">
            <p className="text-sm font-semibold">Distribusi Kategori Profesi</p>
            <BarList
              items={kategoriProfesionalRows.map(r => ({ label: r.category, value: Number(r.total) }))}
              total={totalProfesional}
            />
          </div>
          <div className="rounded-xl border border-border p-5 space-y-4">
            <p className="text-sm font-semibold">Top 10 Jenis Profesi</p>
            <BarList
              items={jenisProfesionalRows.map(r => ({ label: r.type, value: Number(r.total) }))}
              total={totalProfesional}
            />
          </div>
          <div className="rounded-xl border border-border p-5 space-y-4">
            <p className="text-sm font-semibold">Top 10 Kabupaten / Kota</p>
            <BarList
              items={kabupatenProfesionalRows.map(r => ({ label: r.regency ?? "Tidak diketahui", value: Number(r.total) }))}
              total={totalProfesional}
            />
          </div>
        </div>
      </section>
      )}
    </>
  );
}
