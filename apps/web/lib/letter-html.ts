// Builder HTML surat untuk Playwright PDF
// Menghasilkan HTML lengkap: kop surat, isi, penandatangan + QR

import { renderBody } from "./letter-render";
import { resolveMergeFields, buildMergeContext } from "./letter-merge";
import { generateQrDataUrl, buildVerifyUrl } from "./qr-code";

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

type LetterHtmlParams = {
  letterNumber: string | null;
  letterDate:   string;
  subject:      string;
  sender:       string;
  recipient:    string;
  body:         string | null;
  template:     TemplateConfig;
  signers:      SignerInfo[];
  orgName:      string;
  orgAddress:   string;
  orgPhone:     string;
  orgEmail:     string;
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
  const { template, signers, orgName, orgAddress, orgPhone, orgEmail } = params;

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
  });

  const resolvedBody = resolveMergeFields(params.body ?? "", mergeCtx);
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

  const metaSection = `
    <table class="meta-table">
      ${params.letterNumber ? `
      <tr>
        <td class="meta-label">Nomor</td>
        <td class="meta-sep">:</td>
        <td>${escapeHtml(params.letterNumber)}</td>
      </tr>` : ""}
      <tr>
        <td class="meta-label">Perihal</td>
        <td class="meta-sep">:</td>
        <td>${escapeHtml(params.subject)}</td>
      </tr>
      <tr>
        <td class="meta-label">Tanggal</td>
        <td class="meta-sep">:</td>
        <td>${escapeHtml(params.letterDate)}</td>
      </tr>
    </table>
    <table class="meta-table meta-addr" style="margin-top: 16px">
      <tr>
        <td class="meta-label">Dari</td>
        <td class="meta-sep">:</td>
        <td>${escapeHtml(params.sender)}</td>
      </tr>
      <tr>
        <td class="meta-label">Kepada</td>
        <td class="meta-sep">:</td>
        <td>${escapeHtml(params.recipient)}</td>
      </tr>
    </table>`;

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

    /* Metadata surat */
    .meta-table { border-collapse: collapse; margin-top: 16px; font-size: 12pt; }
    .meta-label { width: 80px; vertical-align: top; }
    .meta-sep   { width: 14px; vertical-align: top; }

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
  ${metaSection}
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
