// ─── Shared types untuk Page Template System ─────────────────────────────────
// Dipakai oleh admin (dashboard) dan front-end (public) — server & client safe

export type PageTemplate = "default" | "landing" | "contact" | "about" | "linktree" | "terms" | "privacy";

// Template singleton — hanya boleh ada 1 per tenant
export const SINGLETON_TEMPLATES: PageTemplate[] = ["terms", "privacy"];

export const SINGLETON_LABELS: Record<string, string> = {
  terms:   "Syarat dan Ketentuan",
  privacy: "Kebijakan Privasi",
};

export const SINGLETON_SLUGS: Record<string, string> = {
  terms:   "syarat-dan-ketentuan",
  privacy: "kebijakan-privasi",
};

// ── Landing Page ──────────────────────────────────────────────────────────────

export const SECTION_TYPES = [
  "hero", "posts", "products", "events", "campaigns", "gallery", "about_text",
  "features", "cta", "contact_info", "stats", "divider", "modules", "instagram_post",
] as const;

export type SectionType = typeof SECTION_TYPES[number];

export const SECTION_LABELS: Record<SectionType, string> = {
  hero:           "Hero Banner",
  posts:          "Postingan Terbaru",
  products:       "Produk Terbaru",
  events:         "Event Mendatang",
  campaigns:      "Donasi & Infaq",
  gallery:        "Galeri Foto",
  about_text:     "Tentang Kami",
  features:       "Keunggulan / Layanan",
  cta:            "Call to Action",
  contact_info:   "Info Kontak",
  stats:          "Statistik",
  divider:        "Pemisah / Spacer",
  modules:        "Strip Modul",
  instagram_post: "Instagram Feed / Linimasa",
};

export type SectionItem = {
  id:      string;
  type:    SectionType;
  variant: string;   // "1", "2", ...
  data:    Record<string, unknown>;
};

export type PostsSectionData = {
  title:         string;
  count:         number;
  categoryId?:   string | null;
  onlyFeatured?: boolean;
};

export type LandingBody = {
  sections: SectionItem[];
};

// Default data per section type
const SECTION_DEFAULTS: Record<SectionType, Record<string, unknown>> = {
  hero:           { eyebrow: "", title: "", subtitle: "", ctaLabel: "Pelajari Lebih", ctaUrl: "#", ctaSecondaryLabel: "", ctaSecondaryUrl: "", imageUrl: "", showModuleStrip: false, funfactItems: [] },
  posts:          { title: "Berita & Pengumuman", count: 6 },
  products:       { title: "Produk Terbaru", count: 8, categoryId: null },
  events:         { title: "Event Mendatang", count: 3 },
  campaigns:      { title: "Donasi & Infaq", count: 6, categoryId: null, campaignType: null },
  gallery:        { eyebrow: "", title: "Galeri Foto", headerDesc: "", titleAlign: "center", background: "none", columns: 3, imageRatio: "square", items: [] },
  about_text:     { eyebrow: "", title: "Tentang Kami", body: "", items: [], descMode: "text", listDividers: false, iconStyle: "plain", iconColor: "primary", iconShape: "square-radius", ctaLabel: "", ctaUrl: "", background: "none", width: "full", textVAlign: "center", imageUrl: "", imagePosition: "right", imageRatio: "square", imageRadius: true },
  features:       { eyebrow: "", title: "Keunggulan Kami", headerDesc: "", titleAlign: "center", descPosition: "below", background: "light", width: "full", iconStyle: "plain", iconColor: "primary", iconShape: "square-radius", cardRadius: true, cardBackground: "white", highlightFirst: false, highlightColor: "primary", items: [] },
  cta:            { title: "", subtitle: "", ctaLabel: "Hubungi Kami", ctaUrl: "#", ctaSecondaryLabel: "", ctaSecondaryUrl: "", textAlign: "left", background: "secondary", width: "full", boxedRadius: true, buttonPosition: "below" },
  contact_info:   {},
  stats:          { eyebrow: "", title: "", headerDesc: "", titleAlign: "center", items: [] },
  divider:        { height: 64, bgColor: "" },
  modules:        { title: "", items: [] },
  instagram_post: { mode: "repost", accountName: "Forcreator", accountUrl: "https://instagram.com/forcreator", count: 8, showBorderTop: false, items: [] },
};

export function createSection(type: SectionType): SectionItem {
  return {
    id:      Math.random().toString(36).slice(2, 9),
    type,
    variant: "1",
    data:    { ...SECTION_DEFAULTS[type] },
  };
}

export function getDefaultLandingSections(): SectionItem[] {
  return [
    createSection("hero"),
    createSection("posts"),
    createSection("contact_info"),
  ];
}

export function parseLandingBody(content: string | null): LandingBody {
  if (!content) return { sections: getDefaultLandingSections() };
  try {
    const parsed = JSON.parse(content) as unknown;
    if (parsed && typeof parsed === "object" && "sections" in parsed) {
      return parsed as LandingBody;
    }
  } catch {
    // fallback
  }
  return { sections: getDefaultLandingSections() };
}

// ── Contact Page ──────────────────────────────────────────────────────────────

export type ContactBody = {
  customTitle?: string;
  showForm:     boolean;
  showMap:      boolean;
  mapEmbedUrl?: string;
  successMsg?:  string;
};

export function parseContactBody(content: string | null): ContactBody {
  if (!content) return { showForm: true, showMap: true };
  try {
    const parsed = JSON.parse(content) as unknown;
    if (parsed && typeof parsed === "object") {
      return parsed as ContactBody;
    }
  } catch {
    // fallback
  }
  return { showForm: true, showMap: true };
}

// ── Linktree ──────────────────────────────────────────────────────────────────

export const LINK_TYPES = [
  "instagram", "tiktok", "facebook", "youtube", "twitter",
  "whatsapp",  "telegram", "linkedin", "email", "phone",
  "website",   "shopee",   "tokopedia", "gofood", "grabfood",
  "custom",
] as const;

export type LinkType = typeof LINK_TYPES[number];

export const LINK_LABELS: Record<LinkType, string> = {
  instagram: "Instagram",
  tiktok:    "TikTok",
  facebook:  "Facebook",
  youtube:   "YouTube",
  twitter:   "Twitter / X",
  whatsapp:  "WhatsApp",
  telegram:  "Telegram",
  linkedin:  "LinkedIn",
  email:     "Email",
  phone:     "Telepon",
  website:   "Website",
  shopee:    "Shopee",
  tokopedia: "Tokopedia",
  gofood:    "GoFood",
  grabfood:  "GrabFood",
  custom:    "Link Kustom",
};

export type LinkItem = {
  id:      string;
  type:    LinkType;
  label:   string;
  url:     string;
  enabled: boolean;
};

export type LinktreeBody = {
  profileImageUrl?: string;
  bio?:             string;
  links:            LinkItem[];
};

export function createLinkItem(type: LinkType): LinkItem {
  return {
    id:      Math.random().toString(36).slice(2, 9),
    type,
    label:   LINK_LABELS[type],
    url:     "",
    enabled: true,
  };
}

export function parseLinktreeBody(content: string | null): LinktreeBody {
  if (!content) return { links: [] };
  try {
    const parsed = JSON.parse(content) as unknown;
    if (parsed && typeof parsed === "object") {
      return parsed as LinktreeBody;
    }
  } catch {
    // fallback
  }
  return { links: [] };
}
