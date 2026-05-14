import { TestRajaOngkirButton } from "./sync-cities-button";

export default async function PlatformSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Pengaturan Platform</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Konfigurasi platform global jalakarta</p>
      </div>

      <div className="rounded-xl border border-border bg-background p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold">RajaOngkir — Ongkos Kirim</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Add-on ongkos kirim menggunakan API RajaOngkir v2 (rajaongkir.komerce.id).
            Pencarian kota dilakukan secara realtime — tidak ada sinkronisasi yang diperlukan.
          </p>
        </div>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">
              ENV:{" "}
              <code className="bg-muted px-1 py-0.5 rounded text-xs">RAJAONGKIR_PLATFORM_KEY</code>
              {process.env.RAJAONGKIR_PLATFORM_KEY
                ? <span className="text-green-600 ml-2">✓ sudah diset</span>
                : <span className="text-red-600 ml-2">✗ belum diset</span>}
            </p>
          </div>
          <TestRajaOngkirButton />
        </div>
        <p className="text-xs text-muted-foreground">
          Klik tombol di atas untuk memverifikasi bahwa API key valid dan koneksi ke RajaOngkir aktif.
        </p>
      </div>
    </div>
  );
}
