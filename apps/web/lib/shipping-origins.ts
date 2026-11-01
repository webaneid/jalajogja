// Asal kirim (gudang / pabrik / toko) — tipe & validasi MURNI (aman dipakai server DAN klien). Doc: docs/arsitektur-alamat.md § 20.
import { isUuid, type AddressDestination } from "@/lib/address-book";

export const MAX_ORIGINS_PER_OWNER = 10;

export type OriginInput = { id?: string; label: string; detail: string; destinationId: number; isDefault: boolean };

export type OriginDTO = {
  id: string;
  producerId: string | null;   // null = milik toko/internal
  label: string;
  detail: string;
  isDefault: boolean;
  destination: AddressDestination;
};

export function parseOriginInput(raw: unknown): { ok: true; value: OriginInput } | { ok: false; error: string } {
  const r = (raw ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const label = str(r.label);
  const detail = str(r.detail);
  const destinationId = Number(r.destinationId);
  if (r.id !== undefined && r.id !== null && !isUuid(r.id)) return { ok: false, error: "Asal kirim tidak ditemukan." };
  if (label.length < 1 || label.length > 60) return { ok: false, error: "Nama asal kirim 1–60 karakter (mis. Gudang Utama, Pabrik Sleman)." };
  if (!Number.isInteger(destinationId) || destinationId <= 0 || destinationId > 2_000_000_000) return { ok: false, error: "Pilih lokasi (kelurahan/kecamatan) dari daftar pencarian." };
  if (detail.length < 5 || detail.length > 300) return { ok: false, error: "Alamat lengkap 5–300 karakter (jalan, RT/RW, patokan)." };
  return { ok: true, value: { ...(r.id ? { id: r.id as string } : {}), label, detail, destinationId, isDefault: r.isDefault === true } };
}

/** Asal yang sudah terselesaikan untuk pengiriman (bentuk datar; dipakai penentu kelompok paket, pickup, dan label). */
export type ResolvedOrigin = {
  id: string;
  producerId: string | null;
  /** id tujuan RajaOngkir (dipakai langsung API ongkir) */
  cityId: number;
  /** "KEL, KEC, KOTA, PROV, KODEPOS" — internal; ke pembeli gunakan publicCityLabel() */
  fullLabel: string;
  name: string;
  addressDetail: string;
};

/**
 * Urutan penentuan asal produk TENANT (bukan mitra):
 *  (1) products.origin_id — hanya bila asal itu milik pemilik produk yang SAMA (produsen yang sama / toko bila tanpa produsen)
 *  (2) asal utama produsen  (3) asal utama toko.
 * Murni: indeks dimuat pemanggil.
 */
export type OriginIndex = {
  byId: Map<string, ResolvedOrigin>;
  producerDefault: Map<string, ResolvedOrigin>;
  tenantDefault: ResolvedOrigin | null;
};

export function resolveProductOrigin(index: OriginIndex, p: { originId: string | null | undefined; producerId: string | null | undefined }): ResolvedOrigin | null {
  const owner = p.producerId ?? null;
  if (p.originId) {
    const picked = index.byId.get(p.originId);
    if (picked && picked.producerId === owner) return picked;   // asal milik pemilik lain → diabaikan (tak bisa diselundupkan)
  }
  if (owner) { const d = index.producerDefault.get(owner); if (d) return d; }
  return index.tenantDefault;
}
