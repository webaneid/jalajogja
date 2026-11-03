// Bagian MURNI voucher produsen ("Promo Produsen", K23) — docs/arsitektur-produk-produsen.md § 4, § 12.
// Input dianggap TIDAK TEPERCAYA (Server Action bisa dipanggil dengan JSON bebas): parseVoucherInput menerima `unknown`.
import { isValidUuid } from "@/lib/is-uuid";
import { normalizePhone } from "@/lib/phone";

export const VOUCHER_LIMITS = { codeMin: 3, codeMax: 30, nameMax: 80, descMax: 200, targetsMax: 20, usageMax: 1_000_000, fixedMax: 1_000_000_000 } as const;

export type ProducerVoucherInput = {
  code:                  string;                       // disimpan UPPERCASE; tidak bisa diubah setelah dibuat
  name:                  string;                       // label internal
  description:           string;
  discountType:          "percentage" | "fixed";
  discountValue:         number;
  targetItemIds:         string[];                     // id produk MILIK produsen (divalidasi server); minimal 1
  usageLimit:            number | null;
  usageLimitPerCustomer: number | null;
  restrictPhone:         string | null;                // E.164
  restrictEmail:         string | null;                // lowercase
  validFrom:             string | null;                // YYYY-MM-DD (kalender tenant)
  validUntil:            string | null;
  isActive:              boolean;
};

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown): number | null => { const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN; return Number.isFinite(n) ? n : null; };
const optInt = (v: unknown, label: string): Parsed<number | null> => {
  if (v === null || v === undefined || v === "") return { ok: true, value: null };
  const n = num(v);
  if (n === null || !Number.isInteger(n) || n < 1 || n > VOUCHER_LIMITS.usageMax) return { ok: false, error: `${label} harus bilangan bulat minimal 1.` };
  return { ok: true, value: n };
};
function parseDate(v: unknown, label: string): Parsed<string | null> {
  if (v === null || v === undefined || v === "") return { ok: true, value: null };
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return { ok: false, error: `${label} tidak valid.` };
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v ? { ok: false, error: `${label} tidak valid.` } : { ok: true, value: v };
}

export function parseVoucherInput(input: unknown, opts: { requireCode: boolean } = { requireCode: true }): Parsed<ProducerVoucherInput> {
  if (!isRecord(input)) return { ok: false, error: "Data voucher tidak valid." };
  const L = VOUCHER_LIMITS;

  const code = typeof input.code === "string" ? input.code.trim().toUpperCase() : "";
  if (opts.requireCode) {
    if (code.length < L.codeMin || code.length > L.codeMax) return { ok: false, error: `Kode voucher ${L.codeMin}–${L.codeMax} karakter.` };
    if (!/^[A-Z0-9_-]+$/.test(code)) return { ok: false, error: "Kode voucher hanya boleh huruf, angka, - dan _." };
  }
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name) return { ok: false, error: "Nama voucher wajib diisi." };
  if (name.length > L.nameMax) return { ok: false, error: `Nama voucher maksimal ${L.nameMax} karakter.` };
  const description = typeof input.description === "string" ? input.description.trim().slice(0, L.descMax) : "";

  if (input.discountType !== "percentage" && input.discountType !== "fixed") return { ok: false, error: "Jenis diskon tidak valid." };
  const discountValue = num(input.discountValue);
  if (discountValue === null || !(discountValue > 0)) return { ok: false, error: "Nilai diskon harus lebih dari 0." };
  if (input.discountType === "percentage" && discountValue > 100) return { ok: false, error: "Diskon persentase tidak boleh lebih dari 100%." };
  if (input.discountType === "fixed" && discountValue > L.fixedMax) return { ok: false, error: "Nilai diskon terlalu besar." };

  if (!Array.isArray(input.targetItemIds) || input.targetItemIds.length < 1) return { ok: false, error: "Pilih minimal satu produk." };
  if (input.targetItemIds.length > L.targetsMax) return { ok: false, error: `Maksimal ${L.targetsMax} produk per voucher.` };
  const targetItemIds: string[] = [];
  for (const id of input.targetItemIds) {
    if (typeof id !== "string" || !isValidUuid(id)) return { ok: false, error: "Produk target tidak valid." };
    if (!targetItemIds.includes(id)) targetItemIds.push(id);
  }

  const usageLimit = optInt(input.usageLimit, "Batas pemakaian"); if (!usageLimit.ok) return usageLimit;
  const perCust = optInt(input.usageLimitPerCustomer, "Batas per pembeli"); if (!perCust.ok) return perCust;

  let restrictPhone: string | null = null;
  if (typeof input.restrictPhone === "string" && input.restrictPhone.trim() !== "") {
    restrictPhone = normalizePhone(input.restrictPhone);
    // normalizePhone longgar ("abc" → "+62abc"); voucher personal wajib nomor E.164 yang sungguhan
    if (!restrictPhone || !/^\+[1-9]\d{7,14}$/.test(restrictPhone)) return { ok: false, error: "Nomor HP pembatas tidak valid." };
  }
  let restrictEmail: string | null = null;
  if (typeof input.restrictEmail === "string" && input.restrictEmail.trim() !== "") {
    const e = input.restrictEmail.trim().toLowerCase();
    if (e.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return { ok: false, error: "Email pembatas tidak valid." };
    restrictEmail = e;
  }

  const from = parseDate(input.validFrom, "Tanggal mulai"); if (!from.ok) return from;
  const until = parseDate(input.validUntil, "Tanggal berakhir"); if (!until.ok) return until;
  if (from.value && until.value && from.value > until.value) return { ok: false, error: "Tanggal mulai tidak boleh setelah tanggal berakhir." };

  return { ok: true, value: {
    code, name, description,
    discountType: input.discountType, discountValue: Math.round(discountValue * 100) / 100,
    targetItemIds, usageLimit: usageLimit.value, usageLimitPerCustomer: perCust.value,
    restrictPhone, restrictEmail, validFrom: from.value, validUntil: until.value,
    isActive: input.isActive !== false,
  } };
}

/**
 * Batas Promo Produsen (K23): potongan ≤ persentase bagian tenant.
 *  - persen: nilai ≤ sharePercent
 *  - nominal: nilai ≤ floor(harga satuan terendah × sharePercent)/100  (harga terendah = min harga publik/anggota di antara produk target)
 * Mengembalikan pesan galat berisi batas maksimal, atau null bila sah.
 */
export function checkVoucherCap(input: Pick<ProducerVoucherInput, "discountType" | "discountValue">, sharePercent: number, lowestUnitPrice: number): string | null {
  if (input.discountType === "percentage") {
    return input.discountValue > sharePercent ? `Diskon maksimal ${sharePercent}% (sama dengan bagian tenant atas penjualan Anda).` : null;
  }
  const maxFixed = Math.floor(lowestUnitPrice * sharePercent) / 100;
  return input.discountValue > maxFixed
    ? `Diskon nominal maksimal Rp${new Intl.NumberFormat("id-ID").format(maxFixed)} untuk produk terpilih (${sharePercent}% dari harga terendah Rp${new Intl.NumberFormat("id-ID").format(lowestUnitPrice)}).`
    : null;
}
