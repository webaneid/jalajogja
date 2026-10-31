// Label lokasi RajaOngkir → bentuk AMAN untuk pembeli. Murni (tanpa server-only) supaya dipakai juga komponen klien.
// Label lengkap = "KELURAHAN, KECAMATAN, KOTA, PROVINSI, KODEPOS". Pembeli hanya melihat "KOTA, PROVINSI" (kelurahan + kode pos gudang
// bisa rumah produsen perorangan). id lokasi untuk hitung ongkir tetap tingkat kelurahan. Doc: arsitektur-portal-produsen.md § 20.
export function publicCityLabel(label: string): string {
  const parts = label.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length > 0 && /^\d{4,10}$/.test(parts[parts.length - 1])) parts.pop(); // buang kode pos
  return parts.length >= 3 ? parts.slice(-2).join(", ") : parts.join(", ");
}

/** Nama kota saja ("YOGYAKARTA") untuk judul paket pelanggan. */
export function shortCityName(label: string): string {
  return publicCityLabel(label).split(",")[0].trim();
}
