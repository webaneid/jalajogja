import { desc, eq, lte, gte, and } from "drizzle-orm";
import type { TenantDb } from "@jalajogja/db";
import { getSettings } from "@jalajogja/db";
import type { SectionItem, SectionType, LandingBody } from "@/lib/page-templates";

// ─── Data helpers ─────────────────────────────────────────────────────────────

async function fetchPosts(tenantClient: TenantDb, count: number) {
  const { db, schema } = tenantClient;
  return db
    .select({
      id:          schema.posts.id,
      title:       schema.posts.title,
      slug:        schema.posts.slug,
      excerpt:     schema.posts.excerpt,
      publishedAt: schema.posts.publishedAt,
    })
    .from(schema.posts)
    .where(eq(schema.posts.status, "published"))
    .orderBy(desc(schema.posts.publishedAt))
    .limit(count);
}

async function fetchEvents(tenantClient: TenantDb, count: number) {
  const { db, schema } = tenantClient;
  const now = new Date();
  return db
    .select({
      id:       schema.events.id,
      title:    schema.events.title,
      slug:     schema.events.slug,
      startsAt: schema.events.startsAt,
      endsAt:   schema.events.endsAt,
    })
    .from(schema.events)
    .where(
      and(
        eq(schema.events.status, "published"),
        gte(schema.events.startsAt, now)
      )
    )
    .orderBy(schema.events.startsAt)
    .limit(count);
}

// ─── Section renderers ────────────────────────────────────────────────────────

function HeroSection({ data }: { data: Record<string, unknown> }) {
  const d = data as { title?: string; subtitle?: string; ctaLabel?: string; ctaUrl?: string; bgColor?: string; bgImageUrl?: string };
  const bg = d.bgImageUrl
    ? { backgroundImage: `url(${d.bgImageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
    : { backgroundColor: d.bgColor ?? "#1e40af" };

  return (
    <section className="relative py-20 px-4 text-center text-white" style={bg}>
      {d.bgImageUrl && <div className="absolute inset-0 bg-black/40" />}
      <div className="relative z-10 max-w-3xl mx-auto space-y-4">
        {d.title    && <h1 className="text-4xl font-bold leading-tight">{d.title}</h1>}
        {d.subtitle && <p className="text-lg text-white/90">{d.subtitle}</p>}
        {d.ctaLabel && d.ctaUrl && (
          <a
            href={d.ctaUrl}
            className="inline-block mt-4 px-6 py-3 bg-white text-gray-900 font-semibold rounded-lg hover:bg-gray-100 transition-colors"
          >
            {d.ctaLabel}
          </a>
        )}
      </div>
    </section>
  );
}

type PostRow = { id: string; title: string; slug: string; excerpt: string | null; publishedAt: Date | null };

function PostsSection({
  data, posts, tenantSlug,
}: {
  data:       Record<string, unknown>;
  posts:      PostRow[];
  tenantSlug: string;
}) {
  const d = data as { title?: string };
  const fmt = (date: Date | null) =>
    date ? new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(date) : "";

  return (
    <section className="py-14 px-4 bg-muted/40">
      <div className="max-w-5xl mx-auto">
        {d.title && <h2 className="text-2xl font-bold mb-8">{d.title}</h2>}
        {posts.length === 0 ? (
          <p className="text-muted-foreground text-sm">Belum ada postingan.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {posts.map((post) => (
              <a
                key={post.id}
                href={`/${tenantSlug}/blog/${post.slug}`}
                className="block bg-white rounded-xl border border-border p-5 hover:border-primary/50 hover:shadow-sm transition-all"
              >
                <p className="text-xs text-muted-foreground mb-2">{fmt(post.publishedAt)}</p>
                <h3 className="font-semibold leading-snug line-clamp-2">{post.title}</h3>
                {post.excerpt && (
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{post.excerpt}</p>
                )}
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

type EventRow = { id: string; title: string; slug: string; startsAt: Date | null; endsAt: Date | null };

function EventsSection({
  data, events, tenantSlug,
}: {
  data:       Record<string, unknown>;
  events:     EventRow[];
  tenantSlug: string;
}) {
  const d = data as { title?: string };
  const fmt = (date: Date | null) =>
    date ? new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(date) : "TBA";

  return (
    <section className="py-14 px-4">
      <div className="max-w-4xl mx-auto">
        {d.title && <h2 className="text-2xl font-bold mb-8">{d.title}</h2>}
        {events.length === 0 ? (
          <p className="text-muted-foreground text-sm">Belum ada event mendatang.</p>
        ) : (
          <div className="space-y-3">
            {events.map((event) => (
              <a
                key={event.id}
                href={`/${tenantSlug}/event/${event.slug}`}
                className="flex items-center gap-4 border border-border rounded-xl p-4 bg-white hover:border-primary/50 hover:shadow-sm transition-all"
              >
                <div className="shrink-0 w-14 text-center bg-primary/10 rounded-lg p-2">
                  <div className="text-xs text-primary font-medium uppercase">
                    {event.startsAt
                      ? new Intl.DateTimeFormat("id-ID", { month: "short" }).format(event.startsAt)
                      : ""}
                  </div>
                  <div className="text-2xl font-bold text-primary leading-none">
                    {event.startsAt ? event.startsAt.getDate() : "?"}
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold">{event.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{fmt(event.startsAt)}</p>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

type GalleryImage = { url: string; alt: string };

function GallerySection({ data }: { data: Record<string, unknown> }) {
  const d = data as { title?: string; images?: GalleryImage[] };
  const images = d.images ?? [];

  return (
    <section className="py-14 px-4 bg-muted/40">
      <div className="max-w-5xl mx-auto">
        {d.title && <h2 className="text-2xl font-bold mb-8">{d.title}</h2>}
        {images.length === 0 ? (
          <p className="text-muted-foreground text-sm">Belum ada gambar.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {images.map((img, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={img.url}
                alt={img.alt || `Foto ${i + 1}`}
                className="w-full aspect-square object-cover rounded-lg border border-border"
              />
            ))}
          </div>
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
      <div className={`max-w-5xl mx-auto flex flex-col ${imgRight ? "md:flex-row" : "md:flex-row-reverse"} items-center gap-10`}>
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
      <div className="max-w-5xl mx-auto">
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
          <a
            href={d.ctaUrl}
            className="inline-block mt-2 px-6 py-3 bg-white text-gray-900 font-semibold rounded-lg hover:bg-gray-100 transition-colors"
          >
            {d.ctaLabel}
          </a>
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
      <div className="max-w-2xl mx-auto space-y-4">
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
    </section>
  );
}

type StatItem = { number: string; label: string };

function StatsSection({ data }: { data: Record<string, unknown> }) {
  const d = data as { items?: StatItem[] };
  const items = d.items ?? [];

  return (
    <section className="py-14 px-4">
      <div className="max-w-4xl mx-auto">
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
  // Pre-fetch data for data-dependent sections
  const sectionTypes = new Set<SectionType>(body.sections.map((s) => s.type));

  const postsMap:   Map<string, PostRow[]>  = new Map();
  const eventsMap:  Map<string, EventRow[]> = new Map();
  let   contactSettings: ContactSettings   = {};

  await Promise.all([
    sectionTypes.has("posts") &&
      (async () => {
        for (const s of body.sections.filter((x) => x.type === "posts")) {
          const count = (s.data.count as number | undefined) ?? 6;
          postsMap.set(s.id, await fetchPosts(tenantClient, count));
        }
      })(),

    sectionTypes.has("events") &&
      (async () => {
        for (const s of body.sections.filter((x) => x.type === "events")) {
          const count = (s.data.count as number | undefined) ?? 3;
          eventsMap.set(s.id, await fetchEvents(tenantClient, count));
        }
      })(),

    sectionTypes.has("contact_info") &&
      (async () => {
        contactSettings = await getSettings(tenantClient, "contact");
      })(),
  ]);

  return (
    <>
      {body.sections.map((section) => (
        <SectionRenderer
          key={section.id}
          section={section}
          tenantSlug={tenantSlug}
          posts={postsMap.get(section.id) ?? []}
          events={eventsMap.get(section.id) ?? []}
          contactSettings={contactSettings}
        />
      ))}
    </>
  );
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

function SectionRenderer({
  section, tenantSlug, posts, events, contactSettings,
}: {
  section:         SectionItem;
  tenantSlug:      string;
  posts:           PostRow[];
  events:          EventRow[];
  contactSettings: ContactSettings;
}) {
  switch (section.type) {
    case "hero":         return <HeroSection         data={section.data} />;
    case "posts":        return <PostsSection         data={section.data} posts={posts}   tenantSlug={tenantSlug} />;
    case "events":       return <EventsSection        data={section.data} events={events} tenantSlug={tenantSlug} />;
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
