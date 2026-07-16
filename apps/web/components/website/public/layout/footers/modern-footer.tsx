import { type NavItem, resolveNavHref } from "@/lib/nav-menu";
import type { FooterProps } from "@/lib/footer-designs";
import { SocialLinks } from "@/components/ui/social-links";

// ── ModernFooter — kartu gelap dengan sudut atas melengkung ───────────────────
// Sumber ide: design-refs/jalakarta-v2/ (lihat design-refs/README.md). Struktur data
// (email/phone/whatsapp/address/socials) identik dengan DarkFooter/LightFooter —
// bedanya di layout (1 baris 3-kolom, bukan 2-section) dan bentuk (sudut atas rounded).

function normalizePhone(phone: string): string {
  const digits = String(phone).replace(/\D/g, "");
  return digits.startsWith("0") ? "62" + digits.slice(1) : digits;
}

export function ModernFooter({
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
  const cs = contactSettings as {
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
    socials?: Record<string, string>;
  };
  const socialsRaw = { ...(cs.socials ?? {}) } as Record<string, string>;
  if (cs.contact_whatsapp && !socialsRaw.whatsapp) {
    socialsRaw.whatsapp = `https://wa.me/${normalizePhone(cs.contact_whatsapp)}`;
  }
  const hasSocials = Object.values(socialsRaw).some(Boolean);
  const email      = cs.contact_email;
  const phone      = cs.contact_phone;
  const addr       = cs.contact_address;
  const addressParts = [
    addr?.detail,
    addr?.villageName,
    addr?.districtName,
    addr?.regencyName,
    addr?.provinceName,
    addr?.postalCode,
  ].filter(Boolean);
  const address = addressParts.length > 0 ? addressParts.join(", ") : null;
  const year     = new Date().getFullYear();

  return (
    <footer className="bg-neutral-900 text-white rounded-t-[32px] overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 pt-12 pb-10 grid grid-cols-1 md:grid-cols-3 gap-8">

        {/* Brand + deskripsi + social — nama tenant HANYA tampil sebagai fallback saat belum upload logo */}
        <div>
          <a href={baseUrl || "/"} className="inline-flex items-center gap-2.5 mb-3">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={siteName} className="h-9 w-auto object-contain brightness-0 invert" />
            ) : (
              <>
                <span className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shrink-0">
                  {siteName.charAt(0).toUpperCase()}
                </span>
                <span className="font-bold text-sm">{siteName}</span>
              </>
            )}
          </a>
          {description && (
            <p className="text-sm text-white/65 max-w-[36ch] mb-4 leading-relaxed">{description}</p>
          )}
          {hasSocials && <SocialLinks value={socialsRaw} variant="brand" size="sm" />}
        </div>

        {/* Navigasi */}
        {navMenu.length > 0 && (
          <div>
            <h6 className="text-white/55 text-xs tracking-widest uppercase mb-3">Navigasi</h6>
            <div className="flex flex-col gap-2 text-sm">
              {navMenu.map((item: NavItem) => (
                <a
                  key={item.id}
                  href={resolveNavHref(item)}
                  target={item.external ? "_blank" : undefined}
                  rel={item.external ? "noopener noreferrer" : undefined}
                  className="text-white/85 hover:text-white transition-colors"
                >
                  {item.label}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Kontak */}
        {(email || phone || address) && (
          <div>
            <h6 className="text-white/55 text-xs tracking-widest uppercase mb-3">Kontak</h6>
            {address && <p className="text-sm text-white/80 mb-2">{address}</p>}
            <p className="text-sm text-white/80">
              {[phone, email].filter(Boolean).join(" · ")}
            </p>
          </div>
        )}
      </div>

      <div className="border-t border-white/10 px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-1 text-[11px] text-white/50">
          <span>© {year} {siteName}. Seluruh hak cipta dilindungi.</span>
          {/* Atribusi Jalakarta hanya tampil di domain sendiri — custom domain harus murni tenant-branded */}
          {baseUrl !== "" && (
            <span>Jalakarta &mdash; developed with ❤️ by <span className="font-semibold text-white/70">Webane</span></span>
          )}
        </div>
      </div>
    </footer>
  );
}
