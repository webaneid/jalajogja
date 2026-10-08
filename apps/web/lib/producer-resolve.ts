// Aturan fallback data produsen — MURNI (tanpa DB) supaya bisa diuji. Doc: docs/arsitektur-produsen.md § 3.
// ADMIN-ONLY: hasilnya hanya boleh dipakai dashboard admin (hasFullAccess toko), JANGAN ke payload publik.

export type ProducerSourceKind = "usaha" | "pesantren" | "profesional";

export type ContactLike = { whatsapp?: string | null; phone?: string | null } | null | undefined;

// Dari mana nomor/alamat berasal — selalu ditampilkan sebagai label supaya admin tahu nomor SIAPA yang
// dihubungi (nomor "pemilik" = nomor pribadi anggota).
export type PhoneSource = ProducerSourceKind | "pemilik" | "custom" | "tenant";
export type ProducerPhone = { value: string; source: PhoneSource; isWhatsapp: boolean };

export type AddressSource = "sumber" | "pemilik" | "custom" | "tenant";
export type ProducerAddress = { text: string; source: AddressSource };

const clean = (v: string | null | undefined): string | null => {
  const t = v?.trim();
  return t ? t : null;
};

/**
 * Rantai (keputusan user 2026-10-09): WhatsApp sumber → telepon sumber → WhatsApp PEMILIK (anggota).
 * `source` = jenis sumbernya (usaha/pesantren/profesional) untuk label.
 */
export function pickProducerPhone(
  source:       ProducerSourceKind,
  sourceContact: ContactLike,
  ownerContact:  ContactLike,
): ProducerPhone | null {
  const sWa = clean(sourceContact?.whatsapp);
  if (sWa) return { value: sWa, source, isWhatsapp: true };
  const sPhone = clean(sourceContact?.phone);
  if (sPhone) return { value: sPhone, source, isWhatsapp: false };
  const oWa = clean(ownerContact?.whatsapp);
  if (oWa) return { value: oWa, source: "pemilik", isWhatsapp: true };
  return null;
}

/** Alamat sumber → alamat rumah pemilik (keputusan user). */
export function pickProducerAddress(
  sourceAddress: string | null | undefined,
  ownerAddress:  string | null | undefined,
): ProducerAddress | null {
  const s = clean(sourceAddress);
  if (s) return { text: s, source: "sumber" };
  const o = clean(ownerAddress);
  if (o) return { text: o, source: "pemilik" };
  return null;
}

/** Nama tampilan per jenis sumber. Profesional tidak punya nama sendiri → gelar + nama anggota. */
export function composeProducerName(
  kind: ProducerSourceKind,
  d: { name?: string | null; brand?: string | null; title?: string | null; ownerName?: string | null },
): string {
  if (kind === "profesional") {
    return [clean(d.title), clean(d.ownerName)].filter(Boolean).join(" ") || "(tanpa nama)";
  }
  const name = clean(d.name) ?? "(tanpa nama)";
  const brand = clean(d.brand);
  return kind === "usaha" && brand && brand.toLowerCase() !== name.toLowerCase() ? `${name} (${brand})` : name;
}

export const PHONE_SOURCE_LABEL: Record<PhoneSource, string> = {
  usaha: "WA usaha", pesantren: "WA pesantren", profesional: "WA profesional",
  pemilik: "WA pemilik (anggota)", custom: "WA produsen", tenant: "Kontak tenant",
};
export const PHONE_SOURCE_LABEL_NONWA: Record<PhoneSource, string> = {
  usaha: "Telepon usaha", pesantren: "Telepon pesantren", profesional: "Telepon profesional",
  pemilik: "Telepon pemilik", custom: "Telepon produsen", tenant: "Kontak tenant",
};
export const ADDRESS_SOURCE_LABEL: Record<AddressSource, string> = {
  sumber: "alamat sumber", pemilik: "alamat rumah pemilik", custom: "alamat produsen", tenant: "alamat tenant",
};
