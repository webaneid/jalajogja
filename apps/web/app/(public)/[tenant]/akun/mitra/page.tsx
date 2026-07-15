import { redirect } from "next/navigation";
import { headers  } from "next/headers";
import { auth }     from "@/lib/auth";
import { isOwnHost } from "@/lib/is-own-host";
import { Handshake, CheckCircle2, Clock, PauseCircle, Package, ShoppingBag } from "lucide-react";
import { MitraCancelApplyButton } from "./mitra-cancel-button";

type Params = Promise<{ tenant: string }>;

export default async function AkunMitraPage({ params }: { params: Params }) {
  const { tenant: slug } = await params;

  const hdrs    = await headers();
  const baseUrl = isOwnHost(hdrs.get("host") ?? "") ? `/${slug}` : "";
  const session = await auth.api.getSession({ headers: hdrs });
  if (!session?.user) redirect(`${baseUrl}/login?redirect=${baseUrl}/akun/mitra`);

  // Fetch status dari API — hanya kirim cookie, bukan semua headers (hop-by-hop headers seperti
  // "connection" tidak boleh di-forward ke internal fetch dan menyebabkan UND_ERR_INVALID_ARG)
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL}/api/mitra/status?slug=${slug}`,
    { headers: { cookie: hdrs.get("cookie") ?? "" }, cache: "no-store" },
  );

  if (!res.ok) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground text-sm">Gagal memuat data mitra. Silakan coba lagi.</p>
      </div>
    );
  }

  const data = await res.json() as {
    mitra: { id: string; status: string; suspensionReason: string | null; productCount: number } | null;
    pendingApplication: { id: string; appliedAt: string } | null;
    businesses: { id: string; name: string; brand: string | null }[];
    hasBusinesses: boolean;
    settings: { mitraEnabled: boolean; mitraMaxProducts: number; minKomisiMitra: number };
    eligibility: {
      isMitraEnabled: boolean; isTenantMember: boolean;
      hasBusinesses: boolean; alreadyMitra: boolean; hasPending: boolean;
    };
  };

  const { mitra, pendingApplication, eligibility, settings } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Handshake className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-semibold">Mitra Toko</h1>
      </div>

      {/* Mitra tidak aktif */}
      {!eligibility.isMitraEnabled && (
        <div className="rounded-xl border border-border bg-muted/30 p-6 text-center space-y-2">
          <p className="font-medium">Sistem Mitra Belum Aktif</p>
          <p className="text-sm text-muted-foreground">
            Toko IKPM cabang ini belum membuka pendaftaran mitra. Cek kembali nanti.
          </p>
        </div>
      )}

      {/* Bukan anggota cabang ini — mitra terikat cabang tempat terdaftar */}
      {eligibility.isMitraEnabled && !eligibility.isTenantMember && !mitra && (
        <div className="rounded-xl border border-border bg-muted/30 p-6 text-center space-y-2">
          <p className="font-medium">Khusus Anggota Cabang Ini</p>
          <p className="text-sm text-muted-foreground">
            Pendaftaran mitra hanya terbuka untuk anggota IKPM yang terdaftar di cabang ini.
          </p>
        </div>
      )}

      {/* Sudah mitra — dashboard */}
      {eligibility.isMitraEnabled && mitra && (
        <div className="space-y-4">
          <div className={`rounded-xl border p-5 space-y-3 ${
            mitra.status === "active" ? "border-green-200 bg-green-50" : "border-orange-200 bg-orange-50"
          }`}>
            <div className="flex items-center gap-2">
              {mitra.status === "active"
                ? <CheckCircle2 className="h-5 w-5 text-green-600" />
                : <PauseCircle  className="h-5 w-5 text-orange-600" />}
              <p className={`font-semibold ${mitra.status === "active" ? "text-green-700" : "text-orange-700"}`}>
                {mitra.status === "active" ? "Mitra Aktif" : "Mitra Disuspend"}
              </p>
            </div>
            {mitra.suspensionReason && (
              <p className="text-sm text-orange-700">Alasan: {mitra.suspensionReason}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Komisi IKPM: {settings.minKomisiMitra}% per transaksi
            </p>
          </div>

          {mitra.status === "active" && (
            <div className="grid grid-cols-2 gap-3">
              <a
                href={`${baseUrl}/akun/mitra/produk`}
                className="rounded-xl border border-border bg-card p-4 hover:border-primary/50 transition-colors space-y-1"
              >
                <Package className="h-5 w-5 text-muted-foreground" />
                <p className="font-medium text-sm">Produk Saya</p>
                <p className="text-xs text-muted-foreground">{mitra.productCount} produk</p>
              </a>
              <a
                href={`${baseUrl}/akun/mitra/pesanan`}
                className="rounded-xl border border-border bg-card p-4 hover:border-primary/50 transition-colors space-y-1"
              >
                <ShoppingBag className="h-5 w-5 text-muted-foreground" />
                <p className="font-medium text-sm">Pesanan Masuk</p>
                <p className="text-xs text-muted-foreground">Input resi pengiriman</p>
              </a>
              <a
                href={`${baseUrl}/akun/mitra/produk/new`}
                className="col-span-2 rounded-xl border border-dashed border-border p-4 hover:border-primary transition-colors flex items-center justify-center gap-2 text-muted-foreground hover:text-primary"
              >
                <span className="text-xl">+</span>
                <p className="text-xs font-medium">Tambah Produk Baru</p>
              </a>
            </div>
          )}
        </div>
      )}

      {/* Sedang menunggu */}
      {eligibility.isMitraEnabled && !mitra && pendingApplication && (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-yellow-600" />
            <p className="font-semibold text-yellow-700">Pengajuan Sedang Diproses</p>
          </div>
          <p className="text-sm text-yellow-700">
            Pengajuan Anda sedang menunggu review dari admin. Biasanya diproses dalam 1–3 hari kerja.
          </p>
          <p className="text-xs text-muted-foreground">
            Diajukan: {new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" })
              .format(new Date(pendingApplication.appliedAt))}
          </p>
          <MitraCancelApplyButton slug={slug} />
        </div>
      )}

      {/* Belum mendaftar — tampilkan form jika eligible */}
      {eligibility.isMitraEnabled && eligibility.isTenantMember && !mitra && !pendingApplication && (
        <div className="space-y-4">
          {!eligibility.hasBusinesses ? (
            <div className="rounded-xl border border-border bg-muted/30 p-5 space-y-3">
              <p className="font-medium">Lengkapi Data Usaha Dulu</p>
              <p className="text-sm text-muted-foreground">
                Untuk mendaftar sebagai mitra, Anda perlu mengisi data usaha terlebih dahulu.
              </p>
              <a
                href={`${baseUrl}/akun/usaha`}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Isi Data Usaha
              </a>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl border border-border bg-card p-5 space-y-2">
                <p className="font-medium">Daftar sebagai Mitra IKPM</p>
                <p className="text-sm text-muted-foreground">
                  Sebagai mitra, produk Anda akan tampil di toko IKPM dan dapat dipesan oleh anggota maupun publik.
                </p>
                <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Komisi IKPM: {settings.minKomisiMitra}% per transaksi</li>
                  {settings.mitraMaxProducts > 0 && <li>Batas produk: {settings.mitraMaxProducts} produk</li>}
                  <li>Pembayaran melalui rekening IKPM — pencairan periodik</li>
                </ul>
              </div>
              <a
                href={`${baseUrl}/akun/mitra/apply`}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                <Handshake className="h-4 w-4" />
                Daftar Menjadi Mitra
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
