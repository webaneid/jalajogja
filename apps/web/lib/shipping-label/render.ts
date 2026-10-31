// Mesin render label pengiriman: LabelData[] + format → dokumen HTML siap-cetak (Playwright mengubahnya jadi PDF).
// Murni fungsi (tanpa DB/jaringan) — data diisi pemanggil. Barcode Code128 lewat bwip-js (SVG vektor, tajam di thermal).
// Desain: monokrom (aman untuk printer thermal hitam-putih), hierarki tipografi tegas, COD tampil inversi hitam agar tak terlewat.
// Doc: docs/arsitektur-portal-produsen.md § 21.
import bwipjs from "bwip-js";
import { FORMAT_SPECS, type FormatSpec } from "./formats";
import type { LabelData, LabelFormat } from "./types";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const SERVICE_LABEL: Record<string, string> = { REG: "REGULER", REGULER: "REGULER", YES: "YES", OKE: "OKE", ECO: "EKONOMI", CTC: "CTC", BEST: "BEST", SDS: "SAME DAY", ONS: "ONE NIGHT" };
export const serviceLabel = (code: string) => (SERVICE_LABEL[code.toUpperCase()] ?? code.toUpperCase());

/** Barcode Code128 sebagai SVG yang melebar penuh (lebar mengikuti wadah, tinggi tetap dalam mm). */
function barcode(text: string, heightMm: number): string {
  const raw = bwipjs.toSVG({ bcid: "code128", text, scale: 3, height: 10, includetext: false, paddingwidth: 0, paddingheight: 0 });
  const m = /<svg[^>]*viewBox="([^"]+)"[^>]*>([\s\S]*)<\/svg>/.exec(raw);
  if (!m) return "";
  return `<svg class="bc" viewBox="${m[1]}" preserveAspectRatio="none" style="height:${heightMm}mm" shape-rendering="crispEdges">${m[2]}</svg>`;
}

const ICON = {
  user: `<svg viewBox="0 0 24 24" class="ic"><path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-4 0-8 2-8 5v3h16v-3c0-3-4-5-8-5z"/></svg>`,
  phone: `<svg viewBox="0 0 24 24" class="ic"><path d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11 11 0 0 0 3.6.6 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.250.2 2.450.6 3.600a1 1 0 0 1-.25 1z"/></svg>`,
  pin: `<svg viewBox="0 0 24 24" class="ic"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.500A2.500 2.500 0 1 1 12 6.500a2.500 2.500 0 0 1 0 5z"/></svg>`,
};

const itemsText = (l: LabelData) =>
  l.items.map((i) => `${esc(i.name)}${i.variant ? ` <span class="v">(${esc(i.variant)})</span>` : ""} <b>×${i.qty}</b>`).join(" · ");

function party(title: string, p: LabelData["receiver"], cls = ""): string {
  return `<div class="party ${cls}"><div class="pt">${title}</div><div class="pb">
    <div class="r">${ICON.user}<span class="nm">${esc(p.name)}</span></div>
    <div class="r">${ICON.phone}<span>${esc(p.phone)}</span></div>
    <div class="r a">${ICON.pin}<span class="ad">${esc(p.address)}</span></div>
  </div></div>`;
}

function courierMark(l: LabelData, h: string): string {
  return l.courierLogo
    ? `<img class="clogo" style="height:${h}" src="${l.courierLogo}" alt="${esc(l.courierName)}">`
    : `<span class="cbadge">${esc(l.courierName)}</span>`;
}
function brand(l: LabelData, logoH: string, withMember = true): string {
  return `<div class="brand">
    ${withMember ? `<div class="mem">Member of <b>${esc(l.tenantName)}</b></div>` : ""}
    <div class="logos">
      ${l.tenantLogo ? `<img class="tlogo" style="height:${logoH}" src="${l.tenantLogo}" alt="${esc(l.tenantName)}">` : `<span class="tname">${esc(l.tenantName)}</span>`}
      <span class="sep"></span>${courierMark(l, logoH)}
    </div>
  </div>`;
}
const codBox = (l: LabelData) => l.isCod
  ? `<div class="cod on"><div class="c1">COD</div><div class="c2">Tagih ${esc(l.codAmountLabel ?? "")}</div></div>`
  : `<div class="cod"><div class="c1">NON-COD</div><div class="c2">(BUKAN-COD)</div></div>`;
const noteText = (l: LabelData) => (l.note?.trim() ? esc(l.note.trim()) : "—");

// ── Varian tata letak ───────────────────────────────────────────────────────────────────────────────────

function wide(l: LabelData): string {
  return `
  <div class="hd">
    ${brand(l, "9.5mm")}
    <div class="inv">${barcode(l.invoiceNumber, 9)}<div class="invno">No. Invoice : <b>${esc(l.invoiceNumber)}</b></div></div>
  </div>
  <div class="svcrow"><span class="svc">${esc(serviceLabel(l.service))}</span><span class="wt">Berat: <b>${esc(l.weightLabel)}</b></span></div>
  <div class="parties">${party("PENGIRIM", l.sender)}${party("PENERIMA", l.receiver)}</div>
  <div class="mid">${codBox(l)}<div class="meta">${l.batchName ? `${barcode(l.batchName, 8)}<div class="mline"><span>Batch: <b>${esc(l.batchName)}</b></span><span>Dibuat: ${esc(l.createdAtLabel)}</span></div>` : `<div class="mline solo"><span>Dibuat pada</span><b>${esc(l.createdAtLabel)}</b></div>`}</div></div>
  <div class="box"><span class="k">ISI PAKET :</span> <span class="clamp2">${itemsText(l)}</span></div>
  <div class="box"><span class="k">INSTRUKSI PENGIRIMAN :</span> <span class="clamp1">${noteText(l)}</span></div>`;
}

function tall(l: LabelData): string {
  return `
  <div class="hd stack">${brand(l, "11mm")}</div>
  <div class="inv full">${barcode(l.invoiceNumber, 13)}<div class="invno center">No. Invoice : <b>${esc(l.invoiceNumber)}</b></div></div>
  <div class="svcrow"><span class="svc">${esc(serviceLabel(l.service))}</span><span class="wt">Berat: <b>${esc(l.weightLabel)}</b></span></div>
  ${party("PENERIMA", l.receiver, "big")}
  ${party("PENGIRIM", l.sender, "small")}
  <div class="mid slim">${codBox(l)}<div class="meta">${l.batchName ? `${barcode(l.batchName, 7)}<div class="mline"><span>Batch: <b>${esc(l.batchName)}</b></span></div>` : ""}<div class="mline solo"><span>Dibuat pada</span><b>${esc(l.createdAtLabel)}</b></div></div></div>
  <div class="box"><span class="k">ISI PAKET :</span> <span class="clamp3">${itemsText(l)}</span></div>
  <div class="box"><span class="k">INSTRUKSI :</span> <span class="clamp2">${noteText(l)}</span></div>`;
}

function compact(l: LabelData): string {
  return `
  <div class="hd">${brand(l, "6.5mm")}<div class="inv">${barcode(l.invoiceNumber, 7)}<div class="invno">${esc(l.invoiceNumber)}</div></div></div>
  <div class="svcrow"><span class="svc">${esc(serviceLabel(l.service))}</span>${l.isCod ? `<span class="codtag on">COD · ${esc(l.codAmountLabel ?? "")}</span>` : `<span class="codtag">NON-COD</span>`}<span class="wt"><b>${esc(l.weightLabel)}</b></span></div>
  ${party("PENERIMA", l.receiver, "big")}
  ${party("PENGIRIM", l.sender, "small")}
  <div class="box"><span class="k">ISI :</span> <span class="clamp2">${itemsText(l)}</span></div>
  <div class="foot"><span>${l.batchName ? `Batch ${esc(l.batchName)} · ` : ""}${esc(l.createdAtLabel)}</span></div>`;
}

function mini(l: LabelData): string {
  return `
  <div class="mhd"><span class="mt">${esc(l.tenantName)}</span><span class="mc">${esc(l.courierName)} ${esc(serviceLabel(l.service))}</span>${l.isCod ? `<span class="codtag on">COD</span>` : ""}</div>
  <div class="inv full">${barcode(l.invoiceNumber, 8)}<div class="invno center">${esc(l.invoiceNumber)} · ${esc(l.weightLabel)}</div></div>
  <div class="mto"><div class="nm">${esc(l.receiver.name)} · ${esc(l.receiver.phone)}</div><div class="ad clamp3">${esc(l.receiver.address)}</div></div>
  <div class="mfrom">Dari: <b>${esc(l.sender.name)}</b> · ${esc(l.sender.phone)}</div>
  <div class="mitems clamp1">${itemsText(l)}</div>`;
}

const VARIANT: Record<FormatSpec["layout"], (l: LabelData) => string> = { wide, tall, compact, mini };

// ── CSS ─────────────────────────────────────────────────────────────────────────────────────────────────
const css = (spec: FormatSpec) => `
@page { size: ${spec.page.w}mm ${spec.page.h}mm; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { font-family: "Inter", "Helvetica Neue", Arial, "Liberation Sans", sans-serif; color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.page { width: ${spec.page.w}mm; height: ${spec.page.h}mm; padding: ${spec.margin}mm; break-after: page; overflow: hidden;
  display: grid; grid-template-columns: repeat(${spec.cols}, ${spec.label.w}mm); grid-auto-rows: ${spec.label.h}mm; gap: ${spec.gap}mm; align-content: start; justify-content: start; }
.page:last-child { break-after: auto; }
.lb { --fs: ${spec.fontPt}pt; width: ${spec.label.w}mm; height: ${spec.label.h}mm; border: 0.35mm solid #000; border-radius: 1.8mm; padding: 2mm;
  display: flex; flex-direction: column; gap: 1.3mm; overflow: hidden; font-size: var(--fs); line-height: 1.22; }
.lb.mini { padding: 1.4mm; gap: 0.8mm; border-width: 0.3mm; border-radius: 1.2mm; }
.lb.compact { padding: 1.7mm; gap: 1mm; }
.ic { width: 0.95em; height: 0.95em; flex: none; fill: #000; margin-top: 0.12em; }
b { font-weight: 700; }
.v { font-weight: 400; }
.hd { display: grid; grid-template-columns: 1fr 44%; gap: 2.5mm; align-items: start; }
.hd.stack { grid-template-columns: 1fr; }
.brand .mem { font-size: 0.78em; letter-spacing: 0.02em; color: #222; margin-bottom: 0.7mm; }
.brand .mem b { text-transform: uppercase; letter-spacing: 0.04em; }
.logos { display: flex; align-items: center; gap: 2mm; min-height: 6mm; }
.tlogo, .clogo { width: auto; max-width: 42%; object-fit: contain; display: block; }
.tname { font-weight: 800; font-size: 1.25em; letter-spacing: -0.01em; }
.sep { width: 0.3mm; align-self: stretch; background: #000; opacity: 0.35; }
.cbadge { border: 0.35mm solid #000; border-radius: 1mm; padding: 0.4mm 1.6mm; font-weight: 800; font-size: 1.02em; text-transform: uppercase; letter-spacing: 0.02em; white-space: nowrap; }
.bc { display: block; width: 100%; }
.inv.full .bc { margin: 0 auto; }
.invno { font-size: 0.82em; margin-top: 0.7mm; text-align: right; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.invno.center { text-align: center; }
.svcrow { display: flex; align-items: center; justify-content: space-between; gap: 2mm; }
.svc { background: #000; color: #fff; font-weight: 800; letter-spacing: 0.05em; padding: 0.7mm 3.2mm; border-radius: 0.9mm; font-size: 1.28em; }
.wt { font-size: 1.12em; }
.codtag { border: 0.3mm solid #000; border-radius: 0.8mm; padding: 0.4mm 1.6mm; font-weight: 700; font-size: 0.92em; white-space: nowrap; }
.codtag.on { background: #000; color: #fff; }
.parties { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 2mm; flex: 1; min-height: 0; }
.parties .party { display: flex; flex-direction: column; min-height: 0; }
.parties .party .pb { flex: 1; }
.pt { text-align: center; font-weight: 800; letter-spacing: 0.08em; font-size: 1.08em; margin-bottom: 0.8mm; }
.party .pb { border: 0.3mm solid #000; border-radius: 1.2mm; padding: 1.5mm 2mm; display: flex; flex-direction: column; gap: 0.7mm; }
.party .r { display: flex; gap: 1.6mm; align-items: flex-start; }
.party .nm { font-weight: 700; }
.party .ad { overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 4; }
.party.big { flex: 1; display: flex; flex-direction: column; min-height: 0; }
.party.big .pb { border-width: 0.4mm; flex: 1; }
.party.big .nm { font-size: 1.18em; }
.party.big .ad { -webkit-line-clamp: 4; font-size: 1.04em; }
.party.small .pb { padding: 1mm 1.6mm; }
.party.small .pt { font-size: 0.9em; text-align: left; letter-spacing: 0.06em; margin-bottom: 0.4mm; }
.party.small .ad { -webkit-line-clamp: 2; font-size: 0.92em; }
.compact .party .pt, .mini .pt { display: none; }
.compact .party.big .pb::before { content: "PENERIMA"; font-weight: 800; letter-spacing: 0.08em; font-size: 0.86em; }
.compact .party.small .pb::before { content: "PENGIRIM"; font-weight: 800; letter-spacing: 0.08em; font-size: 0.8em; color: #333; }
.mid { display: grid; grid-template-columns: minmax(0, 42%) minmax(0, 1fr); gap: 0; border: 0.3mm solid #000; border-radius: 1.2mm; overflow: hidden; }
.mid.slim { grid-template-columns: minmax(0, 38%) minmax(0, 1fr); }
.cod { padding: 1.6mm; text-align: center; display: flex; flex-direction: column; justify-content: center; border-right: 0.3mm solid #000; }
.cod .c1 { font-weight: 800; font-size: 1.55em; letter-spacing: 0.02em; }
.cod .c2 { font-weight: 700; font-size: 1.05em; }
.cod.on { background: #000; color: #fff; }
.meta { padding: 1.4mm 1.8mm; display: flex; flex-direction: column; justify-content: center; gap: 0.6mm; }
.mline { display: flex; justify-content: space-between; gap: 2mm; font-size: 0.78em; }
.mline.solo { flex-direction: column; gap: 0; }
.box { border: 0.3mm solid #000; border-radius: 1.1mm; padding: 1mm 1.8mm; overflow: hidden; }
.box .k { font-weight: 800; }
.clamp1, .clamp2, .clamp3 { display: -webkit-inline-box; -webkit-box-orient: vertical; overflow: hidden; vertical-align: top; }
.clamp1 { -webkit-line-clamp: 1; } .clamp2 { -webkit-line-clamp: 2; } .clamp3 { -webkit-line-clamp: 3; }
.foot { margin-top: auto; font-size: 0.78em; color: #222; }
.mini .mhd { display: flex; align-items: center; gap: 1.4mm; font-weight: 800; }
.mini .mhd .mt { text-transform: uppercase; letter-spacing: 0.03em; }
.mini .mhd .mc { margin-left: auto; font-weight: 700; }
.mini .mto .nm { font-weight: 800; font-size: 1.12em; }
.mini .mto .ad { overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; }
.mini .mfrom { font-size: 0.9em; border-top: 0.25mm solid #000; padding-top: 0.6mm; }
.mini .mitems { font-size: 0.9em; }
.mini .invno { font-size: 0.9em; margin-top: 0.3mm; }
`;

/** Dokumen HTML lengkap untuk satu cetakan (semua label, dipecah per halaman sesuai grid format). */
export function renderLabelsHtml(labels: LabelData[], format: LabelFormat): string {
  const spec = FORMAT_SPECS[format];
  const perPage = spec.cols * spec.rows;
  const body = VARIANT[spec.layout];
  const pages: string[] = [];
  for (let i = 0; i < labels.length; i += perPage) {
    const slice = labels.slice(i, i + perPage);
    pages.push(`<section class="page">${slice.map((l) => `<article class="lb ${spec.layout}">${body(l)}</article>`).join("")}</section>`);
  }
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Label Pengiriman</title><style>${css(spec)}</style></head><body>${pages.join("")}</body></html>`;
}
