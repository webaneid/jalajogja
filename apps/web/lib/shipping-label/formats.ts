// Definisi 7 format cetak (sama dengan popup "Print Format"): ukuran halaman, grid, ukuran label (mm), dan varian tata letak.
import type { LabelFormat } from "./types";

export type LayoutVariant = "wide" | "tall" | "compact" | "mini";

export type FormatSpec = {
  key: LabelFormat;
  group: "paper" | "thermal";
  title: string;
  hint: string;
  page: { w: number; h: number };      // mm
  label: { w: number; h: number };     // mm
  cols: number; rows: number;
  margin: number; gap: number;         // mm
  layout: LayoutVariant;
  fontPt: number;                      // ukuran huruf dasar
};

export const FORMAT_SPECS: Record<LabelFormat, FormatSpec> = {
  "a4-1":     { key: "a4-1", group: "paper", title: "1 label per halaman", hint: "Direkomendasikan di cetak di A4 atau A5",
                page: { w: 210, h: 297 }, label: { w: 194, h: 128 }, cols: 1, rows: 1, margin: 8, gap: 0, layout: "wide", fontPt: 13 },
  "a4-2":     { key: "a4-2", group: "paper", title: "2 label per halaman", hint: "Direkomendasikan di cetak di A4 atau A5",
                page: { w: 210, h: 297 }, label: { w: 194, h: 138 }, cols: 1, rows: 2, margin: 8, gap: 6, layout: "wide", fontPt: 12.6 },
  "a4-4":     { key: "a4-4", group: "paper", title: "4 label per halaman", hint: "Direkomendasikan di cetak di A4",
                page: { w: 297, h: 210 }, label: { w: 138, h: 96 }, cols: 2, rows: 2, margin: 8, gap: 6, layout: "wide", fontPt: 8.9 },
  "a4-6":     { key: "a4-6", group: "paper", title: "6 label per halaman", hint: "Direkomendasikan di cetak di A4",
                page: { w: 210, h: 297 }, label: { w: 96, h: 90 }, cols: 2, rows: 3, margin: 8, gap: 6, layout: "compact", fontPt: 8 },
  "th-10x10": { key: "th-10x10", group: "thermal", title: "10cm x 10cm", hint: "Suitable for thermal printing",
                page: { w: 100, h: 100 }, label: { w: 100, h: 100 }, cols: 1, rows: 1, margin: 0, gap: 0, layout: "compact", fontPt: 8.2 },
  "th-10x15": { key: "th-10x15", group: "thermal", title: "10cm x 15cm", hint: "Suitable for thermal printing",
                page: { w: 100, h: 150 }, label: { w: 100, h: 150 }, cols: 1, rows: 1, margin: 0, gap: 0, layout: "tall", fontPt: 9.3 },
  "th-8x6":   { key: "th-8x6", group: "thermal", title: "8cm x 6cm", hint: "Suitable for thermal printing",
                page: { w: 80, h: 60 }, label: { w: 80, h: 60 }, cols: 1, rows: 1, margin: 0, gap: 0, layout: "mini", fontPt: 6.2 },
};

export const isLabelFormat = (v: unknown): v is LabelFormat => typeof v === "string" && v in FORMAT_SPECS;
