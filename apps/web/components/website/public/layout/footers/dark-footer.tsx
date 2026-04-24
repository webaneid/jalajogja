import { type NavItem, resolveNavHref } from "@/lib/nav-menu";
import type { FooterProps } from "@/lib/footer-designs";

const SOCIAL_ICONS: Record<string, string> = {
  instagram: "📸",
  facebook:  "📘",
  youtube:   "▶️",
  tiktok:    "🎵",
  twitter:   "🐦",
  linkedin:  "💼",
  telegram:  "✈️",
  whatsapp:  "💬",
};

export function DarkFooter({
  tenantSlug,
  siteName,
  logoUrl,
  tagline,
  navMenu,
  contactSettings,
  primaryColor,
}: FooterProps) {
  const socials       = (contactSettings as { socials?: Record<string, string> }).socials ?? {};
  const socialEntries = Object.entries(socials).filter(([, url]) => url);
  const email         = (contactSettings as { contact_email?: string }).contact_email;
  const phone         = (contactSettings as { contact_phone?: string }).contact_phone;
  const address       = (contactSettings as { contact_address?: { detail?: string } }).contact_address?.detail;
  const year          = new Date().getFullYear();

  return (
    <footer className="bg-gray-900 text-gray-300 mt-auto">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">

          {/* Kolom 1: Logo + Tagline + Sosmed */}
          <div className="space-y-4">
            <a href={`/${tenantSlug}`} className="flex items-center gap-3">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt={siteName} className="h-10 w-auto object-contain" />
              ) : (
                <>
                  <div
                    className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {siteName.charAt(0)}
                  </div>
                  <span className="font-semibold text-white text-sm leading-tight max-w-[150px]">
                    {siteName}
                  </span>
                </>
              )}
            </a>

            {tagline && (
              <p className="text-sm leading-relaxed text-gray-400">{tagline}</p>
            )}

            {socialEntries.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {socialEntries.map(([platform, url]) => (
                  <a
                    key={platform}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors capitalize"
                    title={platform}
                  >
                    <span>{SOCIAL_ICONS[platform] ?? "🔗"}</span>
                    <span>{platform}</span>
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Kolom 2: Link Menu */}
          {navMenu.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
                Navigasi
              </h3>
              <ul className="space-y-2">
                {navMenu.map((item: NavItem) => {
                  const href  = resolveNavHref(item, tenantSlug);
                  const isExt = item.external ?? false;
                  return (
                    <li key={item.id}>
                      <a
                        href={href}
                        target={isExt ? "_blank" : undefined}
                        rel={isExt ? "noopener noreferrer" : undefined}
                        className="text-sm text-gray-400 hover:text-white transition-colors"
                      >
                        {item.label}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Kolom 3: Kontak */}
          {(email || phone || address) && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
                Kontak
              </h3>
              <ul className="space-y-2 text-sm text-gray-400">
                {email && (
                  <li>
                    <a href={`mailto:${email}`} className="hover:text-white transition-colors">
                      📧 {email}
                    </a>
                  </li>
                )}
                {phone && (
                  <li>
                    <a href={`tel:${phone}`} className="hover:text-white transition-colors">
                      📞 {phone}
                    </a>
                  </li>
                )}
                {address && (
                  <li className="flex gap-2">
                    <span className="shrink-0">📍</span>
                    <span>{address}</span>
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Copyright bar */}
      <div className="border-t border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-500">
          <span>© {year} {siteName}. All rights reserved.</span>
          <span>Powered by <span className="text-gray-400">jalajogja</span></span>
        </div>
      </div>
    </footer>
  );
}
