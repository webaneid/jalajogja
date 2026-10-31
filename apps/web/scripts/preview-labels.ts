// Alat pengembangan: render label contoh ke PDF untuk ditinjau desainnya (tanpa DB). Pakai:
//   bun run scripts/preview-labels.ts <folder-keluaran> [format ...]
// Doc: docs/arsitektur-portal-produsen.md § 21 (fase L1).
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { renderLabelsHtml } from "../lib/shipping-label/render";
import { FORMAT_SPECS, isLabelFormat } from "../lib/shipping-label/formats";
import { LABEL_FORMATS, type LabelData } from "../lib/shipping-label/types";

const svgUri = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
const TENANT_LOGO = svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 40"><rect width="40" height="40" rx="9" fill="#000"/><path d="M12 10h16v5H18v4h9v5h-9v8h-6z" fill="#fff"/><text x="48" y="27" font-family="Arial" font-weight="800" font-size="19" fill="#000">forbis</text></svg>`);
const COURIER_LOGO = svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 40"><circle cx="20" cy="20" r="17" fill="none" stroke="#000" stroke-width="4"/><path d="M12 22l8-10 8 10z" fill="#000"/><text x="44" y="26" font-family="Arial" font-style="italic" font-weight="800" font-size="18" fill="#000">Lion Parcel</text></svg>`);

const base: LabelData = {
  tenantName: "Forbis", tenantLogo: TENANT_LOGO, courierName: "Lion Parcel", courierLogo: COURIER_LOGO, service: "REG", weightLabel: "0,5 Kg",
  invoiceNumber: "INV-202610-00123",
  sender: { name: "Webane Indonesia", phone: "0852-1062-6455", address: "Perum Permata Block B8, Jl. Karangploso Gempol, Kel. Condongcatur, Kec. Depok, Kab. Sleman, DI Yogyakarta, 55283" },
  receiver: { name: "Arrusydi Ahmad Datuk", phone: "0813-6333-3224", address: "Perumahan Karyawan PT. Rapptownsite II Blok X4, Kel. Pangkalan Kerinci Barat, Kec. Pangkalan Kerinci, Kab. Pelalawan, Riau, 28381" },
  isCod: false, codAmountLabel: null,
  items: [{ name: "Kaos Reuni Spinker 620", variant: "Ukuran: L, Warna: Hitam", qty: 2 }],
  note: "Bisa dihubungi nomor whatsappnya", batchName: "011120260001", createdAtLabel: "31/10/2026 00:30",
};
const labels: LabelData[] = [
  base,
  { ...base, invoiceNumber: "INV-202610-00124", courierLogo: null, courierName: "SiCepat", service: "BEST", weightLabel: "1,2 Kg", isCod: true, codAmountLabel: "Rp 185.000",
    receiver: { name: "Muhammad Deny Hasan", phone: "0858-9411-3026", address: "Drumband RMA, Jl. Pondok Leungsir, Kp. Bantarkaret, No. 10, RT 06/RW 05, Lembursawah, Cicantayan, Sukabumi, Jawa Barat, 43155" },
    items: [{ name: "Kaos Reuni Spinker 620", variant: "L, Hitam", qty: 1 }, { name: "Topi Alumni", variant: "", qty: 3 }, { name: "Gantungan Kunci Pondok Modern", variant: "Biru", qty: 10 }], note: null, batchName: null },
  { ...base, invoiceNumber: "INV-202610-00125", courierLogo: null, courierName: "J&T Express", service: "EZ", weightLabel: "0,3 Kg",
    receiver: { name: "Shaumin", phone: "0856-4860-2750", address: "SIT Permata Papua, Jl. Poros Sp.2–Sp.5, Wanagon, Mimika Baru, Mimika, Papua, 99910" } },
  { ...base, invoiceNumber: "INV-202610-00126", service: "YES", weightLabel: "2 Kg" },
  { ...base, invoiceNumber: "INV-202610-00127", courierLogo: null, courierName: "JNE", service: "OKE" },
  { ...base, invoiceNumber: "INV-202610-00128", isCod: true, codAmountLabel: "Rp 1.250.000", weightLabel: "5 Kg" },
];

const [outDir, ...only] = process.argv.slice(2);
if (!outDir) { console.error("pakai: bun run scripts/preview-labels.ts <folder> [format…]"); process.exit(1); }
mkdirSync(outDir, { recursive: true });
const formats = only.length ? only.filter(isLabelFormat) : [...LABEL_FORMATS];

const browser = await chromium.launch();
for (const f of formats) {
  const spec = FORMAT_SPECS[f];
  const page = await browser.newPage();
  await page.setContent(renderLabelsHtml(labels, f), { waitUntil: "load" });
  const pdf = await page.pdf({ width: `${spec.page.w}mm`, height: `${spec.page.h}mm`, printBackground: true, preferCSSPageSize: true });
  writeFileSync(`${outDir}/label-${f}.pdf`, pdf);
  await page.close();
  console.log("OK", f);
}
await browser.close();
