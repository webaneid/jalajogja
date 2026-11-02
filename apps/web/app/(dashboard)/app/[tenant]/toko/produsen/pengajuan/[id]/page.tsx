// Detail & keputusan Pengajuan Produsen — docs/arsitektur-pengajuan-produsen.md § 10.
// Server component: seluruh data dibaca di server; `key` berkas MinIO tidak pernah sampai ke halaman (hanya URL penyaji berotorisasi).
// Teks bebas pemohon dirender sebagai teks biasa (tanpa dangerouslySetInnerHTML); tautan hanya https (divalidasi saat input) + rel noopener.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { hasFullAccess, hasReadAccess } from "@/lib/permissions";
import { displayPhone } from "@/lib/phone";
import { getApplicationDetail } from "@/lib/producer-application-review.server";
import { toDraftView, type FileView } from "@/lib/producer-application";
import { ProducerApplicationReview } from "./review-actions";

const STATUS_LABEL = { pending: "Menunggu tinjauan", approved: "Disetujui", rejected: "Ditolak", cancelled: "Dibatalkan", draft: "Draf" } as const;
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
const rp = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;
const PROCESS = { 1: "1×24 jam", 2: "2×24 jam", 3: "3×24 jam" } as Record<number, string>;

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return <div className="grid grid-cols-[150px_1fr] gap-3 px-4 py-2.5 text-sm"><span className="text-muted-foreground">{k}</span><span className="min-w-0 break-words">{children}</span></div>;
}
function Thumb({ f }: { f: FileView }) {
  return f.mime === "application/pdf" ? (
    <a href={f.url} target="_blank" rel="noopener noreferrer" className="flex h-24 w-24 items-center justify-center rounded-lg border border-border bg-muted/30 text-xs text-primary hover:underline">Buka PDF</a>
  ) : (
    <a href={f.url} target="_blank" rel="noopener noreferrer" className="block h-24 w-24 overflow-hidden rounded-lg border border-border">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={f.url} alt="" className="h-full w-full object-cover" />
    </a>
  );
}

export default async function PengajuanDetailPage({ params }: { params: Promise<{ tenant: string; id: string }> }) {
  const { tenant: slug, id } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/app/login");
  if (!hasReadAccess(access.tenantUser, "anggota")) redirect(`/app/${slug}/toko/produsen/pengajuan`);

  const d = await getApplicationDetail(createTenantDb(slug), { id: access.tenant.id, tenantType: access.tenant.tenantType }, id, access.tenantUser.memberId);
  if (!d) notFound();
  const v = toDraftView(d.app, slug);
  const canAct = hasFullAccess(access.tenantUser, "anggota") && d.app.status === "pending";
  const share = d.app.offeredSharePercent != null ? Number(d.app.offeredSharePercent) : null;

  // Hal yang membuat persetujuan PASTI gagal di server — diperlihatkan lebih dulu agar penyetuju tidak menebak
  const blockers: string[] = [];
  if (!d.isActiveMember) blockers.push("Pemohon bukan lagi anggota sah tenant ini.");
  if (!d.member.hasAccount) blockers.push("Pemohon belum mengklaim akunnya (status Pending Claim), jadi akses login tidak bisa dibuat.");

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl">
      <div>
        <Link href={`/app/${slug}/toko/produsen/pengajuan`} className="text-xs text-muted-foreground hover:underline">← Semua pengajuan</Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">{v.brandName || "(tanpa brand)"}</h1>
          <span className="rounded-full border border-border px-2.5 py-0.5 text-xs">{STATUS_LABEL[d.app.status]}</span>
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">Dikirim {fmt(v.submittedAt)}</p>
      </div>

      {d.isOwnApplication && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">Ini pengajuan Anda sendiri.</p>
          <p className="mt-0.5 text-xs">Sebaiknya diputuskan pengurus lain. Bila tetap Anda putuskan, keputusan akan ditandai &quot;diputuskan oleh pemohon sendiri&quot; pada catatan internal.</p>
        </div>
      )}

      {d.app.status === "rejected" && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm space-y-1">
          <p className="font-medium text-destructive">Ditolak {fmt(v.reviewedAt)}</p>
          <p>{v.rejectionReason}</p>
          {d.app.reviewNote && <p className="text-xs text-muted-foreground">Catatan internal: {d.app.reviewNote}</p>}
        </div>
      )}
      {d.app.status === "approved" && (
        <div className="rounded-xl border border-green-300 bg-green-50 p-4 text-sm space-y-1">
          <p className="font-medium text-green-800">Disetujui {fmt(v.reviewedAt)}</p>
          <p><Link className="text-primary underline" href={`/app/${slug}/toko/produsen`}>Lihat di daftar Produsen</Link></p>
          {d.app.reviewNote && <p className="text-xs text-muted-foreground">Catatan internal: {d.app.reviewNote}</p>}
        </div>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Pemohon</h2>
        <div className="divide-y divide-border rounded-xl border border-border">
          <Row k="Nama">{d.member.name}</Row>
          <Row k="No. anggota / stambuk">{[d.member.memberNumber, d.member.stambukNumber].filter(Boolean).join(" · ") || "—"}</Row>
          <Row k="Kontak">{[d.member.email, d.member.phone && displayPhone(d.member.phone), d.member.whatsapp && `WA ${displayPhone(d.member.whatsapp)}`].filter(Boolean).join(" · ") || "—"}</Row>
          <Row k="Keanggotaan tenant">{d.isActiveMember ? <span className="text-green-700">Anggota aktif</span> : <span className="text-destructive">Bukan anggota sah</span>}</Row>
          <Row k="Akun login">{d.member.hasAccount ? <span className="text-green-700">Sudah diklaim</span> : <span className="text-destructive">Belum diklaim</span>}</Row>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Usaha &amp; produk</h2>
        <div className="divide-y divide-border rounded-xl border border-border">
          <Row k="Sumber">{d.sourceLabel ?? "—"}</Row>
          <Row k="Brand">{v.brandName}</Row>
          <Row k="Jenis barang">{v.productCategories || "—"}</Row>
          <Row k="Deskripsi"><span className="whitespace-pre-wrap">{v.description}</span></Row>
          <Row k="Produk milik sendiri">{v.ownProductDeclared ? "Ya (pernyataan pemohon)" : "Tidak dinyatakan"}</Row>
          <Row k="Tautan bukti">{v.links.length ? v.links.map((l) => <a key={l} href={l} target="_blank" rel="noopener noreferrer" className="mr-3 block text-primary hover:underline">{l.replace(/^https:\/\//, "")}</a>) : "—"}</Row>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Operasional</h2>
        <div className="divide-y divide-border rounded-xl border border-border">
          <Row k="Penanggung jawab">{v.opsName} · {v.opsWhatsapp ? displayPhone(v.opsWhatsapp) : "—"}</Row>
          <Row k="Jumlah tim">{v.teamSize || "—"} orang</Row>
          <Row k="Waktu proses pesanan">{v.processDays ? PROCESS[v.processDays] : "—"}</Row>
          <Row k="Kota asal kirim">{d.regencyName ?? "—"}</Row>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Tawaran bagi hasil: <span className="text-primary">{share != null ? `${share}%` : "—"}</span></h2>
        <p className="text-xs text-muted-foreground">Bagian tenant = harga jual × persentase tawaran (simulasi; model akhir dibahas di tahap produk).</p>
        <div className="space-y-3">
          {v.samples.map((s) => (
            <div key={s.id} className="flex gap-3 rounded-xl border border-border p-3">
              {s.file ? <Thumb f={s.file} /> : <div className="flex h-24 w-24 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">Tanpa foto</div>}
              <div className="min-w-0 text-sm space-y-0.5">
                <p className="font-medium">{s.name}</p>
                <p className="text-muted-foreground">Umum {s.estPriceUmum != null ? rp(s.estPriceUmum) : "—"} · Anggota {s.estPriceAnggota != null ? rp(s.estPriceAnggota) : "—"}</p>
                {share != null && s.estPriceUmum != null && <p className="text-xs">Bagian tenant (umum): <span className="font-medium">{rp(Math.round((s.estPriceUmum * share) / 100))}</span>{s.estPriceAnggota != null && <> · (anggota): <span className="font-medium">{rp(Math.round((s.estPriceAnggota * share) / 100))}</span></>}</p>}
              </div>
            </div>
          ))}
        </div>
      </section>

      {(v.processFiles.length > 0 || v.documents.length > 0) && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Bukti tambahan</h2>
          {v.processFiles.length > 0 && <div><p className="mb-1 text-xs text-muted-foreground">Foto proses produksi</p><div className="flex flex-wrap gap-2">{v.processFiles.map((f) => <Thumb key={f.id} f={f} />)}</div></div>}
          {v.documents.length > 0 && <div><p className="mb-1 text-xs text-muted-foreground">Dokumen legalitas</p><div className="flex flex-wrap gap-3">{v.documents.map((x) => <div key={x.id} className="space-y-1"><Thumb f={x.file} /><p className="text-xs font-medium">{x.kind}</p>{x.note && <p className="max-w-24 text-xs text-muted-foreground">{x.note}</p>}</div>)}</div></div>}
        </section>
      )}

      {canAct && <ProducerApplicationReview slug={slug} id={d.app.id} offeredShare={share != null ? String(share) : ""} blockers={blockers} />}
      {!canAct && d.app.status === "pending" && (
        <p className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">Anda hanya dapat melihat. Menyetujui atau menolak memerlukan akses penuh ke data anggota (Owner, Ketua, atau Sekretaris).</p>
      )}
    </div>
  );
}
