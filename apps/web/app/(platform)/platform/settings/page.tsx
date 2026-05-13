import { SyncRajaOngkirCitiesButton } from "./sync-cities-button";
import { db, refRajaongkirCities } from "@jalajogja/db";
import { count } from "drizzle-orm";

async function getCityCount() {
  try {
    const [{ total }] = await db.select({ total: count() }).from(refRajaongkirCities);
    return total;
  } catch {
    return 0;
  }
}

export default async function PlatformSettingsPage() {
  const cityCount = await getCityCount();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Pengaturan Platform</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Konfigurasi platform global jalakarta</p>
      </div>

      <div className="rounded-xl border border-border bg-background p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold">RajaOngkir — Referensi Kota</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Data kota digunakan oleh add-on ongkir semua tenant. Wajib diisi sebelum add-on aktif.
          </p>
        </div>
        <div className="flex items-center justify-between">
          <div className="text-sm">
            <span className="font-medium">{cityCount.toLocaleString("id-ID")}</span>
            <span className="text-muted-foreground ml-1">kota tersedia</span>
          </div>
          <SyncRajaOngkirCitiesButton />
        </div>
        <p className="text-xs text-muted-foreground">
          ENV yang dibutuhkan:{" "}
          <code className="bg-muted px-1 py-0.5 rounded text-xs">RAJAONGKIR_PLATFORM_KEY</code>{" "}
          dan{" "}
          <code className="bg-muted px-1 py-0.5 rounded text-xs">RAJAONGKIR_PLATFORM_TIER</code>{" "}
          (starter/pro)
        </p>
      </div>
    </div>
  );
}
