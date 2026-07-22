import { Heart, Store, CalendarDays, FolderOpen, Users, Building2, Briefcase, School } from "lucide-react";
import type { SectionTitleAlign } from "./section-title-align";

// Katalog modul untuk section "Strip Modul" — independen dari HERO_MODULES di
// hero-section-designs.ts (sengaja tidak dibagi, supaya hero Desain 1/Klasik tidak pernah
// tersentuh oleh perubahan di file ini). Icon Usaha pakai Building2 (bukan Briefcase yang
// dipakai halaman /usaha sendiri) supaya tidak collide visual dengan Profesional dalam satu strip.

// Satu item strip: modul yang dipilih + foto custom opsional. Kalau imageUrl kosong, Desain 2
// (Foto) auto-fallback ke foto item terbaru modul itu (lihat resolveModuleImages di
// modules-section.tsx) — kecuali modul termasuk MODULES_NO_AUTO_PHOTO.
export type ModuleItemConfig = {
  id:        string; // ModuleId
  imageUrl?: string;
};

export type ModulesSectionData = {
  title?:      string;
  eyebrow?:    string;
  headerDesc?: string;
  titleAlign?: SectionTitleAlign;  // default "left" — lihat lib/section-title-align.ts
  items:       ModuleItemConfig[];
};

// Backward-compat: sebelum Desain 2 ditambahkan (2026-07-17), `items` disimpan sebagai `string[]`
// biasa (daftar ID modul saja, tanpa foto). Data lama yang sudah tersimpan (JSONB di pages.body)
// tidak ikut migrasi otomatis — helper ini menormalkan KEDUA bentuk saat dibaca, supaya section
// yang sudah dikonfigurasi sebelum perubahan ini tidak tiba-tiba kosong/rusak.
export function normalizeModuleItems(raw: unknown): ModuleItemConfig[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item): ModuleItemConfig | null => {
      if (typeof item === "string") return { id: item };
      if (item && typeof item === "object" && typeof (item as { id?: unknown }).id === "string") {
        return item as ModuleItemConfig;
      }
      return null;
    })
    .filter((item): item is ModuleItemConfig => item !== null);
}

export const MODULE_CATALOG = {
  donasi:      { path: "campaign",    label: "Donasi",          desc: "Program & infaq",       Icon: Heart },
  toko:        { path: "produk",      label: "Toko",            desc: "Belanja produk",         Icon: Store },
  event:       { path: "agenda",      label: "Event",           desc: "Agenda & kegiatan",      Icon: CalendarDays },
  dokumen:     { path: "dokumen",     label: "Dokumen",         desc: "Arsip & laporan",        Icon: FolderOpen },
  anggota:     { path: "anggota",     label: "Data Anggota",    desc: "Direktori anggota",      Icon: Users },
  usaha:       { path: "usaha",       label: "Direktori Usaha", desc: "UMKM & usaha anggota",   Icon: Building2 },
  profesional: { path: "profesional", label: "Profesional",     desc: "Direktori profesi",      Icon: Briefcase },
  pesantren:   { path: "pesantren",   label: "Pesantren",       desc: "Lembaga pendidikan",     Icon: School },
} as const;

export type ModuleId = keyof typeof MODULE_CATALOG;

export const MODULE_IDS = Object.keys(MODULE_CATALOG) as ModuleId[];

// ── Desain 2 — Kartu Foto Overlay ────────────────────────────────────────────────

export const MODULE_SECTION_DESIGN_IDS = ["1", "2"] as const;
export type ModuleSectionDesignId = typeof MODULE_SECTION_DESIGN_IDS[number];

export const MODULE_SECTION_DESIGNS: Record<ModuleSectionDesignId, {
  label:       string;
  description: string;
}> = {
  "1": {
    label:       "Ikon",
    description: "Kartu ikon + label + deskripsi, tanpa foto.",
  },
  "2": {
    label:       "Foto",
    description: "Kartu foto overlay, bisa di-scroll — custom foto atau otomatis dari item terbaru.",
  },
};

// Modul yang TIDAK punya fallback foto otomatis: dokumen (tidak ada kolom foto sama sekali di
// schema — cuma file PDF), anggota (ada photoUrl tapi sengaja diskip — foto pribadi individu,
// bukan representatif organisasi, keputusan user 2026-07-17).
export const MODULES_NO_AUTO_PHOTO: ModuleId[] = ["dokumen", "anggota"];
