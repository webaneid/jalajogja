import type { TenantDb } from "@jalajogja/db";
import { getSettings } from "@jalajogja/db";
import type { SectionItem, SectionType, LandingBody, PostsSectionData } from "@/lib/page-templates";
import type { PostsSectionDesignId } from "@/lib/posts-section-designs";
import type { ProductsSectionData, ProductsSectionDesignId } from "@/lib/products-section-designs";
import type { CampaignsSectionData, CampaignsSectionDesignId } from "@/lib/campaigns-section-designs";
import type { EventsSectionData, EventsSectionDesignId } from "@/lib/events-section-designs";
import type { HeroSectionData, HeroSectionDesignId } from "@/lib/hero-section-designs";
import type { ModulesSectionData, ModuleSectionDesignId } from "@/lib/module-strip-designs";
import { PostsSection } from "@/components/website/public/sections/posts/posts-section";
import { ProductsSection } from "@/components/website/public/sections/products/products-section";
import { CampaignsSection } from "@/components/website/public/sections/campaigns/campaigns-section";
import { EventsSection } from "@/components/website/public/sections/events/events-section";
import { HeroSection } from "@/components/website/public/sections/hero/hero-section";
import { ModulesSection } from "@/components/website/public/sections/modules/modules-section";
import { Gallery } from "@/components/gallery/gallery";
import type { GallerySectionData } from "@/lib/gallery-section-designs";
import { PublicButton } from "@/components/website/public/ui/public-button";
import type { PublicButtonVariant } from "@/components/website/public/ui/public-button";
import { PostsSectionTitle } from "@/components/website/public/sections/posts/posts-section-title";
import { displayPhone } from "@/lib/phone";
import { renderAccentTitle } from "@/lib/render-accent-title";
import { stripTenantPrefix } from "@/lib/strip-tenant-prefix";
import type { CtaSectionData } from "@/lib/cta-section-designs";
import type { FeaturesSectionData } from "@/lib/features-section-designs";
import { resolveIcon } from "@/lib/icon-catalog";
import type { AboutSectionData } from "@/lib/about-section-designs";
import { resolveSectionBgClass, resolveOutlineButtonVariant } from "@/lib/section-background";
import { SectionTitleBlock } from "@/components/website/public/sections/section-title-block";
import type { SectionTitleAlign } from "@/lib/section-title-align";

// ─── Section renderers ────────────────────────────────────────────────────────

// Section Galeri Foto — tetap "Design 1" tunggal. Title block + background standar (sama pola
// Tentang Kami), kolom+rasio gambar reuse sistem Gallery bersama (lib/gallery.ts). `param`
// lightbox diturunkan dari `sectionId` (bukan literal "gallery" tetap) — cegah collision kalau
// admin taruh >1 section Galeri Foto di satu landing page. Arsitektur: docs/arsitektur-gallery.md.
function GallerySection({ data, sectionId }: { data: Record<string, unknown>; sectionId: string }) {
  const d = data as GallerySectionData;
  const items = d.items ?? [];
  const background = d.background ?? "none";
  const bgClass = resolveSectionBgClass(background);

  const hasHeader = !!(d.eyebrow || d.title || d.headerDesc);
  // Default "center" (BUKAN "left" seperti Post/Produk/dst) — perilaku asli section ini sebelum
  // opsi align ditambahkan selalu terpusat, data existing tanpa titleAlign harus tetap terpusat.
  const titleAlign   = d.titleAlign ?? "center";
  const alignItemsCls = titleAlign === "center" ? "items-center" : "items-start";
  const textAlignCls  = titleAlign === "center" ? "text-center"  : "text-left";

  return (
    <section className={`py-14 px-4 ${bgClass}`}>
      <div className="max-w-7xl mx-auto">
        {hasHeader && (
          <div className={`flex flex-col mb-10 ${alignItemsCls}`}>
            <SectionTitleBlock
              eyebrow={d.eyebrow}
              title={d.title}
              description={d.headerDesc}
              background={background}
              className={`max-w-3xl ${textAlignCls}`}
            />
          </div>
        )}
        {items.length === 0 ? (
          <p className="text-muted-foreground text-sm">Belum ada gambar.</p>
        ) : (
          <Gallery
            items={items}
            config={{ layout: "grid", columns: d.columns ?? 3, aspectRatio: d.imageRatio ?? "square" }}
            param={`gallery-${sectionId}`}
          />
        )}
      </div>
    </section>
  );
}

// Section Tentang Kami — tetap "Design 1" tunggal, selalu 2 kolom 50/50 (bukan opsi, struktur
// tetap). Sub-opsi: background (standar baru, lib/section-background.ts), lebar, align vertikal
// teks, mode deskripsi teks/list, posisi+rasio gambar. Arsitektur lengkap:
// docs/arsitektur-tentang-kami-section.md
function AboutTextSection({ data, baseUrl, tenantSlug }: { data: Record<string, unknown>; baseUrl: string; tenantSlug: string }) {
  const d = data as AboutSectionData;

  const resolveUrl = (url?: string) => (url && baseUrl === "" ? stripTenantPrefix(url, tenantSlug) : url);
  const ctaUrl = resolveUrl(d.ctaUrl);

  const background     = d.background ?? "none";
  const width           = d.width ?? "full";
  const textVAlign      = d.textVAlign ?? "center";
  const descMode        = d.descMode ?? "text";
  const listDividers    = d.listDividers ?? false;
  const iconStyle       = d.iconStyle ?? "plain";
  const iconColor       = d.iconColor ?? "primary";
  const iconShape       = d.iconShape ?? "square-radius";
  const imagePosition   = d.imagePosition ?? "right";
  const imageRatio      = d.imageRatio ?? "square";
  const imageRadius     = d.imageRadius ?? true;

  const isBoxed = width === "boxed";
  const bgClass = resolveSectionBgClass(background);
  const ctaVariant = resolveOutlineButtonVariant(background);

  const gridAlignCls = textVAlign === "top" ? "items-start" : textVAlign === "bottom" ? "items-end" : "items-center";
  const textOrderCls  = imagePosition === "left" ? "md:order-2" : "md:order-1";
  const imageOrderCls = imagePosition === "left" ? "md:order-1" : "md:order-2";

  const iconBoxShapeCls =
    iconShape === "rounded" ? "rounded-full" :
    iconShape === "square"  ? "rounded-none" :
    "rounded-xl";

  const items = d.items ?? [];

  const listBlock = (
    <div className={listDividers ? "divide-y divide-border" : "space-y-6"}>
      {items.map((item, i) => {
        const Icon = resolveIcon(item.icon);
        const iconNode = iconStyle === "colored" ? (
          <div className={`inline-flex h-11 w-11 shrink-0 items-center justify-center ${iconBoxShapeCls} ${
            iconColor === "secondary" ? "bg-secondary text-secondary-foreground" : "bg-primary text-primary-foreground"
          }`}>
            <Icon className="h-5 w-5" />
          </div>
        ) : (
          <Icon className="h-6 w-6 shrink-0 text-primary" />
        );
        return (
          <div key={i} className={`flex gap-4 ${listDividers ? "py-5 first:pt-0 last:pb-0" : ""}`}>
            {iconNode}
            <div className="min-w-0">
              {item.title && <h3 className="font-semibold mb-1">{item.title}</h3>}
              {item.desc && <p className="text-sm opacity-80 leading-relaxed">{item.desc}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );

  const hasButton = !!(d.ctaLabel && ctaUrl);

  const textColumn = (
    <div className={`space-y-4 ${textOrderCls}`}>
      <SectionTitleBlock eyebrow={d.eyebrow} title={d.title} background={background} />
      {descMode === "text"
        ? (d.body && <p className="text-base opacity-80 leading-relaxed whitespace-pre-line">{d.body}</p>)
        : listBlock}
      {hasButton && (
        <div className="pt-2">
          <PublicButton href={ctaUrl!} variant={ctaVariant}>
            {d.ctaLabel}
          </PublicButton>
        </div>
      )}
    </div>
  );

  const imageColumn = (
    <div className={imageOrderCls}>
      {d.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={d.imageUrl}
          alt={d.title ?? "Tentang Kami"}
          className={`w-full object-cover ${imageRatio === "profile" ? "aspect-[3/4]" : "aspect-square"} ${imageRadius ? "rounded-2xl" : "rounded-none"}`}
        />
      )}
    </div>
  );

  const grid = (
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-14 ${gridAlignCls}`}>
      {textColumn}
      {imageColumn}
    </div>
  );

  if (isBoxed) {
    return (
      <section className="px-4 py-14">
        <div className={`max-w-7xl mx-auto px-6 py-12 sm:px-10 sm:py-14 rounded-3xl ${bgClass}`}>
          {grid}
        </div>
      </section>
    );
  }

  return (
    <section className={`py-14 px-4 ${bgClass}`}>
      <div className="max-w-7xl mx-auto">{grid}</div>
    </section>
  );
}

// Section Keunggulan/Layanan — tetap "Design 1" tunggal, sub-opsi flat field (title block,
// background, width, gaya icon, gaya kartu, highlight item pertama). Arsitektur lengkap:
// docs/arsitektur-keunggulan-section.md
function FeaturesSection({ data }: { data: Record<string, unknown> }) {
  const d = data as FeaturesSectionData;
  const items = d.items ?? [];

  const titleAlign     = d.titleAlign ?? "center";
  const descPosition   = d.descPosition ?? "below";
  const background     = d.background ?? "light";
  const width           = d.width ?? "full";
  const iconStyle       = d.iconStyle ?? "plain";
  const iconColor       = d.iconColor ?? "primary";
  const iconShape       = d.iconShape ?? "square-radius";
  const cardRadius      = d.cardRadius ?? true;
  const cardBackground  = d.cardBackground ?? "white";
  const highlightFirst  = d.highlightFirst ?? false;
  const highlightColor  = d.highlightColor ?? "primary";

  const isBoxed  = width === "boxed";
  const isBeside = descPosition === "beside";

  const bgClass =
    background === "primary"   ? "bg-primary text-primary-foreground" :
    background === "secondary" ? "bg-secondary text-secondary-foreground" :
    background === "white"     ? "bg-white" :
    "bg-muted/40";

  const textAlignCls  = titleAlign === "center" ? "text-center" : titleAlign === "right" ? "text-right" : "text-left";
  const alignItemsCls = titleAlign === "center" ? "items-center" : titleAlign === "right" ? "items-end" : "items-start";

  const hasHeader = !!(d.eyebrow || d.title || d.headerDesc);
  const headerBlock = hasHeader && (
    <div className={`flex flex-col mb-10 ${isBeside ? "md:flex-row md:items-start md:justify-between gap-8" : `${alignItemsCls} gap-2`}`}>
      <SectionTitleBlock
        eyebrow={d.eyebrow}
        title={d.title}
        description={isBeside ? undefined : d.headerDesc}
        background={background === "white" ? "none" : background}
        className={isBeside ? `flex-1 min-w-0 ${textAlignCls}` : `max-w-3xl ${textAlignCls}`}
      />
      {isBeside && d.headerDesc && (
        <p className="text-base opacity-80 leading-relaxed md:max-w-sm md:pt-1">{d.headerDesc}</p>
      )}
    </div>
  );

  const iconBoxShapeCls =
    iconShape === "rounded" ? "rounded-full" :
    iconShape === "square"  ? "rounded-none" :
    "rounded-xl";

  const itemsGrid = (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {items.map((item, i) => {
        const isHighlighted = highlightFirst && i === 0;
        const cardFillCls = isHighlighted
          ? (highlightColor === "secondary" ? "bg-secondary text-secondary-foreground" : "bg-primary text-primary-foreground")
          : (cardBackground === "white" ? "bg-white" : "bg-transparent");
        const Icon = resolveIcon(item.icon);

        const iconNode = iconStyle === "colored" ? (
          <div className={`inline-flex h-12 w-12 items-center justify-center mb-4 ${iconBoxShapeCls} ${
            iconColor === "secondary" ? "bg-secondary text-secondary-foreground" : "bg-primary text-primary-foreground"
          }`}>
            <Icon className="h-6 w-6" />
          </div>
        ) : (
          <Icon className={`h-8 w-8 mb-4 ${isHighlighted ? "" : "text-primary"}`} />
        );

        return (
          <div
            key={i}
            className={`p-6 border border-border ${cardRadius ? "rounded-xl" : "rounded-none"} ${cardFillCls}`}
          >
            {iconNode}
            {item.title && <h3 className="font-semibold mb-2">{item.title}</h3>}
            {item.desc && (
              <p className={`text-sm leading-relaxed ${isHighlighted ? "opacity-85" : "text-muted-foreground"}`}>
                {item.desc}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );

  if (isBoxed) {
    return (
      <section className="px-4 py-14">
        <div className={`max-w-7xl mx-auto px-6 py-12 sm:px-10 sm:py-14 rounded-3xl shadow-sm ${bgClass}`}>
          {headerBlock}
          {itemsGrid}
        </div>
      </section>
    );
  }

  return (
    <section className={`py-14 px-4 ${bgClass}`}>
      <div className="max-w-7xl mx-auto">
        {headerBlock}
        {itemsGrid}
      </div>
    </section>
  );
}

// Section CTA — tetap "Design 1" tunggal, 4 axis sub-opsi (textAlign, background, width,
// buttonPosition) sebagai flat field, bukan section.variant baru. Arsitektur lengkap:
// docs/arsitektur-cta-section.md
function CtaSection({ data, baseUrl, tenantSlug }: { data: Record<string, unknown>; baseUrl: string; tenantSlug: string }) {
  const d = data as CtaSectionData;

  // ctaUrl (dari PublicLinkPicker) selalu berprefix "/{slug}/..." — strip di custom domain.
  // Lihat docs/arsitektur-public-link-picker.md § 9.
  const resolveUrl = (url?: string) => (url && baseUrl === "" ? stripTenantPrefix(url, tenantSlug) : url);
  const ctaUrl          = resolveUrl(d.ctaUrl);
  const ctaSecondaryUrl = resolveUrl(d.ctaSecondaryUrl);

  const textAlign      = d.textAlign ?? "left";
  const background     = d.background ?? "secondary";
  const width           = d.width ?? "full";
  const boxedRadius     = d.boxedRadius ?? true;
  const buttonPosition = d.buttonPosition ?? "below";

  const isPrimaryBg = background === "primary";
  const isBoxed     = width === "boxed";
  const isBeside    = buttonPosition === "beside";

  const bgClass = isPrimaryBg ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground";
  const primaryVariant: PublicButtonVariant = isPrimaryBg ? "secondary" : "light";

  const alignItemsCls = textAlign === "center" ? "items-center" : textAlign === "right" ? "items-end" : "items-start";
  const textAlignCls  = textAlign === "center" ? "text-center"  : textAlign === "right" ? "text-right"  : "text-left";
  const justifyCls    = textAlign === "center" ? "justify-center" : textAlign === "right" ? "justify-end" : "justify-start";

  const hasPrimaryBtn   = !!(d.ctaLabel && ctaUrl);
  const hasSecondaryBtn = !!(d.ctaSecondaryLabel && ctaSecondaryUrl);
  const buttonsNode = (hasPrimaryBtn || hasSecondaryBtn) ? (
    <div className={`flex flex-wrap gap-3 ${isBeside ? "shrink-0" : justifyCls}`}>
      {hasPrimaryBtn && (
        <PublicButton href={ctaUrl!} variant={primaryVariant} size="lg">
          {d.ctaLabel}
        </PublicButton>
      )}
      {hasSecondaryBtn && (
        <PublicButton href={ctaSecondaryUrl!} variant="outline-light" size="lg">
          {d.ctaSecondaryLabel}
        </PublicButton>
      )}
    </div>
  ) : null;

  const content = (
    <div className={`relative flex flex-col ${isBeside ? "md:flex-row md:items-center md:justify-between gap-8" : `${alignItemsCls} gap-4`}`}>
      <div className={`${isBeside ? "flex-1 min-w-0" : "max-w-4xl"} ${textAlignCls}`}>
        {d.title && (
          <h2 className="text-3xl sm:text-4xl md:text-5xl xl:text-6xl font-bold leading-[1.1] tracking-tight mb-4">
            {renderAccentTitle(d.title)}
          </h2>
        )}
        {d.subtitle && (
          <p className="text-lg opacity-85 leading-relaxed">
            {d.subtitle}
          </p>
        )}
        {!isBeside && buttonsNode && <div className="mt-6">{buttonsNode}</div>}
      </div>
      {isBeside && buttonsNode}
    </div>
  );

  const gradientOverlay = (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundImage:
          "radial-gradient(circle at 10% 30%, rgba(255,255,255,0.08) 0, transparent 40%), radial-gradient(circle at 90% 70%, rgba(0,0,0,0.1) 0, transparent 40%)",
      }}
    />
  );

  if (isBoxed) {
    return (
      <section className="px-4 py-14">
        <div className={`relative overflow-hidden max-w-7xl mx-auto px-6 py-14 sm:px-12 sm:py-16 ${bgClass} ${boxedRadius ? "rounded-3xl" : ""}`}>
          {gradientOverlay}
          {content}
        </div>
      </section>
    );
  }

  return (
    <section className={`relative overflow-hidden px-4 ${bgClass}`} style={{ paddingTop: 96, paddingBottom: 96 }}>
      {gradientOverlay}
      <div className="relative max-w-7xl mx-auto">{content}</div>
    </section>
  );
}

type ContactSettings = Record<string, unknown>;

function ContactInfoSection({ settings }: { settings: ContactSettings }) {
  const email   = settings.contact_email   as string | undefined;
  const phone   = settings.contact_phone   as string | undefined;
  const address = settings.contact_address as { detail?: string } | undefined;
  const socials = settings.socials         as Record<string, string> | undefined;

  return (
    <section className="py-14 px-4 bg-muted/40">
      <div className="max-w-7xl mx-auto">
      <div className="max-w-2xl space-y-4">
        <h2 className="section-title !mb-6">Info Kontak</h2>
        {email   && <p className="text-sm">📧 <a href={`mailto:${email}`} className="text-primary underline">{email}</a></p>}
        {phone   && <p className="text-sm">📞 <a href={`tel:${phone}`}   className="text-primary underline">{displayPhone(phone)}</a></p>}
        {address?.detail && <p className="text-sm">📍 {address.detail}</p>}
        {socials && (
          <div className="flex gap-3 flex-wrap pt-2">
            {Object.entries(socials)
              .filter(([, url]) => url)
              .map(([platform, url]) => (
                <a
                  key={platform}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-3 py-1.5 border border-border rounded-full hover:border-primary hover:text-primary transition-colors capitalize"
                >
                  {platform}
                </a>
              ))}
          </div>
        )}
      </div>
      </div>
    </section>
  );
}

type StatItem = { number: string; label: string };

function StatsSection({ data }: { data: Record<string, unknown> }) {
  const d = data as { eyebrow?: string; title?: string; headerDesc?: string; titleAlign?: SectionTitleAlign; items?: StatItem[] };
  const items = d.items ?? [];
  const hasHeader = !!(d.eyebrow || d.title || d.headerDesc);
  // Default "center" (BUKAN "left" seperti Post/Produk/dst) — perilaku asli section ini sebelum
  // opsi align ditambahkan selalu terpusat, data existing tanpa titleAlign harus tetap terpusat.
  const titleAlign   = d.titleAlign ?? "center";
  const alignItemsCls = titleAlign === "center" ? "items-center" : "items-start";
  const textAlignCls  = titleAlign === "center" ? "text-center"  : "text-left";

  return (
    <section className="py-14 px-4">
      <div className="max-w-7xl mx-auto">
        {hasHeader && (
          <div className={`flex flex-col mb-10 ${alignItemsCls}`}>
            <SectionTitleBlock
              eyebrow={d.eyebrow}
              title={d.title}
              description={d.headerDesc}
              className={`max-w-3xl ${textAlignCls}`}
            />
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {items.map((item, i) => (
            <div key={i}>
              <div className="text-3xl font-bold text-primary">{item.number}</div>
              <div className="text-sm text-muted-foreground mt-1">{item.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function DividerSection({ data }: { data: Record<string, unknown> }) {
  const d = data as { height?: number; bgColor?: string };
  return (
    <div
      style={{
        height:          `${d.height ?? 64}px`,
        backgroundColor: d.bgColor || "transparent",
      }}
    />
  );
}

// ─── LandingTemplate ──────────────────────────────────────────────────────────

type Props = {
  body:         LandingBody;
  tenantSlug:   string;
  tenantClient: TenantDb;
  baseUrl:      string;
};

export async function LandingTemplate({ body, tenantSlug, tenantClient, baseUrl }: Props) {
  let contactSettings: ContactSettings = {};

  if (body.sections.some(s => s.type === "contact_info")) {
    contactSettings = await getSettings(tenantClient, "contact");
  }

  return (
    <>
      {body.sections.map((section) => (
        <SectionRenderer
          key={section.id}
          section={section}
          tenantSlug={tenantSlug}
          tenantClient={tenantClient}
          contactSettings={contactSettings}
          baseUrl={baseUrl}
        />
      ))}
    </>
  );
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

function SectionRenderer({
  section, tenantSlug, tenantClient, contactSettings, baseUrl,
}: {
  section:         SectionItem;
  tenantSlug:      string;
  tenantClient:    TenantDb;
  contactSettings: ContactSettings;
  baseUrl:         string;
}) {
  switch (section.type) {
    case "hero":         return (
      <HeroSection
        data={section.data as HeroSectionData}
        variant={(section.variant ?? "1") as HeroSectionDesignId}
        tenantClient={tenantClient}
        tenantSlug={tenantSlug}
        baseUrl={baseUrl}
      />
    );
    case "posts":        return (
      <PostsSection
        data={section.data as PostsSectionData}
        variant={(section.variant ?? "1") as PostsSectionDesignId}
        tenantClient={tenantClient}
        tenantSlug={tenantSlug}
      />
    );
    case "products":     return (
      <ProductsSection
        data={section.data as ProductsSectionData}
        variant={(section.variant ?? "1") as ProductsSectionDesignId}
        tenantClient={tenantClient}
        tenantSlug={tenantSlug}
      />
    );
    case "events":       return (
      <EventsSection
        data={section.data as EventsSectionData}
        variant={(section.variant ?? "1") as EventsSectionDesignId}
        tenantClient={tenantClient}
        tenantSlug={tenantSlug}
      />
    );
    case "campaigns":    return (
      <CampaignsSection
        data={section.data as CampaignsSectionData}
        variant={(section.variant ?? "1") as CampaignsSectionDesignId}
        tenantClient={tenantClient}
        tenantSlug={tenantSlug}
      />
    );
    case "gallery":      return <GallerySection       data={section.data} sectionId={section.id} />;
    case "about_text":   return <AboutTextSection     data={section.data} baseUrl={baseUrl} tenantSlug={tenantSlug} />;
    case "features":     return <FeaturesSection      data={section.data} />;
    case "cta":          return <CtaSection           data={section.data} baseUrl={baseUrl} tenantSlug={tenantSlug} />;
    case "contact_info": return <ContactInfoSection   settings={contactSettings} />;
    case "stats":        return <StatsSection         data={section.data} />;
    case "divider":      return <DividerSection       data={section.data} />;
    case "modules":       return (
      <ModulesSection
        data={section.data as ModulesSectionData}
        variant={(section.variant ?? "1") as ModuleSectionDesignId}
        tenantClient={tenantClient}
        tenantSlug={tenantSlug}
        baseUrl={baseUrl}
      />
    );
    default:             return null;
  }
}
