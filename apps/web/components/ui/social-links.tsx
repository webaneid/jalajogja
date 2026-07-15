import {
  FaFacebook, FaInstagram, FaLinkedin, FaXTwitter, FaTiktok, FaGlobe, FaYoutube, FaWhatsapp,
} from "react-icons/fa6";
import type { IconType } from "react-icons";

// ─── SocialLinks ────────────────────────────────────────────────────────────
// Komponen universal untuk menampilkan link sosial media — icon-only, dipakai
// di halaman mana saja yang butuh tampilkan sosmed (profil anggota, usaha,
// pesantren, profesional, footer publik, dll). Reusable seperti "shortcode" —
// cukup pass value, komponen ini yang urus icon + href per platform.
//
// Nilai untuk tiap field mengikuti format yang sama dengan SocialMediaInput
// (components/ui/social-media-input.tsx): instagram/twitter/tiktok = username
// tanpa @, facebook = URL atau nama halaman, linkedin/youtube/website/whatsapp
// = URL penuh (whatsapp: sudah dalam bentuk https://wa.me/... saat masuk sini).

export interface SocialLinksValue {
  instagram?: string | null;
  facebook?:  string | null;
  linkedin?:  string | null;
  twitter?:   string | null;
  youtube?:   string | null;
  tiktok?:    string | null;
  website?:   string | null;
  whatsapp?:  string | null;
}

type PlatformDef = {
  key:       keyof SocialLinksValue;
  icon:      IconType;
  label:     string;
  buildHref: (v: string) => string;
};

// Warna resmi brand per platform — dipakai saat variant="brand" (mis. footer).
export const SOCIAL_BRAND_COLORS: Partial<Record<keyof SocialLinksValue, string>> = {
  facebook:  "#1877F2",
  instagram: "#E1306C",
  linkedin:  "#0A66C2",
  twitter:   "#000000",
  youtube:   "#FF0000",
  tiktok:    "#010101",
  whatsapp:  "#25D366",
  website:   "#6b7280",
};

const PLATFORMS: PlatformDef[] = [
  { key: "website",   icon: FaGlobe,     label: "Website",     buildHref: (v) => v },
  { key: "instagram", icon: FaInstagram, label: "Instagram",   buildHref: (v) => `https://instagram.com/${v}` },
  { key: "facebook",  icon: FaFacebook,  label: "Facebook",    buildHref: (v) => (v.startsWith("http") ? v : `https://facebook.com/${v}`) },
  { key: "linkedin",  icon: FaLinkedin,  label: "LinkedIn",    buildHref: (v) => v },
  { key: "twitter",   icon: FaXTwitter,  label: "X (Twitter)", buildHref: (v) => `https://x.com/${v}` },
  { key: "tiktok",    icon: FaTiktok,    label: "TikTok",      buildHref: (v) => `https://tiktok.com/@${v}` },
  { key: "youtube",   icon: FaYoutube,   label: "YouTube",     buildHref: (v) => v },
  { key: "whatsapp",  icon: FaWhatsapp,  label: "WhatsApp",    buildHref: (v) => v },
];

const SIZE_CLASS = {
  sm: "h-8 w-8 text-sm",
  md: "h-9 w-9 text-base",
  lg: "h-11 w-11 text-lg",
} as const;

export function SocialLinks({
  value,
  size = "md",
  variant = "outline",
  className,
}: {
  value: SocialLinksValue;
  size?: keyof typeof SIZE_CLASS;
  /** "outline" = monokrom berbingkai (default, dipakai di profil anggota).
   *  "brand" = latar bulat warna resmi tiap platform (cocok untuk footer). */
  variant?: "outline" | "brand";
  className?: string;
}) {
  const active = PLATFORMS
    .map((p) => ({ ...p, raw: value[p.key]?.trim() }))
    .filter((p): p is PlatformDef & { raw: string } => !!p.raw);

  if (active.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-2 ${className ?? ""}`}>
      {active.map((p) => {
        const Icon = p.icon;
        const brandColor = SOCIAL_BRAND_COLORS[p.key] ?? "#6b7280";
        return (
          <a
            key={p.key}
            href={p.buildHref(p.raw)}
            target="_blank"
            rel="noopener noreferrer"
            title={p.label}
            aria-label={p.label}
            className={
              variant === "brand"
                ? `inline-flex items-center justify-center rounded-full text-white transition-opacity hover:opacity-80 ${SIZE_CLASS[size]}`
                : `inline-flex items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary ${SIZE_CLASS[size]}`
            }
            style={variant === "brand" ? { backgroundColor: brandColor } : undefined}
          >
            <Icon />
          </a>
        );
      })}
    </div>
  );
}
