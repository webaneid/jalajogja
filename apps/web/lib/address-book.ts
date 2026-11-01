// Buku alamat per orang — tipe & validasi MURNI (aman dipakai server DAN klien). Doc: docs/arsitektur-alamat.md § 16.
import { normalizePhone } from "@/lib/phone";

export const MAX_ADDRESSES_PER_OWNER = 20;

export type AddressInput = {
  id?: string;
  label: string;
  recipientName: string;
  phone: string;
  destinationId: number;
  detail: string;
  isDefault: boolean;
};

export type AddressDestination = {
  id: number; label: string; cityName: string; districtName: string; subdistrictName: string; provinceName: string; zipCode: string;
};

export type AddressDTO = {
  id: string; label: string; recipientName: string; phone: string; detail: string; isDefault: boolean;
  destination: AddressDestination;
};

export type ParsedAddressInput = Omit<AddressInput, "id" | "phone"> & { id?: string; phone: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

/** Validasi + normalisasi input mentah dari klien. Tidak menyentuh DB (cek keberadaan tujuan dilakukan di pustaka server). */
export function parseAddressInput(raw: unknown): { ok: true; value: ParsedAddressInput } | { ok: false; error: string } {
  const r = (raw ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const label = str(r.label);
  const recipientName = str(r.recipientName);
  const detail = str(r.detail);
  const phone = normalizePhone(typeof r.phone === "string" ? r.phone : "");
  const destinationId = Number(r.destinationId);

  if (r.id !== undefined && r.id !== null && !isUuid(r.id)) return { ok: false, error: "Alamat tidak ditemukan." };
  if (label.length < 1 || label.length > 40) return { ok: false, error: "Nama alamat 1–40 karakter (mis. Rumah, Kantor)." };
  if (recipientName.length < 2 || recipientName.length > 100) return { ok: false, error: "Nama penerima 2–100 karakter." };
  if (!phone || !/^\+\d{8,15}$/.test(phone)) return { ok: false, error: "Nomor HP penerima tidak valid." };
  if (!Number.isInteger(destinationId) || destinationId <= 0 || destinationId > 2_000_000_000) return { ok: false, error: "Pilih lokasi (kelurahan/kecamatan) dari daftar pencarian." };
  if (detail.length < 5 || detail.length > 300) return { ok: false, error: "Alamat lengkap 5–300 karakter (jalan, RT/RW, patokan)." };

  return {
    ok: true,
    value: {
      ...(r.id ? { id: r.id as string } : {}),
      label, recipientName, phone, destinationId, detail, isDefault: r.isDefault === true,
    },
  };
}
