import { Heart, Store, CalendarDays, FolderOpen, Users, Building2, Briefcase, School } from "lucide-react";

// Katalog modul untuk section "Strip Modul" — independen dari HERO_MODULES di
// hero-section-designs.ts (sengaja tidak dibagi, supaya hero Desain 1/Klasik tidak pernah
// tersentuh oleh perubahan di file ini). Icon Usaha pakai Building2 (bukan Briefcase yang
// dipakai halaman /usaha sendiri) supaya tidak collide visual dengan Profesional dalam satu strip.

export type ModulesSectionData = {
  title?: string;
  items: string[]; // ModuleId[]
};

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
