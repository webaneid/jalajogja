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
import type { GalleryItem, GalleryConfig } from "@/lib/gallery";
import { PublicButton } from "@/components/website/public/ui/public-button";
import { PostsSectionTitle } from "@/components/website/public/sections/posts/posts-section-title";
import { renderAccentTitle } from "@/lib/render-accent-title";
import { stripTenantPrefix } from "@/lib/strip-tenant-prefix";

// ─── Section renderers ────────────────────────────────────────────────────────

function GallerySection({ data }: { data: Record<string, unknown> }) {
  const d = data as {
    title?:   string;
    items?:   GalleryItem[];
    layout?:  GalleryConfig["layout"];
    columns?: GalleryConfig["columns"];
  };
  const items = d.items ?? [];

  return (
    <section className="py-14 px-4">
      <div className="max-w-7xl mx-auto">
        {d.title && <PostsSectionTitle title={d.title} />}
        {items.length === 0 ? (
          <p className="text-muted-foreground text-sm">Belum ada gambar.</p>
        ) : (
          <Gallery
            items={items}
            config={{ layout: d.layout ?? "grid", columns: d.columns ?? 3 }}
            param="gallery"
          />
        )}
      </div>
    </section>
  );
}

function AboutTextSection({ data }: { data: Record<string, unknown> }) {
  const d = data as { title?: string; body?: string; imageUrl?: string; imagePosition?: string };
  const imgRight = (d.imagePosition ?? "right") === "right";

  return (
    <section className="py-14 px-4">
      <div className="max-w-7xl mx-auto">
        {d.title && <PostsSectionTitle title={d.title} />}
        <div className={`flex flex-col ${imgRight ? "md:flex-row" : "md:flex-row-reverse"} items-center gap-10`}>
          <div className="flex-1">
            {d.body && <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{d.body}</p>}
          </div>
          {d.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={d.imageUrl}
              alt={d.title ?? "Tentang Kami"}
              className="w-full md:w-80 rounded-xl object-cover"
            />
          )}
        </div>
      </div>
    </section>
  );
}

type FeatureItem = { icon: string; title: string; desc: string };

function FeaturesSection({ data }: { data: Record<string, unknown> }) {
  const d = data as { title?: string; items?: FeatureItem[] };
  const items = d.items ?? [];

  return (
    <section className="py-14 px-4 bg-muted/40">
      <div className="max-w-7xl mx-auto">
        {d.title && <PostsSectionTitle title={d.title} className="justify-center text-center" />}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item, i) => (
            <div key={i} className="bg-white rounded-xl border border-border p-6">
              {item.icon && <div className="text-3xl mb-3">{item.icon}</div>}
              <h3 className="font-semibold mb-2">{item.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaSection({ data, baseUrl, tenantSlug }: { data: Record<string, unknown>; baseUrl: string; tenantSlug: string }) {
  const d = data as { title?: string; subtitle?: string; ctaLabel?: string; ctaUrl?: string };
  // ctaUrl (dari PublicLinkPicker) selalu berprefix "/{slug}/..." — strip di custom domain.
  // Lihat docs/arsitektur-public-link-picker.md § 9.
  const ctaUrl = d.ctaUrl && baseUrl === "" ? stripTenantPrefix(d.ctaUrl, tenantSlug) : d.ctaUrl;

  return (
    <section className="relative overflow-hidden px-4 bg-secondary text-secondary-foreground" style={{ paddingTop: 96, paddingBottom: 96 }}>
      {/* Radial gradient overlay — subtle depth */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle at 10% 30%, rgba(255,255,255,0.08) 0, transparent 40%), radial-gradient(circle at 90% 70%, rgba(0,0,0,0.1) 0, transparent 40%)",
        }}
      />

      <div className="relative max-w-7xl mx-auto">
        {d.title && (
          <h2
            className="font-normal mb-6 max-w-[900px]"
            style={{ fontSize: "clamp(48px, 6vw, 88px)", lineHeight: 0.95 }}
          >
            {renderAccentTitle(d.title)}
          </h2>
        )}
        {d.subtitle && (
          <p className="text-lg max-w-xl mb-8 opacity-85 leading-relaxed">
            {d.subtitle}
          </p>
        )}
        {d.ctaLabel && ctaUrl && (
          <PublicButton href={ctaUrl} variant="light" size="lg">
            {d.ctaLabel as string}
          </PublicButton>
        )}
      </div>
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
        <h2 className="text-2xl font-bold mb-6">Info Kontak</h2>
        {email   && <p className="text-sm">📧 <a href={`mailto:${email}`} className="text-primary underline">{email}</a></p>}
        {phone   && <p className="text-sm">📞 <a href={`tel:${phone}`}   className="text-primary underline">{phone}</a></p>}
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
  const d = data as { items?: StatItem[] };
  const items = d.items ?? [];

  return (
    <section className="py-14 px-4">
      <div className="max-w-7xl mx-auto">
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
    case "gallery":      return <GallerySection       data={section.data} />;
    case "about_text":   return <AboutTextSection     data={section.data} />;
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
