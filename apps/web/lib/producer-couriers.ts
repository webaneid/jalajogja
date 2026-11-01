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
 * Validasi server: kurir terpilih sebuah baris pengiriman harus ada di daftar pilihan produsennya (bila produsen mengatur).
 * Baris tanpa produsen / produsen yang belum mengatur → tidak dibatasi di sini (perilaku lama). Mengembalikan pesan error atau null.
 */
export function validateLineCouriers(
  lines: { deliveryMethod: "courier" | "pickup"; courier?: string | null }[],
  producerIds: (string | null)[],
  producerCouriers: Map<string, string[]>,
): string | null {
  for (const [i, line] of lines.entries()) {
    if (line.deliveryMethod !== "courier") continue;
    const pid = producerIds[i];
    const allowed = pid ? producerCouriers.get(pid) : undefined;
    if (allowed && (!line.courier || !allowed.includes(line.courier))) {
      return "Kurir yang dipilih tidak tersedia untuk pengirim ini. Muat ulang halaman checkout lalu coba lagi.";
    }
  }
  return null;
}
