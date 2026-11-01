// Kurir per produsen — docs/arsitektur-portal-produsen.md § 25. Fungsi murni (aman dipakai server DAN klien).
// producers.couriers: NULL = ikut daftar kurir admin (add-on RajaOngkir config.couriers); terisi = pilihan produsen sendiri.
import { RAJAONGKIR_COURIER_CODES } from "@/lib/rajaongkir-couriers";

/** Bersihkan nilai mentah (JSONB/klien) → daftar kode valid unik, atau null bila kosong/bukan array. */
export function sanitizeCouriers(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const out = [...new Set(v.filter((x): x is string => typeof x === "string" && RAJAONGKIR_COURIER_CODES.includes(x)))];
  return out.length > 0 ? out : null;
}

/** Daftar kurir untuk satu paket: pilihan produsen bila ada, selain itu daftar admin tenant. */
export function resolveCouriersForGroup(
  producerId: string | null | undefined,
  producerCouriers: Record<string, string[]>,
  tenantCouriers: string[],
): string[] {
  return (producerId && producerCouriers[producerId]) || tenantCouriers;
}

/**
 * Validasi server: kurir terpilih sebuah baris pengiriman harus ada di daftar yang berlaku untuknya — pilihan produsen bila
 * produsen mengatur, selain itu daftar kurir admin tenant (add-on RajaOngkir). Mengembalikan pesan error atau null.
 */
export function validateLineCouriers(
  lines: { deliveryMethod: "courier" | "pickup"; courier?: string | null; sellerType?: "tenant" | "mitra" }[],
  producerIds: (string | null)[],
  producerCouriers: Map<string, string[]>,
  /** Ambil-sendiri penjual tenant aktif? Server memperlakukan "pickup" dari klien sebagai kurir bila tidak aktif — jadi tidak boleh dilewati. */
  tenantPickupEnabled: boolean,
  /** Daftar kurir admin (add-on RajaOngkir config.couriers); kosong = tidak ada kurir yang sah */
  tenantCouriers: string[],
): string | null {
  for (const [i, line] of lines.entries()) {
    // Ambil-sendiri sah dilewati: penjual tenant → bila pickup toko aktif (logika aksi); mitra → pickup-nya sudah dijamin verifikasi ongkir
    if (line.deliveryMethod === "pickup" && (tenantPickupEnabled || line.sellerType === "mitra")) continue;
    const pid = producerIds[i];
    const allowed = (pid ? producerCouriers.get(pid) : undefined) ?? tenantCouriers;
    if ((!line.courier || !allowed.includes(line.courier))) {
      return "Kurir yang dipilih tidak tersedia untuk pengirim ini. Muat ulang halaman checkout lalu coba lagi.";
    }
  }
  return null;
}

export type CouriersInputResult = { ok: true; value: string[] | null } | { ok: false; error: string };

/**
 * Validasi input simpan pilihan kurir (dari klien). `null` = kembali ikut pengaturan admin.
 * Array: minimal 1, semua kode harus ada di daftar 16 kurir (kode asing ditolak, tidak dibuang diam-diam).
 */
export function parseCouriersInput(v: unknown): CouriersInputResult {
  if (v === null) return { ok: true, value: null };
  if (!Array.isArray(v) || v.length > RAJAONGKIR_COURIER_CODES.length * 2) return { ok: false, error: "Pilihan kurir tidak valid." };
  if (!v.every((x) => typeof x === "string" && RAJAONGKIR_COURIER_CODES.includes(x))) return { ok: false, error: "Ada kurir yang tidak dikenal." };
  const unique = [...new Set(v as string[])];
  if (unique.length === 0) return { ok: false, error: "Pilih minimal satu kurir, atau pilih \"Ikuti pengaturan admin\"." };
  return { ok: true, value: unique };
}
