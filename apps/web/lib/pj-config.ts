// Konfigurasi Penanggung Jawab (PJ) notifikasi per modul — client-safe (nol import server).
// Disimpan di tenant.settings (group "notif", key PJ_CONFIG_KEY). Lihat
// docs/arsitektur-notifikasi-pengurus.md § 4.1 + § 8.

export const PJ_CONFIG_KEY = "officer_notification_config";

export const PJ_MODULES = ["keuangan", "keanggotaan", "toko", "donasi", "event"] as const;
export type PjModule = typeof PJ_MODULES[number];

export const PJ_MODULE_LABELS: Record<PjModule, { label: string; hint: string }> = {
  keuangan: {
    label: "Keuangan (Bendahara)",
    hint:  "Menerima ringkasan pembayaran yang belum diverifikasi (13.00, 16.00, 18.00) beserta tautan verifikasi tanpa login. Boleh sampai 3 orang — dikirim bergantian.",
  },
  keanggotaan: {
    label: "Keanggotaan (Sekretariat)",
    hint:  "Menerima ringkasan harian (16.00) anggota baru yang aktif dan yang perlu ditindaklanjuti.",
  },
  toko: {
    label: "Toko (Pesanan)",
    hint:  "Menerima ringkasan harian (16.00) pesanan yang sudah dibayar tetapi belum diproses.",
  },
  donasi: {
    label: "Donasi",
    hint:  "Menerima ringkasan harian (16.00) donasi yang masuk dalam 24 jam terakhir.",
  },
  event: {
    label: "Event (Pendaftar)",
    hint:  "Menerima ringkasan harian (16.00) pendaftar event baru dalam 24 jam terakhir.",
  },
};

export const PJ_MAX_TARGETS: Record<PjModule, number> = { keuangan: 3, keanggotaan: 1, toko: 1, donasi: 1, event: 1 };

export type PjTarget =
  | { type: "officer";  officerId: string }
  | { type: "division"; divisionId: string }
  | { type: "contact";  name: string; phone?: string; email?: string };

export type PjModuleConfig = { enabled: boolean; targets: PjTarget[] };
export type OfficerNotificationConfig = Partial<Record<PjModule, PjModuleConfig>>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validasi + bersihkan input mentah (dari klien) menjadi konfigurasi yang aman disimpan.
 * Nomor HP dinormalisasi oleh pemanggil (server action) lewat `normalizePhone` — di sini hanya
 * bentuk datanya. Baris tidak valid dibuang, bukan ditoleransi.
 */
export function sanitizePjConfig(
  input: unknown,
  normalizePhone: (raw: string) => string | null,
): OfficerNotificationConfig {
  const out: OfficerNotificationConfig = {};
  if (!input || typeof input !== "object") return out;
  const raw = input as Record<string, unknown>;

  for (const mod of PJ_MODULES) {
    const m = raw[mod];
    if (!m || typeof m !== "object") continue;
    const enabled = !!(m as { enabled?: unknown }).enabled;
    const rawTargets = Array.isArray((m as { targets?: unknown }).targets)
      ? ((m as { targets: unknown[] }).targets)
      : [];

    const targets: PjTarget[] = [];
    for (const t of rawTargets) {
      if (!t || typeof t !== "object") continue;
      const tt = t as Record<string, unknown>;
      if (tt.type === "officer" && typeof tt.officerId === "string" && UUID_RE.test(tt.officerId)) {
        targets.push({ type: "officer", officerId: tt.officerId });
      } else if (tt.type === "division" && typeof tt.divisionId === "string" && UUID_RE.test(tt.divisionId)) {
        targets.push({ type: "division", divisionId: tt.divisionId });
      } else if (tt.type === "contact") {
        const name  = typeof tt.name === "string" ? tt.name.trim().slice(0, 100) : "";
        const phone = typeof tt.phone === "string" && tt.phone.trim() ? normalizePhone(tt.phone.trim()) : null;
        const email = typeof tt.email === "string" && EMAIL_RE.test(tt.email.trim()) ? tt.email.trim().slice(0, 200) : null;
        if (!name || (!phone && !email)) continue;
        targets.push({ type: "contact", name, ...(phone ? { phone } : {}), ...(email ? { email } : {}) });
      }
      if (targets.length >= PJ_MAX_TARGETS[mod]) break;
    }
    out[mod] = { enabled, targets };
  }
  return out;
}
