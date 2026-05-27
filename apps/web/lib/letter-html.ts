// Builder HTML surat untuk Playwright PDF
// Menghasilkan HTML lengkap: kop surat, identitas, tujuan, isi, penandatangan + QR

import { renderBody } from "./letter-render";
import { resolveMergeFields, buildMergeContext } from "./letter-merge";
import { generateQrDataUrl, buildVerifyUrl } from "./qr-code";
import {
  renderSignatureBlockHtml,
  SIGNATURE_CSS,
  type SignatureLayout,
  type SignatureSlot,
} from "./letter-signature-layout";

import { ID_MONTHS, formatHijri } from "./letter-date";

// ── Helpers tanggal ──────────────────────────────────────────────────────────

function formatLetterDate(
  letterDate: Date,
  format: "masehi" | "masehi_hijri",
  orgCity: string,
  hijriOffset = 0
): string {
  const dd   = letterDate.getDate();
  const mm   = letterDate.getMonth();
  const yyyy = letterDate.getFullYear();
  const masehiStr = `${dd} ${ID_MONTHS[mm]} ${yyyy}`;
  const prefix = orgCity ? `${orgCity}, ` : "";

  if (format === "masehi") {
    return `${prefix}${masehiStr}`;
  }

  // masehi_hijri — hasilkan dua baris HTML: Masehi di atas, Hijriah di bawah
  const hijriLine = formatHijri(letterDate, hijriOffset);
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

  // Layout 2: identitas kiri, tanggal kanan — sejajar (sama level dengan baris Nomor)
  return `
    <div class="identitas-layout2">
      <div class="id-kiri">${identitasTable}</div>
      <div class="id-kanan">${dateDiv}</div>
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

  // Tampilkan organisasi hanya jika berbeda dari recipientName
  // (mencegah duplikasi saat letter.recipient sudah berisi nama org yang sama)
  const normName = (recipientName ?? "").trim().toLowerCase();
  const normOrg  = (recipientOrganization ?? "").trim().toLowerCase();
  const orgLine  = normOrg && normOrg !== normName ? recipientOrganization : null;

  const lines = [
    "Kepada Yth.",
    recipientName,
    recipientTitle || null,
    orgLine,
    "di Tempat",
  ].filter((l): l is string => !!l);

  // recipientName (baris ke-2 setelah "Kepada Yth.") di-bold
  return `<div class="tujuan-surat">${lines.map((l, i) =>
    i === 1 ? `<p><strong>${escapeHtml(l)}</strong></p>` : `<p>${escapeHtml(l)}</p>`
  ).join("")}</div>`;
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
  slotOrder:        number;
  slotSection:      "main" | "witnesses";
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
  // Layout TTD — dari letters.signature_layout
  signatureLayout: SignatureLayout;
  // Warna primary dari settings.display (untuk QR barcode)
  primaryColor?:   string;
};

// ROLE_LABELS dipindah ke lib/letter-signature-layout.ts (SIGNER_ROLE_LABELS)

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
    primaryColor,
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

  // Generate QR untuk setiap penandatangan — warna sesuai primary color tenant
  const qrColor = primaryColor ?? "#000000";
  const signersWithQr = await Promise.all(
    signers.map(async (s) => {
      const verifyUrl = buildVerifyUrl(s.slug, s.verificationHash);
      const qrDataUrl = await generateQrDataUrl(verifyUrl, qrColor);
      return { ...s, qrDataUrl, verifyUrl };
    })
  );

  const mt = template.marginTop;
  const mr = template.marginRight;
  const mb = template.marginBottom;
  const ml = template.marginLeft;

  const hasFooter = !!template.footerImageUrl;

  // Kop surat — tampil di bagian atas halaman pertama
  // Jika ada header image: TIDAK ada kop-garis — gambar biasanya sudah punya garis sendiri
  // Jika hanya teks: kop-garis tetap ada sebagai pemisah
  const headerSection = template.headerImageUrl
    ? `<div class="kop-surat">
        <img src="${template.headerImageUrl}" alt="Kop Surat" class="kop-img" />
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

  // Konversi signers ke SignatureSlot[] untuk renderSignatureBlockHtml (Layer 1)
  // Jabatan dilengkapi nama tenant agar tampil lengkap di surat resmi, misal:
  // "Ketua 1" → "Ketua 1 IKPM Cabang DI Yogyakarta"
  const signatureSlots: (SignatureSlot & { qrDataUrl: string | null }) [] = signersWithQr.map((s) => ({
    id:           null,
    order:        s.slotOrder,
    section:      s.slotSection,
    officerId:    null,
    officerName:  s.name,
    position:     s.position && orgName ? `${s.position} ${orgName}` : (s.position ?? ""),
    division:     s.division,
    role:         s.role as "signer" | "approver" | "witness",
    signedAt:     s.signedAt,
    qrDataUrl:    s.qrDataUrl,
    verifyUrl:    s.verifyUrl,
    signingToken: null,
  }));

  // Tanggal TTD tidak ditampilkan di PDF — selalu off
  const signSection = renderSignatureBlockHtml(
    params.signatureLayout,
    signatureSlots,
    {
      showDate:    false,
      dateFormat:  params.dateFormat,
      hijriOffset: params.hijriOffset,
    }
  );

  // Font Google yang di-load via CDN — Playwright's Chromium tidak punya font ini sebagai sistem
  // System fonts (Times New Roman, Georgia, Arial) butuh fonts-liberation di VPS:
  //   sudo apt-get install -y fonts-liberation
  const GOOGLE_FONTS: Record<string, string> = {
    "Philosopher": "Philosopher:ital,wght@0,400;0,700;1,400;1,700",
    "Lora":        "Lora:ital,wght@0,400;0,600;0,700;1,400;1,600;1,700",
    "Open Sans":   "Open+Sans:ital,wght@0,400;0,600;0,700;1,400;1,600;1,700",
  };
  const googleFontParam = GOOGLE_FONTS[template.bodyFont];
  const googleFontLink = googleFontParam
    ? `<link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=${googleFontParam}&display=swap" rel="stylesheet">`
    : "";

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(params.subject)}</title>
  ${googleFontLink}
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

    /* Layout 2 — identitas kiri, tanggal kanan sejajar */
    .identitas-layout2 {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-top: 16px;
    }

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

    /* Penandatangan — dari letter-signature-layout.ts (Layer 1) */
    ${SIGNATURE_CSS}

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
