import {
  FaFacebook, FaInstagram, FaLinkedin, FaXTwitter, FaTiktok, FaGlobe, FaYoutube,
} from "react-icons/fa6";
import type { IconType } from "react-icons";

// ─── SocialLinks ────────────────────────────────────────────────────────────
// Komponen universal untuk menampilkan link sosial media — icon-only, dipakai
// di halaman mana saja yang butuh tampilkan sosmed (profil anggota, usaha,
// pesantren, profesional, dll). Reusable seperti "shortcode" — cukup pass
// value, komponen ini yang urus icon + href per platform.
//
// Nilai untuk tiap field mengikuti format yang sama dengan SocialMediaInput
// (components/ui/social-media-input.tsx): instagram/twitter/tiktok = username
// tanpa @, facebook = URL atau nama halaman, linkedin/youtube/website = URL penuh.

export interface SocialLinksValue {
  instagram?: string | null;
  facebook?:  string | null;
  linkedin?:  string | null;
  twitter?:   string | null;
  youtube?:   string | null;
  tiktok?:    string | null;
  website?:   string | null;
}

type PlatformDef = {
  key:       keyof SocialLinksValue;
  icon:      IconType;
  label:     string;
  buildHref: (v: string) => string;
};

const PLATFORMS: PlatformDef[] = [
  { key: "website",   icon: FaGlobe,     label: "Website",     buildHref: (v) => v },
  { key: "instagram", icon: FaInstagram, label: "Instagram",   buildHref: (v) => `https://instagram.com/${v}` },
  { key: "facebook",  icon: FaFacebook,  label: "Facebook",    buildHref: (v) => (v.startsWith("http") ? v : `https://facebook.com/${v}`) },
  { key: "linkedin",  icon: FaLinkedin,  label: "LinkedIn",    buildHref: (v) => v },
  { key: "twitter",   icon: FaXTwitter,  label: "X (Twitter)", buildHref: (v) => `https://x.com/${v}` },
  { key: "tiktok",    icon: FaTiktok,    label: "TikTok",      buildHref: (v) => `https://tiktok.com/@${v}` },
  { key: "youtube",   icon: FaYoutube,   label: "YouTube",     buildHref: (v) => v },
];

const SIZE_CLASS = {
  sm: "h-8 w-8 text-sm",
  md: "h-9 w-9 text-base",
  lg: "h-11 w-11 text-lg",
} as const;

export function SocialLinks({
  value,
  size = "md",
  className,
}: {
  value: SocialLinksValue;
  size?: keyof typeof SIZE_CLASS;
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
        return (
          <a
            key={p.key}
            href={p.buildHref(p.raw)}
            target="_blank"
            rel="noopener noreferrer"
            title={p.label}
            aria-label={p.label}
            className={`inline-flex items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary ${SIZE_CLASS[size]}`}
          >
            <Icon />
          </a>
        );
      })}
    </div>
  );
}
