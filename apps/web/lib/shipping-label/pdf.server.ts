// HTML label → PDF lewat Playwright (pola sama sertifikat event). Dibatasi 2 render bersamaan supaya VPS tidak kehabisan memori
// (tiap render meluncurkan Chromium); permintaan ke-3 dst ditolak dengan pesan "sibuk" (bukan antre tanpa batas).
import "server-only";
import { chromium } from "playwright";
import { renderLabelsHtml } from "./render";
import { FORMAT_SPECS } from "./formats";
import type { LabelData, LabelFormat } from "./types";

const MAX_CONCURRENT = 2;
let active = 0;

export class LabelBusyError extends Error {}

export async function renderLabelsPdf(labels: LabelData[], format: LabelFormat): Promise<Buffer> {
  if (active >= MAX_CONCURRENT) throw new LabelBusyError("busy");
  active++;
  let browser;
  try {
    const spec = FORMAT_SPECS[format];
    browser = await chromium.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    // Hardening (defense-in-depth, HTML memuat data pembeli): tanpa JavaScript, tanpa jaringan, hanya data:/about: yang boleh dimuat.
    const context = await browser.newContext({ javaScriptEnabled: false, offline: true });
    const page = await context.newPage();
    await page.route("**/*", (r) => (/^(data:|about:)/.test(r.request().url()) ? r.continue() : r.abort()));
    await page.setContent(renderLabelsHtml(labels, format), { waitUntil: "load", timeout: 30_000 });
    const pdf = await page.pdf({ width: `${spec.page.w}mm`, height: `${spec.page.h}mm`, printBackground: true, preferCSSPageSize: true });
    return Buffer.from(pdf);
  } finally {
    try { await browser?.close(); } catch (e) { console.error("[labels] browser.close gagal:", e); }
    active--; // SELALU berkurang, juga bila close() melempar error (kalau tidak, 2 kebocoran = semua cetak 503 sampai restart)
  }
}
