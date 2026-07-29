import { type NavItem, resolveNavHref } from "@/lib/nav-menu";
import type { FooterProps } from "@/lib/footer-designs";
import { SocialLinks } from "@/components/ui/social-links";
import { displayPhone, toWaDigits } from "@/lib/phone";
import { Phone, Mail, MapPin } from "lucide-react";

export function ForcreatorFooter({
  tenantSlug,
  siteName,
  logoUrl,
  footerLogoUrl,
  tagline,
  description,
  navMenu,
  contactSettings,
  secondaryColor,
  memberInstagrams,
  baseUrl,
}: FooterProps) {
  const effectiveLogo = footerLogoUrl || logoUrl;
  const cs = contactSettings as {
    contact_email?: string;
    contact_phone?: string;
    contact_whatsapp?: string;
    contact_address?: {
      detail?: string;
      provinceName?: string;
      regencyName?: string;
      districtName?: string;
      villageName?: string;
      postalCode?: string;
    };
    socials?: Record<string, string>;
  };

  const socialsRaw = { ...(cs.socials ?? {}) } as Record<string, string>;
  if (cs.contact_whatsapp && !socialsRaw.whatsapp) {
    socialsRaw.whatsapp = `https://wa.me/${toWaDigits(cs.contact_whatsapp)}`;
  }
  const email = cs.contact_email;
  const phone = cs.contact_phone;
  const addr = cs.contact_address;
  const addressParts = [
    addr?.detail,
    addr?.villageName,
    addr?.districtName,
    addr?.regencyName,
    addr?.provinceName,
    addr?.postalCode,
  ].filter(Boolean);
  const address = addressParts.length > 0 ? addressParts.join(", ") : null;
  const year = new Date().getFullYear();

  // Mempersiapkan akun Instagram untuk marquee ticker
  const instagramList =
    memberInstagrams && memberInstagrams.length > 0
      ? memberInstagrams.map((i) => (i.startsWith("@") ? i : `@${i}`))
      : [`@${tenantSlug}`, `@${siteName.toLowerCase().replace(/\s+/g, "")}`, `@forcreator`];

  // Duplikasi list agar marquee berjalan mulus tanpa gap
  const marqueeItems = [...instagramList, ...instagramList, ...instagramList, ...instagramList];

  const accentColor = secondaryColor || "var(--secondary, #ea580c)";

  return (
    <footer className="bg-black text-white overflow-hidden">
      {/* ── ROW 1: Top Bar Marquee (Running Text dalam container max-w-7xl) ── */}
      <div
        className="py-3 select-none"
        style={{ backgroundColor: accentColor }}
      >
        <div className="max-w-7xl mx-auto px-4 overflow-hidden">
          <div className="flex w-max animate-marquee gap-8 items-center text-white text-sm md:text-base font-bold tracking-wide">
            {marqueeItems.map((handle, idx) => (
              <span key={`${handle}-${idx}`} className="inline-flex items-center gap-8">
                <span>{handle}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── ROW 2: Middle Section (2-Row Grid) ── */}
      <div className="max-w-7xl mx-auto px-4 pt-12 pb-14 space-y-12">
        {/* Row Atas: Logo Footer (Kiri) & Social Media (Kanan) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          {/* Kolom Kiri: Logo Footer (diperbesar > 30%) */}
          <div>
            <a href={baseUrl || "/"} className="inline-block">
              {effectiveLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={effectiveLogo}
                  alt={siteName}
                  className="h-24 md:h-28 w-auto object-contain max-w-[320px]"
                />
              ) : (
                <div className="flex items-center gap-3">
                  <div className="h-16 w-16 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center font-bold text-2xl">
                    {siteName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <span className="font-bold text-xl md:text-2xl text-white block">{siteName}</span>
                    {tagline && <span className="text-xs md:text-sm text-neutral-400 block">{tagline}</span>}
                  </div>
                </div>
              )}
            </a>
          </div>

          {/* Kolom Kanan: Social Media (Align Top Right) */}
          <div className="flex justify-start md:justify-end items-start">
            <SocialLinks value={socialsRaw} variant="brand" size="md" />
          </div>
        </div>

        {/* Row Bawah: Deskripsi + Navigation (Kiri) & Contact Us (Kanan) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-4">
          {/* Kolom Kiri: Deskripsi & Useful Links */}
          <div className="space-y-8">
            {(description || tagline) && (
              <p className="text-sm text-neutral-300 leading-relaxed max-w-md">
                {description || tagline}
              </p>
            )}

            {navMenu.length > 0 && (
              <div className="space-y-3">
                <span className="text-xs font-semibold uppercase tracking-wider block" style={{ color: accentColor }}>
                  Navigation
                </span>
                <h4 className="text-2xl font-bold text-white tracking-tight">useful Links</h4>

                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                  {navMenu.map((item) => {
                    const href = resolveNavHref(item);
                    const isExt = item.external ?? false;
                    return (
                      <li key={item.id}>
                        <a
                          href={href}
                          target={isExt ? "_blank" : undefined}
                          rel={isExt ? "noopener noreferrer" : undefined}
                          className="text-sm text-neutral-300 hover:text-white transition-colors block py-0.5"
                        >
                          {item.label}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>

          {/* Kolom Kanan: Contact Us */}
          <div className="space-y-6">
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider block" style={{ color: accentColor }}>
                Contact
              </span>
              <h4 className="text-2xl font-bold text-white tracking-tight">Contact Us</h4>
            </div>

            <div className="space-y-4 text-sm text-neutral-300">
              {address && (
                <div className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wider block" style={{ color: accentColor }}>
                    Alamat
                  </span>
                  <div className="flex items-start gap-2 pt-0.5">
                    <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-neutral-400" />
                    <p className="leading-relaxed text-neutral-200">{address}</p>
                  </div>
                </div>
              )}

              {phone && (
                <div className="flex items-center gap-2 pt-1">
                  <Phone className="h-4 w-4 shrink-0 text-neutral-400" />
                  <a href={`tel:${phone}`} className="hover:text-white transition-colors">
                    {displayPhone(phone)}
                  </a>
                </div>
              )}

              {email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 shrink-0 text-neutral-400" />
                  <a href={`mailto:${email}`} className="hover:text-white transition-colors">
                    {email}
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── ROW 3: Bottom Copyright Bar ── */}
      <div className="border-t border-neutral-800 bg-black">
        <div className="max-w-7xl mx-auto px-4 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-neutral-400">
          <p>© {year} {siteName}. All rights reserved.</p>

          {baseUrl !== "" && (
            <p className="text-neutral-500">
              Jalakarta — developed with ❤️ by{" "}
              <a
                href="https://webane.net"
                target="_blank"
                rel="noopener noreferrer"
                className="text-neutral-400 hover:text-white transition-colors font-medium"
              >
                Webane
              </a>
            </p>
          )}
        </div>
      </div>
    </footer>
  );
}
