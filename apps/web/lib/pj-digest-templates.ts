// Kerangka teks digest ke PJ — default di kode, bisa di-override per tenant. Client-safe (nol import server).
// Sintaks {{variabel}} sama dengan template WA lain (renderTemplateString: string-replace murni).
// Lihat docs/arsitektur-notifikasi-pengurus.md § 8.4.

export const PJ_DIGEST_TEMPLATE_SETTING_KEY = "pj_digest_templates";
export const PJ_DIGEST_TEMPLATE_MAX_LENGTH = 2000;

export const PJ_DIGEST_TEMPLATE_KEYS = ["keuangan", "keuangan_backup", "keanggotaan", "toko", "donasi", "event"] as const;
export type PjDigestTemplateKey = typeof PJ_DIGEST_TEMPLATE_KEYS[number];

export function isPjDigestTemplateKey(k: string): k is PjDigestTemplateKey {
  return (PJ_DIGEST_TEMPLATE_KEYS as readonly string[]).includes(k);
}

export const PJ_DIGEST_TEMPLATE_DEFAULTS: Record<PjDigestTemplateKey, string> = {
  keuangan:
    "💰 *Verifikasi Pembayaran — {{orgName}}*\n\nAssalamu'alaikum {{name}}, ada *{{count}}* pembayaran yang belum diverifikasi:\n\n{{list}}{{more}}\n\nCek mutasi rekening/QRIS lalu verifikasi tanpa login lewat tautan ini:\n{{url}}\n\nKata sandi: *4 digit terakhir nomor HP Anda*. Tautan berlaku {{ttlHours}} jam.",
  keuangan_backup:
    "⚠️ *Cadangan Verifikasi Pembayaran — {{orgName}}*\n\nAssalamu'alaikum {{name}}, Anda tercatat sebagai penanggung jawab cadangan. {{reason}}\n\n{{list}}{{more}}\n\nVerifikasi tanpa login lewat tautan ini:\n{{url}}\n\nKata sandi: *4 digit terakhir nomor HP Anda*. Tautan berlaku {{ttlHours}} jam.",
  keanggotaan:
    "📋 *Ringkasan Keanggotaan — {{orgName}}*\n\nAssalamu'alaikum {{name}},\n\n{{ringkasan}}\n\nDashboard: {{dashboardUrl}}",
  toko:
    "🔔 *Pesanan Toko — {{orgName}}*\n\nAssalamu'alaikum {{name}},\n\n{{ringkasan}}\n\nDashboard: {{dashboardUrl}}",
  donasi:
    "🔔 *Donasi Masuk — {{orgName}}*\n\nAssalamu'alaikum {{name}},\n\n{{ringkasan}}\n\nDashboard: {{dashboardUrl}}",
  event:
    "🔔 *Pendaftar Event — {{orgName}}*\n\nAssalamu'alaikum {{name}},\n\n{{ringkasan}}\n\nDashboard: {{dashboardUrl}}",
};

export const PJ_DIGEST_TEMPLATE_LABELS: Record<PjDigestTemplateKey, string> = {
  keuangan:        "Ringkasan keuangan (bendahara)",
  keuangan_backup: "Ringkasan keuangan (cadangan)",
  keanggotaan:     "Ringkasan keanggotaan",
  toko:            "Ringkasan pesanan toko",
  donasi:          "Ringkasan donasi",
  event:           "Ringkasan pendaftar event",
};

const COMMON = [
  { name: "orgName", desc: "nama organisasi" },
  { name: "name",    desc: "nama penerima" },
];
const SUMMARY = [...COMMON,
  { name: "ringkasan",    desc: "isi ringkasan (daftar, dibuat otomatis)" },
  { name: "dashboardUrl", desc: "tautan dashboard" },
];
const MONEY = [...COMMON,
  { name: "count",    desc: "jumlah pembayaran menunggu" },
  { name: "list",     desc: "daftar pembayaran (dibuat otomatis)" },
  { name: "more",     desc: "keterangan 'dan N lainnya' bila daftar panjang" },
  { name: "url",      desc: "tautan verifikasi — WAJIB ada" },
  { name: "ttlHours", desc: "masa berlaku tautan (jam)" },
];

export const PJ_DIGEST_TEMPLATE_VARS: Record<PjDigestTemplateKey, { name: string; desc: string }[]> = {
  keuangan:        MONEY,
  keuangan_backup: [...MONEY, { name: "reason", desc: "alasan eskalasi (otomatis)" }],
  keanggotaan:     SUMMARY,
  toko:            SUMMARY,
  donasi:          SUMMARY,
  event:           SUMMARY,
};

/** Template yang WAJIB memuat {{url}} (tanpa tautan, bendahara tak bisa memverifikasi). */
export function pjTemplateRequiresUrl(k: PjDigestTemplateKey): boolean {
  return k === "keuangan" || k === "keuangan_backup";
}
