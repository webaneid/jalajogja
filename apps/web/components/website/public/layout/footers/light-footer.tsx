import { type NavItem, resolveNavHref } from "@/lib/nav-menu";
import type { FooterProps } from "@/lib/footer-designs";

const SOCIAL_BRAND_COLORS: Record<string, string> = {
  facebook:  "#1877F2",
  youtube:   "#FF0000",
  instagram: "#E1306C",
  tiktok:    "#010101",
  twitter:   "#1DA1F2",
  telegram:  "#26A5E4",
  whatsapp:  "#25D366",
  linkedin:  "#0A66C2",
};

const SOCIAL_SVG_PATHS: Record<string, React.ReactNode> = {
  facebook: <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />,
  youtube:  <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.96-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58zM9.75 15.02V8.98L15.5 12l-5.75 3.02z" />,
  instagram:<path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />,
  tiktok:   <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15.3a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.93a8.26 8.26 0 0 0 4.83 1.55V7.01a4.85 4.85 0 0 1-1.06-.32z" />,
  twitter:  <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z" />,
  telegram: <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" />,
  whatsapp: <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z M11.998 2C6.477 2 2 6.478 2 12c0 1.75.456 3.393 1.252 4.827L2 22l5.293-1.227A9.953 9.953 0 0 0 11.998 22C17.52 22 22 17.522 22 12c0-5.523-4.48-10.002-10.002-10z" />,
  linkedin: <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z M4 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />,
};

function SocialIcon({ platform, url }: { platform: string; url: string }) {
  const bg   = SOCIAL_BRAND_COLORS[platform] ?? "#6b7280";
  const path = SOCIAL_SVG_PATHS[platform]    ?? <circle cx="12" cy="12" r="6" />;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={platform}
      className="w-9 h-9 rounded-full flex items-center justify-center text-white transition-opacity hover:opacity-80"
      style={{ backgroundColor: bg }}
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">{path}</svg>
    </a>
  );
}

export function LightFooter({
  tenantSlug,
  siteName,
  logoUrl,
  tagline,
  navMenu,
  contactSettings,
  primaryColor,
}: FooterProps) {
  const cs      = contactSettings as {
    contact_email?:   string;
    contact_phone?:   string;
    contact_address?: { detail?: string };
    socials?:         Record<string, string>;
  };
  const socials = Object.entries(cs.socials ?? {}).filter(([, url]) => url);
  const email   = cs.contact_email;
  const phone   = cs.contact_phone;
  const address = cs.contact_address?.detail;
  const year    = new Date().getFullYear();

  const col1 = navMenu.slice(0, Math.ceil(navMenu.length / 2));
  const col2 = navMenu.slice(Math.ceil(navMenu.length / 2));

  return (
    <footer className="bg-gray-50 text-gray-600 border-t border-gray-200">

      {/* ── Section 1: Identitas + Social CTA ── */}
      <div className="max-w-6xl mx-auto px-4 pt-14 pb-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">

          {/* Kiri */}
          <div className="space-y-5">
            <a href={`/${tenantSlug}`} className="inline-block">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt={siteName} className="h-14 w-auto object-contain" />
              ) : (
                <div
                  className="h-14 w-14 rounded-full flex items-center justify-center text-white font-bold text-2xl"
                  style={{ backgroundColor: primaryColor }}
                >
                  {siteName.charAt(0)}
                </div>
              )}
            </a>
            <div>
              <p className="text-xs tracking-widest uppercase text-gray-400">{siteName}</p>
              {tagline && (
                <p className="text-2xl font-bold text-gray-900 mt-1 leading-snug">{tagline}</p>
              )}
            </div>
            {socials.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {socials.map(([platform, url]) => (
                  <SocialIcon key={platform} platform={platform} url={url} />
                ))}
              </div>
            )}
          </div>

          {/* Kanan: Stay Connected */}
          {socials.length > 0 && (
            <div className="space-y-4">
              <p className="text-xs tracking-widest uppercase text-gray-400">Stay Connected</p>
              <p className="text-2xl font-bold text-gray-900 leading-snug">
                Support Our Social Media
              </p>
              <p className="text-sm text-gray-600 leading-relaxed">
                Ikuti kanal sosial kami untuk update berita, video, dan konten terbaru.
              </p>
              <div className="flex flex-wrap gap-3 pt-1">
                {socials.map(([platform, url]) => (
                  <SocialIcon key={platform} platform={platform} url={url} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-gray-200" />

      {/* ── Section 2: Nav + Kontak ── */}
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">

          {navMenu.length > 0 && (
            <div className="space-y-4">
              <p className="text-xs tracking-widest uppercase text-gray-400">Navigation</p>
              <p className="text-xl font-bold text-gray-900">Useful Links</p>
              <div className={`grid gap-x-8 gap-y-2 ${navMenu.length > 3 ? "grid-cols-2" : "grid-cols-1"}`}>
                {col1.map((item: NavItem) => (
                  <a
                    key={item.id}
                    href={resolveNavHref(item, tenantSlug)}
                    target={item.external ? "_blank" : undefined}
                    rel={item.external ? "noopener noreferrer" : undefined}
                    className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    {item.label}
                  </a>
                ))}
                {col2.map((item: NavItem) => (
                  <a
                    key={item.id}
                    href={resolveNavHref(item, tenantSlug)}
                    target={item.external ? "_blank" : undefined}
                    rel={item.external ? "noopener noreferrer" : undefined}
                    className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    {item.label}
                  </a>
                ))}
              </div>
            </div>
          )}

          {(email || phone || address) && (
            <div className="space-y-4">
              <p className="text-xs tracking-widest uppercase text-gray-400">Contact</p>
              <p className="text-xl font-bold text-gray-900">Contact Us</p>
              {address && (
                <>
                  <p className="text-xs tracking-widest uppercase text-gray-400 mt-4">Alamat</p>
                  <p className="text-sm font-semibold text-gray-800">{address}</p>
                </>
              )}
              <ul className="space-y-2 text-sm text-gray-600 mt-2">
                {email && (
                  <li><a href={`mailto:${email}`} className="hover:text-gray-900 transition-colors">{email}</a></li>
                )}
                {phone && (
                  <li><a href={`tel:${phone}`} className="hover:text-gray-900 transition-colors">{phone}</a></li>
                )}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* ── Copyright ── */}
      <div className="bg-gray-100 border-t border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-400">
          <span>© {year} {siteName}. All rights reserved.</span>
          <span>Jalakarta &mdash; developed with ❤️ by <span className="text-gray-600 font-semibold">Webane</span></span>
        </div>
      </div>
    </footer>
  );
}
