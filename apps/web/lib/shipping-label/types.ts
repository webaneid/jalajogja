// Tipe data label pengiriman — murni data (tanpa akses DB) supaya mesin render bisa diuji dengan data contoh.
// Doc: docs/arsitektur-portal-produsen.md § 21.

export const LABEL_FORMATS = ["a4-1", "a4-2", "a4-4", "a4-6", "th-10x10", "th-10x15", "th-8x6"] as const;
export type LabelFormat = typeof LABEL_FORMATS[number];

export type LabelParty = { name: string; phone: string; address: string };

export type LabelData = {
  tenantName: string;
  /** Logo tenant sebagai data URI (disematkan agar PDF tidak bergantung jaringan). null = tampil nama saja. */
  tenantLogo: string | null;
  courierName: string;            // "Lion Parcel"
  /** Logo kurir (data URI) dari Pengaturan Toko; null = badge teks tebal. */
  courierLogo: string | null;
  service: string;                // "REG", "YES", "OKE" — kosong bila ambil sendiri
  weightLabel: string;            // "0,5 Kg"
  invoiceNumber: string;
  sender: LabelParty;
  receiver: LabelParty;
  isCod: boolean;
  codAmountLabel: string | null;  // "Rp 125.000" — jumlah yang ditagih kurir
  items: { name: string; variant: string; qty: number }[];
  note: string | null;
  batchName: string | null;
  createdAtLabel: string;         // "31/10/2026 00:30" (zona waktu tenant)
};
