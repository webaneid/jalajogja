// Shared logic untuk sistem tanda tangan surat — zero React, zero DOM
// Dipakai oleh: signature-block.tsx, signature-slot-manager.tsx, letter-html.ts

// ── Definisi 7 Layout ────────────────────────────────────────────────────────

export const SIGNATURE_LAYOUTS = {
  "single-center":         { label: "1 TTD — Tengah",        mainSlots: 1 },
  "single-left":           { label: "1 TTD — Kiri",          mainSlots: 1 },
  "single-right":          { label: "1 TTD — Kanan",         mainSlots: 1 },
  "double":                { label: "2 TTD — Kiri & Kanan",  mainSlots: 2 },
  "triple-row":            { label: "3 TTD — Sejajar",       mainSlots: 3 },
  "triple-pyramid":        { label: "3 TTD — Piramid",       mainSlots: 3 },
  "double-with-witnesses": { label: "2 TTD + Kolom Saksi",   mainSlots: 2 },
} as const;

export type SignatureLayout = keyof typeof SIGNATURE_LAYOUTS;

export const SIGNATURE_LAYOUT_KEYS = Object.keys(SIGNATURE_LAYOUTS) as SignatureLayout[];

// ── Types ─────────────────────────────────────────────────────────────────────

export type SlotSection = "main" | "witnesses";

export type SlotRole = "signer" | "approver" | "witness";

export type SignatureSlot = {
  id:           string | null;   // letter_signatures.id — null jika belum ada di DB
  order:        number;          // 1, 2, 3... dalam section-nya
  section:      SlotSection;
  officerId:    string | null;   // null = belum di-assign
  officerName:  string | null;
  position:     string | null;
  division:     string | null;
  role:         SlotRole | null;
  signedAt:     Date | null;     // null = belum TTD
  qrDataUrl:    string | null;   // null = belum TTD atau optimistic state
  verifyUrl:    string | null;
  signingToken: string | null;   // UUID untuk URL publik /sign/{token}
};

export type SignatureConfig = {
  layout:   SignatureLayout;
  showDate: boolean;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Label slot berdasarkan layout dan urutan */
export function getSlotLabel(layout: SignatureLayout, slot: SignatureSlot): string {
  const { section, order } = slot;

  if (section === "witnesses") return `Saksi ${order}`;

  const mainCount = SIGNATURE_LAYOUTS[layout].mainSlots;

  if (mainCount === 1) return "Penandatangan";

  if (mainCount === 2) {
    if (order === 1) return "Kiri";
    if (order === 2) return "Kanan";
  }

  if (mainCount === 3) {
    if (layout === "triple-pyramid") {
      if (order === 1) return "Kiri Atas";
      if (order === 2) return "Kanan Atas";
      if (order === 3) return "Tengah Bawah";
    }
    if (order === 1) return "Kiri";
    if (order === 2) return "Tengah";
    if (order === 3) return "Kanan";
  }

  return `Slot ${order}`;
}

/** Buat array slot kosong sesuai jumlah main slots layout (untuk preview) */
export function buildEmptyMainSlots(layout: SignatureLayout): SignatureSlot[] {
  const count = SIGNATURE_LAYOUTS[layout].mainSlots;
  return Array.from({ length: count }, (_, i) => ({
    id:           null,
    order:        i + 1,
    section:      "main" as SlotSection,
    officerId:    null,
    officerName:  null,
    position:     null,
    division:     null,
    role:         null,
    signedAt:     null,
    qrDataUrl:    null,
    verifyUrl:    null,
    signingToken: null,
  }));
}

/** Label role penandatangan */
export const SIGNER_ROLE_LABELS: Record<SlotRole, string> = {
  signer:   "Penandatangan",
  approver: "Penyetuju",
  witness:  "Saksi",
};

// ── Format Tanggal TTD ────────────────────────────────────────────────────────
// Format tanggal TTD TIDAK punya setting sendiri — selalu mengikuti letter_config
// dari /letters/pengaturan (date_format + hijri_offset).
// Kota TIDAK ditampilkan di blok TTD (kota hanya untuk header surat).

const ID_MONTHS = [
  "Januari","Februari","Maret","April","Mei","Juni",
  "Juli","Agustus","September","Oktober","November","Desember",
];

const HIJRI_MONTHS = [
  "Muharram","Safar","Rabiul Awal","Rabiul Akhir",
  "Jumadil Awal","Jumadil Akhir","Rajab","Sya'ban",
  "Ramadan","Syawal","Dzulqa'dah","Dzulhijjah",
];

/**
 * Format tanggal untuk blok TTD — tanpa kota, pakai date_format + hijri_offset
 * dari letter_config (/letters/pengaturan).
 * Output berupa array baris (max 2 baris untuk masehi_hijri).
 */
export function formatSignatureDate(
  date: Date,
  dateFormat: "masehi" | "masehi_hijri",
  hijriOffset = 0
): string[] {
  const dd   = date.getDate();
  const mm   = date.getMonth();
  const yyyy = date.getFullYear();
  const masehiLine = `${dd} ${ID_MONTHS[mm]} ${yyyy}`;

  if (dateFormat === "masehi") {
    return [masehiLine];
  }

  // masehi_hijri — hitung tanggal Hijriah
  const shifted = new Date(date);
  shifted.setDate(shifted.getDate() + hijriOffset);

  let hijriLine = "";
  try {
    const parts = new Intl.DateTimeFormat("id-ID-u-ca-islamic-umalqura", {
      year: "numeric", month: "numeric", day: "numeric",
    }).formatToParts(shifted);
    const hDay   = Number(parts.find((p) => p.type === "day")?.value   ?? "0");
    const hMonth = Number(parts.find((p) => p.type === "month")?.value ?? "1");
    const hYear  = Number(parts.find((p) => p.type === "year")?.value  ?? "0");
    hijriLine = `${hDay} ${HIJRI_MONTHS[(hMonth - 1) % 12]} ${hYear} H`;
  } catch {
    hijriLine = "";
  }

  return hijriLine
    ? [`${masehiLine} M`, hijriLine]
    : [masehiLine];
}

// ── HTML Generator (untuk PDF via letter-html.ts) ────────────────────────────

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type HtmlSlot = SignatureSlot & { qrDataUrl: string | null };

/**
 * Generate HTML string blok TTD untuk PDF (Playwright).
 * Dipanggil dari letter-html.ts — menggantikan signSection hardcoded.
 */
export function renderSignatureBlockHtml(
  layout: SignatureLayout,
  slots:  HtmlSlot[],
  opts: {
    showDate:    boolean;
    dateFormat:  "masehi" | "masehi_hijri";
    hijriOffset: number;
  }
): string {
  if (slots.length === 0) return "";

  const mainSlots     = slots.filter((s) => s.section === "main").sort((a, b) => a.order - b.order);
  const witnessSlots  = slots.filter((s) => s.section === "witnesses").sort((a, b) => a.order - b.order);

  function renderSlot(slot: HtmlSlot, label: string): string {
    const name     = slot.officerName ?? "_______________";
    const pos      = slot.position   ?? "";
    const div      = slot.division   ?? "";
    const roleLabel = slot.role ? (SIGNER_ROLE_LABELS[slot.role] ?? slot.role) : label;

    const dateLines = (opts.showDate && slot.signedAt)
      ? formatSignatureDate(slot.signedAt, opts.dateFormat, opts.hijriOffset)
      : [];

    const qrHtml = slot.qrDataUrl
      ? `<img src="${slot.qrDataUrl}" alt="QR Verifikasi" class="qr-img" />`
      : `<div class="qr-placeholder"></div>`;

    const dateHtml = dateLines.length > 0
      ? dateLines.map((l) => `<p class="signer-date">${escHtml(l)}</p>`).join("")
      : "";

    return `
      <div class="signer-block">
        <p class="signer-role">${escHtml(roleLabel)}</p>
        ${qrHtml}
        <p class="signer-name">${escHtml(name)}</p>
        ${pos ? `<p class="signer-pos">${escHtml(pos)}${div ? ` / ${escHtml(div)}` : ""}</p>` : ""}
        ${dateHtml}
      </div>`;
  }

  // ── Render sesuai layout ──
  let mainHtml = "";

  if (layout === "triple-pyramid" && mainSlots.length === 3) {
    const [s1, s2, s3] = mainSlots;
    mainHtml = `
      <div class="sign-row sign-space-between">
        ${renderSlot(s1, getSlotLabel(layout, s1))}
        ${renderSlot(s2, getSlotLabel(layout, s2))}
      </div>
      <div class="sign-row sign-center" style="margin-top:12px;">
        ${renderSlot(s3, getSlotLabel(layout, s3))}
      </div>`;
  } else {
    const justifyMap: Record<SignatureLayout, string> = {
      "single-center":         "sign-center",
      "single-left":           "sign-start",
      "single-right":          "sign-end",
      "double":                "sign-space-between",
      "triple-row":            "sign-space-between",
      "triple-pyramid":        "sign-space-between", // fallback
      "double-with-witnesses": "sign-space-between",
    };
    const cls = justifyMap[layout] ?? "sign-center";
    mainHtml = `
      <div class="sign-row ${cls}">
        ${mainSlots.map((s) => renderSlot(s, getSlotLabel(layout, s))).join("")}
      </div>`;
  }

  // Witness grid (3 kolom, hanya untuk double-with-witnesses)
  let witnessHtml = "";
  if (witnessSlots.length > 0) {
    witnessHtml = `
      <div class="sign-witnesses">
        <p class="sign-witness-label">Saksi:</p>
        <div class="sign-witness-grid">
          ${witnessSlots.map((s) => renderSlot(s, getSlotLabel(layout, s))).join("")}
        </div>
      </div>`;
  }

  return `
    <div class="sign-section">
      ${mainHtml}
      ${witnessHtml}
    </div>`;
}

/**
 * CSS classes untuk blok TTD — dimasukkan ke <style> di letter-html.ts
 */
export const SIGNATURE_CSS = `
  .sign-section      { margin-top: 32px; page-break-inside: avoid; }
  .sign-row          { display: flex; flex-wrap: wrap; gap: 24px; }
  .sign-center       { justify-content: center; }
  .sign-start        { justify-content: flex-start; }
  .sign-end          { justify-content: flex-end; }
  .sign-space-between{ justify-content: space-between; }
  .sign-witnesses    { margin-top: 20px; }
  .sign-witness-label{ font-size: 11pt; margin-bottom: 8px; }
  .sign-witness-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
  .signer-block      { display: flex; flex-direction: column; align-items: center; min-width: 130px; }
  .signer-role       { font-size: 10pt; margin-bottom: 6px; color: #333; }
  .qr-img            { width: 90px; height: 90px; border: 1px solid #ccc; }
  .qr-placeholder    { width: 90px; height: 90px; border: 1px dashed #bbb; background: #f9f9f9; }
  .signer-name       { font-size: 11pt; font-weight: bold; margin-top: 6px; text-align: center; }
  .signer-pos        { font-size: 9pt; text-align: center; color: #333; margin-top: 2px; }
  .signer-date       { font-size: 8pt; color: #666; margin-top: 2px; text-align: center; }
`;
