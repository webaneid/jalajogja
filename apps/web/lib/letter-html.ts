// Builder HTML surat untuk Playwright PDF
// Menghasilkan HTML lengkap: kop surat, identitas, tujuan, isi, penandatangan + QR

import { renderBody } from "./letter-render";
import { resolveMergeFields, buildMergeContext } from "./letter-merge";
import { generateQrDataUrl, buildVerifyUrl } from "./qr-code";

// ── Helpers tanggal ──────────────────────────────────────────────────────────

const ID_MONTHS_HTML = [
  "Januari","Februari","Maret","April","Mei","Juni",
  "Juli","Agustus","September","Oktober","November","Desember",
] as const;

const HIJRI_MONTHS_HTML = [
  "Muharram","Safar","Rabiul Awal","Rabiul Akhir",
  "Jumadil Awal","Jumadil Akhir","Rajab","Sya'ban",
  "Ramadan","Syawal","Dzulqa'dah","Dzulhijjah",
] as const;

function formatLetterDate(
  letterDate: Date,
  format: "masehi" | "masehi_hijri",
  orgCity: string,
  hijriOffset = 0
): string {
  const dd   = letterDate.getDate();
  const mm   = letterDate.getMonth();
  const yyyy = letterDate.getFullYear();
  const masehiStr = `${dd} ${ID_MONTHS_HTML[mm]} ${yyyy}`;
  const prefix = orgCity ? `${orgCity}, ` : "";

  if (format === "masehi") {
    return `${prefix}${masehiStr}`;
  }

  // masehi_hijri — hitung Hijriah, hasilkan dua baris HTML
  const shifted = new Date(letterDate);
  shifted.setDate(shifted.getDate() + hijriOffset);
  let hijriLine = "";
  try {
    const parts = new Intl.DateTimeFormat("id-ID-u-ca-islamic-umalqura", {
      year: "numeric", month: "numeric", day: "numeric",
    }).formatToParts(shifted);
    const hDay   = Number(parts.find((p) => p.type === "day")?.value   ?? "0");
    const hMonth = Number(parts.find((p) => p.type === "month")?.value ?? "1");
    const hYear  = Number(parts.find((p) => p.type === "year")?.value  ?? "0");
    hijriLine = `${hDay} ${HIJRI_MONTHS_HTML[(hMonth - 1) % 12]} ${hYear} H`;
  } catch {
    hijriLine = "";
  }
  return `${prefix}${masehiStr} M<br><hr style="border:none;border-top:0.5px solid currentColor;opacity:0.4;margin:2px 0;">${hijriLine}`;
}

// ── Identitas Surat ──────────────────────────────────────────────────────────

type IdentitasParams = {
  identitasLayout: "layout1" | "layout2" | "layout3";
  dateFormat:      "masehi" | "masehi_hijri";
  letterNumber:    string | null;
  subject:         string;
  attachmentLabel: string | null;
  showLampiran:    boolean;
  letterDate:      Date;
  orgCity:         string;
  letterTypeName:  string;
  hijriOffset:     number;
};

function renderIdentitasSurat(p: IdentitasParams): string {
  const dateHtml = formatLetterDate(p.letterDate, p.dateFormat, p.orgCity, p.hijriOffset);

  if (p.identitasLayout === "layout3") {
    // Terpusat — nama jenis surat besar + nomor. Tanggal di bawah TTD.
    return `
      <div class="identitas-layout3">
        <p class="identitas-jenis">${escapeHtml(p.letterTypeName).toUpperCase()}</p>
        ${p.letterNumber ? `<p class="identitas-nomor">Nomor: ${escapeHtml(p.letterNumber)}</p>` : ""}
      </div>`;
  }

  const rows: string[] = [];
  if (p.letterNumber) {
    rows.push(`<tr><td class="id-label">Nomor</td><td class="id-sep">:</td><td>${escapeHtml(p.letterNumber)}</td></tr>`);
  }
  if (p.showLampiran) {
    rows.push(`<tr><td class="id-label">Lampiran</td><td class="id-sep">:</td><td>${escapeHtml(p.attachmentLabel || "—")}</td></tr>`);
  }
  rows.push(`<tr><td class="id-label">Hal</td><td class="id-sep">:</td><td>${escapeHtml(p.subject)}</td></tr>`);

  const identitasTable = `<table class="id-table">${rows.join("")}</table>`;
  const dateDiv = `<div class="id-tanggal">${dateHtml}</div>`;

  if (p.identitasLayout === "layout1") {
    // Dua kolom: identitas kiri, tanggal kanan sejajar baris pertama
    return `
      <div class="identitas-layout1">
        <div class="id-kiri">${identitasTable}</div>
        <div class="id-kanan">${dateDiv}</div>
      </div>`;
  }

  // Layout 2: tanggal pojok kanan atas, identitas di bawah
  return `
    <div class="identitas-layout2">
      <div class="id-tanggal-atas">${dateDiv}</div>
      ${identitasTable}
    </div>`;
}

// ── Tujuan Surat ─────────────────────────────────────────────────────────────

function renderTujuanSurat(
  recipientName:         string | null,
  recipientTitle:        string | null,
  recipientOrganization: string | null,
  showTujuan:            boolean
): string {
  if (!showTujuan || !recipientName?.trim()) return "";

  const lines = [
    "Kepada Yth.",
    recipientName,
    recipientTitle        || null,
    recipientOrganization || null,
    "di Tempat",
  ].filter((l): l is string => !!l);

  return `<div class="tujuan-surat">${lines.map((l) => `<p>${escapeHtml(l)}</p>`).join("")}</div>`;
}

// Lebar kertas tepat per ukuran (presisi sesuai standar cetak)
// A4     : 210mm lebar, tinggi menyesuaikan konten
// F4     : 215mm lebar (Folio Indonesia), tinggi 330mm
// Letter : 215.9mm lebar (8.5"), tinggi 279.4mm (11")

type TemplateConfig = {
  bodyFont:       string;
  marginTop:      number;
  marginRight:    number;
  marginBottom:   number;
  marginLeft:     number;
  headerImageUrl: string | null;
  footerImageUrl: string | null;
  paperSize:      "A4" | "F4" | "Letter";
};

type SignerInfo = {
  name:             string;
  position:         string;
  division:         string | null;
  role:             string;
  signedAt:         Date;
  verificationHash: string;
  slug:             string;
};

type RecipientData = {
  title:        string;
  organization: string;
  address:      string;
  phone:        string;
  email:        string;
};

type LetterHtmlParams = {
  letterNumber:    string | null;
  letterDate:      string;   // ISO date string dari DB
  subject:         string;
  sender:          string;
  recipient:       string;
  recipientData?:  RecipientData;
  body:            string | null;
  template:        TemplateConfig;
  signers:         SignerInfo[];
  orgName:         string;
  orgAddress:      string;
  orgPhone:        string;
  orgEmail:        string;
  // Identitas Surat
  identitasLayout:  "layout1" | "layout2" | "layout3";
  dateFormat:       "masehi" | "masehi_hijri";
  attachmentLabel:  string | null;
  showLampiran:     boolean;
  letterTypeName:   string;
  orgCity:          string;   // kota dari settings.contact_address (regency name)
  hijriOffset:      number;
};

const ROLE_LABELS: Record<string, string> = {
  signer:   "Penandatangan",
  approver: "Penyetuju",
  witness:  "Saksi",
};

// Konversi paper size ke dimensi Playwright — presisi lebar per standar cetak
export function paperFormat(size: string): { format?: string; width?: string; height?: string } {
  // F4 / Folio Indonesia: 215mm × 330mm (bukan A4 210mm)
  if (size === "F4") return { width: "215mm", height: "330mm" };
  // Letter US: 215.9mm × 279.4mm — Playwright sudah tahu dimensinya
  if (size === "Letter") return { format: "Letter" };
  // A4: 210mm × 297mm — default
  return { format: "A4" };
}

// Build full HTML surat — siap dirender Playwright
export async function buildLetterHtml(params: LetterHtmlParams): Promise<string> {
  const {
    template, signers, orgName, orgAddress, orgPhone, orgEmail,
    identitasLayout, dateFormat, attachmentLabel, showLampiran,
    letterTypeName, orgCity, hijriOffset,
  } = params;

  // Parse letterDate dari ISO string ke Date object untuk kalkulasi format
  const letterDateObj = params.letterDate ? new Date(params.letterDate) : new Date();

  const mergeCtx = buildMergeContext({
    orgName,
    orgAddress,
    orgPhone,
    orgEmail,
    letterNumber: params.letterNumber ?? "",
    letterDate:   params.letterDate,
    subject:      params.subject,
    sender:       params.sender,
    recipient:    params.recipient,
    signers: signers.map((s) => ({
      name:     s.name,
      position: s.position,
      division: s.division ?? "",
    })),
    recipientData: {
      name:         params.recipient,
      title:        params.recipientData?.title        ?? "",
      organization: params.recipientData?.organization ?? "",
      address:      params.recipientData?.address      ?? "",
      phone:        params.recipientData?.phone        ?? "",
      email:        params.recipientData?.email        ?? "",
    },
  });

  const resolvedBody = resolveMergeFields(params.body ?? "", mergeCtx, hijriOffset);
  const bodyHtml     = renderBody(resolvedBody);

  // Generate QR untuk setiap penandatangan
  const signersWithQr = await Promise.all(
    signers.map(async (s) => {
      const verifyUrl = buildVerifyUrl(s.slug, s.verificationHash);
      const qrDataUrl = await generateQrDataUrl(verifyUrl);
      return { ...s, qrDataUrl, verifyUrl };
    })
  );

  const mt = template.marginTop;
  const mr = template.marginRight;
  const mb = template.marginBottom;
  const ml = template.marginLeft;

  const hasFooter = !!template.footerImageUrl;

  // Kop surat — tampil di bagian atas halaman pertama
  const headerSection = template.headerImageUrl
    ? `<div class="kop-surat">
        <img src="${template.headerImageUrl}" alt="Kop Surat" class="kop-img" />
        <div class="kop-garis"></div>
       </div>`
    : `<div class="kop-surat kop-text">
        <h1 class="org-name">${escapeHtml(orgName)}</h1>
        ${orgAddress ? `<p class="org-detail">${escapeHtml(orgAddress)}</p>` : ""}
        ${orgPhone || orgEmail ? `<p class="org-detail">${[orgPhone, orgEmail].filter(Boolean).map(escapeHtml).join(" | ")}</p>` : ""}
        <div class="kop-garis"></div>
       </div>`;

  // Footer — fixed di bawah SETIAP halaman PDF via position:fixed
  const footerSection = hasFooter
    ? `<div class="footer-surat">
        <img src="${template.footerImageUrl}" alt="Footer" class="footer-img" />
       </div>`
    : "";

  // Identitas surat (Layout 1/2/3) + Tujuan surat
  const identitasHtml = renderIdentitasSurat({
    identitasLayout,
    dateFormat,
    letterNumber:    params.letterNumber,
    subject:         params.subject,
    attachmentLabel: attachmentLabel,
    showLampiran,
    letterDate:      letterDateObj,
    orgCity,
    letterTypeName,
    hijriOffset,
  });

  // Layout 3 tidak menampilkan tujuan surat
  const tujuanHtml = renderTujuanSurat(
    params.recipient || null,
    params.recipientData?.title        || null,
    params.recipientData?.organization || null,
    identitasLayout !== "layout3"
  );

  const signSection = signersWithQr.length > 0
    ? `<div class="sign-section">
        ${signersWithQr.map((s) => `
          <div class="signer-block">
            <p class="signer-role">${escapeHtml(ROLE_LABELS[s.role] ?? s.role)}</p>
            <img src="${s.qrDataUrl}" alt="QR Verifikasi" class="qr-img" />
            <p class="signer-name">${escapeHtml(s.name)}</p>
            <p class="signer-pos">${escapeHtml(s.position)}${s.division ? ` / ${escapeHtml(s.division)}` : ""}</p>
            <p class="signer-date">${new Date(s.signedAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>
          </div>`).join("")}
       </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(params.subject)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    /* @page mengontrol margin PDF — tidak dobel dengan Playwright margin option */
    @page {
      margin: ${mt}mm ${mr}mm ${mb}mm ${ml}mm;
    }

    body {
      font-family: "${template.bodyFont}", "Times New Roman", serif;
      font-size: 12pt;
      line-height: 1.6;
      color: #000;
      background: #fff;
      /* Sisakan ruang di bawah untuk footer fixed (jika ada) */
      ${hasFooter ? "padding-bottom: 36mm;" : ""}
    }

    /* Kop surat — inline, muncul sekali di atas halaman pertama */
    .kop-surat { margin-bottom: 8px; }
    .kop-img   { width: 100%; object-fit: contain; object-position: top; display: block; }
    .kop-garis { border-bottom: 3px solid #000; margin-top: 4px; }
    .kop-text  { text-align: center; }
    .org-name  { font-size: 16pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
    .org-detail { font-size: 10pt; margin-top: 2px; }

    /* Identitas Surat */
    /* Layout 1 — dua kolom */
    .identitas-layout1 {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-top: 16px;
    }
    .id-kiri  { flex: 1; }
    .id-kanan { text-align: right; white-space: nowrap; }
    .id-tanggal { font-size: 12pt; }

    /* Layout 2 — tanggal pojok kanan atas */
    .identitas-layout2 { margin-top: 16px; }
    .id-tanggal-atas { text-align: right; margin-bottom: 8px; font-size: 12pt; }

    /* Layout 3 — terpusat */
    .identitas-layout3 { text-align: center; margin-top: 16px; }
    .identitas-jenis   { font-size: 14pt; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
    .identitas-nomor   { font-size: 12pt; margin-top: 4px; }

    /* Tabel identitas (Layout 1 & 2) */
    .id-table    { border-collapse: collapse; font-size: 12pt; }
    .id-label    { width: 80px; vertical-align: top; }
    .id-sep      { width: 14px; vertical-align: top; }

    /* Tujuan Surat */
    .tujuan-surat { margin-top: 20px; font-size: 12pt; line-height: 1.8; }

    /* Body */
    .body-surat { margin-top: 20px; font-size: 12pt; text-align: justify; }
    .body-surat p   { margin-bottom: 8px; }
    .body-surat ul,
    .body-surat ol  { margin-left: 24px; margin-bottom: 8px; }
    .body-surat li  { margin-bottom: 4px; }
    .body-surat strong { font-weight: bold; }
    .body-surat em     { font-style: italic; }
    .body-surat u      { text-decoration: underline; }
    .body-surat table  { border-collapse: collapse; width: 100%; }
    .body-surat th,
    .body-surat td     { border: 1px solid #000; padding: 4px 8px; }

    /* Penandatangan */
    .sign-section {
      display: flex;
      flex-wrap: wrap;
      gap: 24px;
      margin-top: 32px;
      page-break-inside: avoid;
    }
    .signer-block {
      display: flex;
      flex-direction: column;
      align-items: center;
      min-width: 140px;
    }
    .signer-role { font-size: 10pt; margin-bottom: 6px; color: #333; }
    .qr-img      { width: 90px; height: 90px; border: 1px solid #ccc; }
    .signer-name { font-size: 11pt; font-weight: bold; margin-top: 6px; text-align: center; }
    .signer-pos  { font-size: 9pt; text-align: center; color: #333; margin-top: 2px; }
    .signer-date { font-size: 8pt; color: #666; margin-top: 2px; }

    /* Footer — fixed di bawah SETIAP halaman PDF */
    .footer-surat {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
    }
    .footer-img {
      width: 100%;
      display: block;
      object-fit: contain;
      object-position: bottom;
    }
  </style>
</head>
<body>
  ${headerSection}
  ${identitasHtml}
  ${tujuanHtml}
  <div class="body-surat">${bodyHtml}</div>
  ${signSection}
  ${footerSection}
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
