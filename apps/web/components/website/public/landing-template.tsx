import { desc, eq, gt, and } from "drizzle-orm";
import type { TenantDb } from "@jalajogja/db";
import { getSettings } from "@jalajogja/db";
import type { SectionItem, SectionType, LandingBody, PostsSectionData } from "@/lib/page-templates";
import type { PostsSectionDesignId } from "@/lib/posts-section-designs";
import type { ProductsSectionData, ProductsSectionDesignId } from "@/lib/products-section-designs";
import type { CampaignsSectionData, CampaignsSectionDesignId } from "@/lib/campaigns-section-designs";
import type { EventsSectionData, EventsSectionDesignId } from "@/lib/events-section-designs";
import { PostsSection } from "@/components/website/public/sections/posts/posts-section";
import { ProductsSection } from "@/components/website/public/sections/products/products-section";
import { CampaignsSection } from "@/components/website/public/sections/campaigns/campaigns-section";
import { EventsSection } from "@/components/website/public/sections/events/events-section";
import { Gallery } from "@/components/gallery/gallery";
import type { GalleryItem, GalleryConfig } from "@/lib/gallery";
import { PublicButton } from "@/components/website/public/ui/public-button";

// ─── Section renderers ────────────────────────────────────────────────────────

type HeroCardData = {
  type:  "event" | "post";
  label: string;
  title: string;
  href:  string;
  date:  string | null;
};

async function HeroSection({ data, tenantClient, tenantSlug }: {
  data:         Record<string, unknown>;
  tenantClient: TenantDb;
  tenantSlug:   string;
}) {
  const d = data as {
    eyebrow?: string;
    title?: string;
    subtitle?: string;
    ctaLabel?: string;
    ctaUrl?: string;
    ctaSecondaryLabel?: string;
    ctaSecondaryUrl?: string;
    imageUrl?: string;
  };

  const hasImage = !!d.imageUrl;

  // Fetch floating card: event mendatang → berita terbaru
  let heroCard: HeroCardData | null = null;
  if (hasImage) {
    const { db: tenantDb, schema } = tenantClient;
    const now = new Date();

    const [upcomingEvent] = await tenantDb
      .select({ title: schema.events.title, slug: schema.events.slug, startsAt: schema.events.startsAt })
      .from(schema.events)
      .where(and(eq(schema.events.status, "published"), gt(schema.events.startsAt, now)))
      .orderBy(schema.events.startsAt)
      .limit(1);

    if (upcomingEvent) {
      heroCard = {
        type:  "event",
        label: "Agenda Terbaru",
        title: upcomingEvent.title,
        href:  `/${tenantSlug}/agenda/${upcomingEvent.slug}`,
        date:  upcomingEvent.startsAt
          ? new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(upcomingEvent.startsAt)
          : null,
      };
    } else {
      const [latestPost] = await tenantDb
        .select({ title: schema.posts.title, slug: schema.posts.slug, publishedAt: schema.posts.publishedAt })
        .from(schema.posts)
        .where(eq(schema.posts.status, "published"))
        .orderBy(desc(schema.posts.publishedAt))
        .limit(1);

      if (latestPost) {
        heroCard = {
          type:  "post",
          label: "Berita Terbaru",
          title: latestPost.title,
          href:  `/${tenantSlug}/post/${latestPost.slug}`,
          date:  latestPost.publishedAt
            ? new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(latestPost.publishedAt)
            : null,
        };
      }
    }
  }

  return (
    <section className="py-16 px-4 overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className={`grid grid-cols-1 items-center gap-10 ${hasImage ? "lg:grid-cols-2 lg:gap-16" : ""}`}>

          {/* Kiri: konten teks */}
          <div className={`space-y-6 ${!hasImage ? "max-w-2xl mx-auto text-center" : ""}`}>
            {d.eyebrow && (
              <div className={`flex items-center gap-2.5 text-xs font-mono uppercase tracking-widest text-muted-foreground ${!hasImage ? "justify-center" : ""}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 animate-pulse" />
                {d.eyebrow}
              </div>
            )}
            {d.title && (
              <h1 className="text-4xl md:text-5xl xl:text-6xl font-bold leading-[1.08] tracking-tight">
                {d.title}
              </h1>
            )}
            {d.subtitle && (
              <p className={`text-lg text-muted-foreground leading-relaxed ${!hasImage ? "mx-auto" : ""} max-w-lg`}>
                {d.subtitle}
              </p>
            )}
            {(d.ctaLabel || d.ctaSecondaryLabel) && (
              <div className={`flex gap-3 flex-wrap pt-2 ${!hasImage ? "justify-center" : ""}`}>
                {d.ctaLabel && d.ctaUrl && (
                  <PublicButton href={d.ctaUrl as string} variant="primary" size="lg">
                    {d.ctaLabel as string}
                  </PublicButton>
                )}
                {d.ctaSecondaryLabel && d.ctaSecondaryUrl && (
                  <PublicButton href={d.ctaSecondaryUrl as string} variant="ghost" size="lg" icon="none">
                    {d.ctaSecondaryLabel as string}
                  </PublicButton>
                )}
              </div>
            )}
          </div>

          {/* Kanan: gambar portrait + floating card */}
          {hasImage && (
            <div className="flex justify-center lg:justify-end">
              <div className="relative w-full max-w-xs sm:max-w-sm">
                <div className="absolute -inset-4 rounded-3xl bg-primary/5 -z-10" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={d.imageUrl!}
                  alt={d.title ?? ""}
                  className="w-full aspect-[3/4] object-cover rounded-2xl shadow-xl"
                />

                {/* Floating card — event mendatang atau berita terbaru */}
                {heroCard && (
                  <a
                    href={heroCard.href}
                    className="absolute bottom-4 left-4 right-4 bg-primary text-primary-foreground rounded-2xl px-4 py-3 no-underline hover:opacity-90 transition-opacity"
                  >
                    <p className="text-[10px] font-mono uppercase tracking-widest opacity-75 mb-1">
                      {heroCard.label}
                    </p>
                    <p className="text-sm font-semibold leading-snug line-clamp-2">
                      {heroCard.title}
                    </p>
                    {heroCard.date && (
                      <p className="text-[11px] opacity-70 mt-1.5">{heroCard.date}</p>
                    )}
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

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
        {d.title && <h2 className="text-2xl font-bold mb-6">{d.title}</h2>}
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
      <div className={`max-w-7xl mx-auto flex flex-col ${imgRight ? "md:flex-row" : "md:flex-row-reverse"} items-center gap-10`}>
        <div className="flex-1">
          {d.title && <h2 className="text-2xl font-bold mb-4">{d.title}</h2>}
          {d.body  && <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{d.body}</p>}
        </div>
        {d.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={d.imageUrl}
            alt={d.title ?? "Tentang Kami"}
            className="w-full md:w-80 rounded-xl object-cover border border-border"
          />
        )}
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
        {d.title && <h2 className="text-2xl font-bold mb-10 text-center">{d.title}</h2>}
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

function CtaSection({ data }: { data: Record<string, unknown> }) {
  const d = data as { title?: string; subtitle?: string; ctaLabel?: string; ctaUrl?: string; bgColor?: string };
  const bg = { backgroundColor: d.bgColor ?? "#1e40af" };

  return (
    <section className="py-16 px-4 text-center text-white" style={bg}>
      <div className="max-w-2xl mx-auto space-y-4">
        {d.title    && <h2 className="text-3xl font-bold">{d.title}</h2>}
        {d.subtitle && <p className="text-white/90">{d.subtitle}</p>}
        {d.ctaLabel && d.ctaUrl && (
          <PublicButton href={d.ctaUrl as string} variant="light" size="lg" className="mt-2">
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
};

export async function LandingTemplate({ body, tenantSlug, tenantClient }: Props) {
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
        />
      ))}
    </>
  );
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

function SectionRenderer({
  section, tenantSlug, tenantClient, contactSettings,
}: {
  section:         SectionItem;
  tenantSlug:      string;
  tenantClient:    TenantDb;
  contactSettings: ContactSettings;
}) {
  switch (section.type) {
    case "hero":         return <HeroSection data={section.data} tenantClient={tenantClient} tenantSlug={tenantSlug} />;
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
    case "cta":          return <CtaSection           data={section.data} />;
    case "contact_info": return <ContactInfoSection   settings={contactSettings} />;
    case "stats":        return <StatsSection         data={section.data} />;
    case "divider":      return <DividerSection       data={section.data} />;
    default:             return null;
  }
}
