// Satu-satunya sumber kebenaran ikon per tipe konten publik — dipakai `PublicLinkPicker`
// (punya `PublicLink.type` pasti dari API) MAUPUN `BottomNav` mobile (infer tipe dari pola href,
// karena `NavItem` tidak menyimpan metadata type — hanya `href` string, termasuk untuk nav item
// lama/manual yang dibuat sebelum PublicLinkPicker ada). Jangan duplikasi tabel ini di tempat
// lain — kalau butuh ikon baru untuk tipe konten baru, tambah di sini SAJA.
import type { ComponentType } from "react";
import {
  Home, Newspaper, Calendar, ShoppingBag, Heart, Users,
  School, Briefcase, BarChart2, ShoppingCart, LogIn, UserPlus,
  LayoutDashboard, Receipt, FileText, Hash, Tag, Layers, Globe,
  FileDown, FolderOpen, Link2,
} from "lucide-react";
import type { PublicLinkType } from "@/lib/public-url-registry";

export type LucideIconType = ComponentType<{ className?: string }>;

// Ikon per PublicLinkType — dipakai saat `type` sudah pasti diketahui (dari respons API).
export const LINK_TYPE_ICONS: Record<PublicLinkType, LucideIconType> = {
  "static":            Globe,
  "page":              FileText,
  "post":              Newspaper,
  "post-category":     Tag,
  "post-tag":          Hash,
  "product":           ShoppingBag,
  "product-category":  Layers,
  "event":             Calendar,
  "event-category":    Tag,
  "campaign":          Heart,
  "campaign-category": Tag,
  "document":          FileDown,
  "document-category": Tag,
  "pesantren":         School,
  "usaha":             Briefcase,
  "profesional":       Briefcase,
};

// Ikon per label rute statis — dipakai saat type === "static" (label lebih spesifik dari group).
export const STATIC_LABEL_ICONS: Record<string, LucideIconType> = {
  "Beranda":               Home,
  "Arsip Postingan":       Newspaper,
  "Agenda / Event":        Calendar,
  "Direktori Produk":      ShoppingBag,
  "Donasi & Campaign":     Heart,
  "Arsip Dokumen":         FolderOpen,
  "Direktori Anggota":     Users,
  "Direktori Pesantren":   School,
  "Direktori Usaha":       Briefcase,
  "Direktori Profesional": Briefcase,
  "Statistik":             BarChart2,
  "Keranjang Belanja":     ShoppingCart,
  "Login":                 LogIn,
  "Register":              UserPlus,
  "Dashboard Akun":        LayoutDashboard,
  "Riwayat Transaksi":     Receipt,
};

const STATIC_GROUP_ICONS: Record<string, LucideIconType> = {
  "Akun":      LayoutDashboard,
  "Transaksi": ShoppingCart,
  "Direktori": Users,
};

// Dipakai PublicLinkPicker — type dan group sudah pasti dari API.
export function iconForType(type: PublicLinkType, group?: string): LucideIconType {
  if (type === "static" && group && STATIC_GROUP_ICONS[group]) return STATIC_GROUP_ICONS[group];
  return LINK_TYPE_ICONS[type] ?? Globe;
}

export function iconForStaticLabel(label: string): LucideIconType {
  return STATIC_LABEL_ICONS[label] ?? Globe;
}

// Segmen pertama path → PublicLinkType — mengikuti pola builder di lib/public-url-registry.ts
// secara terbalik. Dipakai HANYA saat metadata `type` tidak tersedia (BottomNav: NavItem cuma
// simpan href string, tidak ada field type).
const SEGMENT_TYPE: Record<string, PublicLinkType> = {
  post:        "post",
  agenda:      "event",
  produk:      "product",
  campaign:    "campaign",
  pesantren:   "pesantren",
  usaha:       "usaha",
  profesional: "profesional",
};

const SEGMENT_STATIC_ICON: Record<string, LucideIconType> = {
  anggota:   Users,
  statistik: BarChart2,
  keranjang: ShoppingCart,
  login:     LogIn,
  register:  UserPlus,
  akun:      LayoutDashboard,
};

// Infer ikon dari href mentah — dipakai BottomNav untuk nav item apa pun (dipilih via picker
// MAUPUN diketik manual/legacy), karena NavItem tidak simpan metadata type sama sekali.
export function iconForHref(href: string, baseUrl: string): LucideIconType {
  const rest     = baseUrl !== "" && href.startsWith(baseUrl) ? href.slice(baseUrl.length) : href;
  const segments = rest.split("/").filter(Boolean);

  if (segments.length === 0) return Home; // "/" atau "/{slug}/" → beranda

  const first = segments[0];

  // "dokumen" saja (arsip) beda ikon dari "dokumen/view/{id}" (dokumen individual)
  if (first === "dokumen") return segments.length === 1 ? FolderOpen : FileDown;

  const type = SEGMENT_TYPE[first];
  if (type) return LINK_TYPE_ICONS[type];

  return SEGMENT_STATIC_ICON[first] ?? Link2; // rute statis lain, anchor, atau URL eksternal
}
