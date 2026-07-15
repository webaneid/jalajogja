import { type NavItem, resolveNavHref } from "@/lib/nav-menu";
import type { FooterProps } from "@/lib/footer-designs";
import { SocialLinks } from "@/components/ui/social-links";

function normalizePhone(phone: string): string {
  const digits = String(phone).replace(/\D/g, "");
  return digits.startsWith("0") ? "62" + digits.slice(1) : digits;
}

export function LightFooter({
  tenantSlug,
  siteName,
  logoUrl,
  tagline,
  description,
  navMenu,
  contactSettings,
  primaryColor,
  baseUrl,
}: FooterProps) {
  const cs      = contactSettings as {
    contact_email?:    string;
    contact_phone?:    string;
    contact_whatsapp?: string;
    contact_address?:  {
      detail?:       string;
      provinceName?: string;
      regencyName?:  string;
      districtName?: string;
      villageName?:  string;
      postalCode?:   string;
    };
    socials?:          Record<string, string>;
  };
  const socialsRaw = { ...(cs.socials ?? {}) } as Record<string, string>;
  if (cs.contact_whatsapp && !socialsRaw.whatsapp) {
    socialsRaw.whatsapp = `https://wa.me/${normalizePhone(cs.contact_whatsapp)}`;
  }
  const socials    = Object.entries(socialsRaw).filter(([, url]) => url);
  const email      = cs.contact_email;
  const phone      = cs.contact_phone;
  const whatsapp   = cs.contact_whatsapp
    ? `https://wa.me/${normalizePhone(cs.contact_whatsapp)}`
    : null;
  const addr    = cs.contact_address;
  const addressParts = [
    addr?.detail,
    addr?.villageName,
    addr?.districtName,
    addr?.regencyName,
    addr?.provinceName,
    addr?.postalCode,
  ].filter(Boolean);
  const address = addressParts.length > 0 ? addressParts.join(", ") : null;
  const year    = new Date().getFullYear();

  const col1 = navMenu.slice(0, Math.ceil(navMenu.length / 2));
  const col2 = navMenu.slice(Math.ceil(navMenu.length / 2));

  return (
    <footer className="bg-gray-50 text-gray-600 border-t border-gray-200">

      {/* ── Section 1: Identitas + Social CTA ── */}
      <div className="max-w-7xl mx-auto px-4 pt-14 pb-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">

          {/* Kiri: Logo + Nama + Tagline + Deskripsi */}
          <div className="space-y-5">
            <a href={baseUrl || "/"} className="inline-block">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt={siteName} className="h-14 w-auto object-contain" />
              ) : (
                <div
                  className="h-14 w-14 rounded-full flex items-center justify-center font-bold text-2xl bg-primary text-primary-foreground"
                >
                  {siteName.charAt(0)}
                </div>
              )}
            </a>
            <div>
              <p className="text-xs tracking-widest uppercase text-gray-400">{siteName}</p>
              {tagline && (
                <p className="text-2xl font-bold italic text-gray-900 mt-1 leading-snug">{tagline}</p>
              )}
              {description && (
                <p className="text-sm text-gray-600 leading-relaxed mt-3">{description}</p>
              )}
            </div>
          </div>

          {/* Kanan: Stay Connected */}
          {socials.length > 0 && (
            <div className="space-y-4">
              <p className="text-xs tracking-widest uppercase text-gray-400">Stay Connected</p>
              <p className="text-2xl font-bold text-gray-900 leading-snug">
                Support Our Social Media
              </p>
              <SocialLinks value={socialsRaw} variant="brand" size="md" className="pt-1" />
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-gray-200" />

      {/* ── Section 2: Nav + Kontak ── */}
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">

          {navMenu.length > 0 && (
            <div className="space-y-4">
              <p className="text-xs tracking-widest uppercase text-gray-400">Navigation</p>
              <p className="text-xl font-bold text-gray-900">Useful Links</p>
              <div className={`grid gap-x-8 gap-y-2 ${navMenu.length > 3 ? "grid-cols-2" : "grid-cols-1"}`}>
                {col1.map((item: NavItem) => (
                  <a
                    key={item.id}
                    href={resolveNavHref(item)}
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
                    href={resolveNavHref(item)}
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

          {(email || phone || whatsapp || address) && (
            <div className="space-y-4">
              <p className="text-xs tracking-widest uppercase text-gray-400">Contact</p>
              <p className="text-xl font-bold text-gray-900">Contact Us</p>
              {address && (
                <>
                  <p className="text-xs tracking-widest uppercase text-gray-400 mt-4">Alamat</p>
                  <p className="text-sm font-semibold text-gray-800">{address}</p>
                </>
              )}
              <ul className="space-y-3 text-sm text-gray-600 mt-2">
                {email && (
                  <li className="flex items-center gap-2">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4 shrink-0 text-gray-400">
                      <rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                    </svg>
                    <a href={`mailto:${email}`} className="hover:text-gray-900 transition-colors truncate">{email}</a>
                  </li>
                )}
                {phone && (
                  <li className="flex items-center gap-2">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4 shrink-0 text-gray-400">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.28h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 9a16 16 0 0 0 6.06 6.06l1.08-.91a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                    <a href={`tel:${phone}`} className="hover:text-gray-900 transition-colors">{phone}</a>
                  </li>
                )}
                {whatsapp && cs.contact_whatsapp && (
                  <li className="flex items-center gap-2">
                    <svg viewBox="0 0 24 24" fill="#25D366" className="w-4 h-4 shrink-0">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z M11.998 2C6.477 2 2 6.478 2 12c0 1.75.456 3.393 1.252 4.827L2 22l5.293-1.227A9.953 9.953 0 0 0 11.998 22C17.52 22 22 17.522 22 12c0-5.523-4.48-10.002-10.002-10z" />
                    </svg>
                    <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="hover:text-gray-900 transition-colors">{cs.contact_whatsapp}</a>
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* ── Copyright ── */}
      <div className="bg-gray-100 border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-400">
          <span>© {year} {siteName}. All rights reserved.</span>
          <span>Jalakarta &mdash; developed with ❤️ by <span className="text-gray-600 font-semibold">Webane</span></span>
        </div>
      </div>
    </footer>
  );
}
