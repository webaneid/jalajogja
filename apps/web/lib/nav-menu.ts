// ─── Nav Menu Types — dipakai admin settings + PublicHeader ──────────────────
import { FileText, Newspaper, Calendar, ShoppingBag, Heart, Link2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const NAV_ITEM_TYPES = [
  "page", "post", "event", "toko", "donasi", "custom",
] as const;

export type NavItemType = typeof NAV_ITEM_TYPES[number];

export const NAV_ITEM_TYPE_LABELS: Record<NavItemType, string> = {
  page:   "Halaman",
  post:   "Postingan / Berita",
  event:  "Event",
  toko:   "Toko",
  donasi: "Donasi / Infaq",
  custom: "URL Kustom",
};

export type NavItem = {
  id:        string;
  label:     string;
  type:      NavItemType;
  pageSlug?: string;   // dipakai jika type === "page"
  href?:     string;   // dipakai jika type === "custom"
  external?: boolean;  // buka di tab baru
  order:     number;
};

export type NavMenu = NavItem[];

// Resolve URL publik dari sebuah nav item
export function resolveNavHref(item: NavItem, tenantSlug: string): string {
  switch (item.type) {
    case "page":   return `/${tenantSlug}/${item.pageSlug ?? ""}`;
    case "post":   return `/${tenantSlug}/post`;
    case "event":  return `/${tenantSlug}/event`;
    case "toko":   return `/${tenantSlug}/toko`;
    case "donasi": return `/${tenantSlug}/donasi`;
    case "custom": return item.href ?? "#";
    default:       return "#";
  }
}

export function parseNavMenu(value: unknown): NavMenu {
  if (!Array.isArray(value)) return [];
  return (value as NavItem[]).filter(
    (item) => item && typeof item === "object" && item.id && item.label && item.type
  );
}

export const NAV_TYPE_ICONS: Record<NavItemType, LucideIcon> = {
  page:   FileText,
  post:   Newspaper,
  event:  Calendar,
  toko:   ShoppingBag,
  donasi: Heart,
  custom: Link2,
};

export function createNavItem(): NavItem {
  return {
    id:    Math.random().toString(36).slice(2, 9),
    label: "",
    type:  "page",
    order: 0,
  };
}
