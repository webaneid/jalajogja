// Halaman publik event — tanpa auth, siapapun bisa akses dan mendaftar
import { createTenantDb, db, tenants } from "@jalajogja/db";
import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import { CalendarDays, MapPin, Globe, Users, Ticket } from "lucide-react";
import { EventRegisterForm } from "@/components/event/event-register-form";

type BankAccount = {
  id: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  categories: string[];
};

type QrisAccount = {
  id: string;
  name: string;
  imageUrl?: string;
  categories: string[];
};

function formatDate(d: Date | null) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(d));
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  offline: "Offline",
  online:  "Online",
  hybrid:  "Hybrid (Online + Offline)",
};

export default async function PublicEventPage({
  params,
}: {
  params: Promise<{ tenant: string; slug: string }>;
}) {
  const { tenant: tenantSlug, slug: eventSlug } = await params;

  // Cek tenant valid
  const [tenant] = await db
    .select({ id: tenants.id, name: tenants.name, isActive: tenants.isActive })
    .from(tenants)
    .where(eq(tenants.slug, tenantSlug))
    .limit(1);

  if (!tenant || !tenant.isActive) notFound();

  const { db: tenantDb, schema } = createTenantDb(tenantSlug);

  // Fetch event by slug — hanya yang published
  const [event] = await tenantDb
    .select()
    .from(schema.events)
    .where(and(
      eq(schema.events.slug,   eventSlug),
      eq(schema.events.status, "published")
    ))
    .limit(1);

  if (!event) notFound();

  // Fetch tiket aktif
  const tickets = await tenantDb
    .select()
    .from(schema.eventTickets)
    .where(and(
      eq(schema.eventTickets.eventId,  event.id),
      eq(schema.eventTickets.isActive, true)
    ))
    .orderBy(schema.eventTickets.sortOrder);

  // Fetch cover image URL jika ada
  let coverUrl: string | null = null;
  if (event.coverId) {
    const [media] = await tenantDb
      .select({ path: schema.media.path })
      .from(schema.media)
      .where(eq(schema.media.id, event.coverId))
      .limit(1);
    coverUrl = media?.path ?? null;
  }

  // Fetch payment settings (bank accounts + QRIS) untuk tiket berbayar
  const [bankRow] = await tenantDb
    .select({ value: schema.settings.value })
    .from(schema.settings)
    .where(and(eq(schema.settings.key, "bank_accounts"), eq(schema.settings.group, "payment")))
    .limit(1);

  const [qrisRow] = await tenantDb
    .select({ value: schema.settings.value })
    .from(schema.settings)
    .where(and(eq(schema.settings.key, "qris_accounts"), eq(schema.settings.group, "payment")))
    .limit(1);

  const allBanks  = (bankRow?.value as BankAccount[] | null) ?? [];
  const allQris   = (qrisRow?.value as QrisAccount[] | null) ?? [];

  // Filter: ambil yang punya kategori "donasi" atau "general" sebagai fallback pembayaran event
  const banks = allBanks.filter((b) =>
    b.categories?.includes("donasi") || b.categories?.includes("general")
  );
  const qrisAccounts = allQris.filter((q) =>
    q.categories?.includes("donasi") || q.categories?.includes("general")
  );

  // Apakah ada tiket berbayar
  const hasPaidTicket = tickets.some((t) => parseFloat(String(t.price)) > 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header minimal org */}
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" />
          <span className="font-semibold text-sm">{tenant.name}</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {/* Cover */}
        {coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl}
            alt={event.title}
            className="w-full aspect-video object-cover rounded-xl border border-border"
          />
        )}

        {/* Judul + Meta */}
        <div className="space-y-3">
          <h1 className="text-2xl font-bold leading-tight">{event.title}</h1>

          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" />
              {formatDate(event.startsAt)}
              {event.endsAt && ` s/d ${formatDate(event.endsAt)}`}
            </span>
            {(event.eventType === "offline" || event.eventType === "hybrid") && event.location && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                {event.location}
              </span>
            )}
            {(event.eventType === "online" || event.eventType === "hybrid") && (
              <span className="inline-flex items-center gap-1.5">
                <Globe className="h-4 w-4" />
                {EVENT_TYPE_LABELS[event.eventType]}
              </span>
            )}
            {event.organizerName && (
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                {event.organizerName}
              </span>
            )}
          </div>

          {event.locationDetail && (
            <p className="text-sm text-muted-foreground">{event.locationDetail}</p>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px] items-start">
          {/* Kiri: Deskripsi */}
          <div className="space-y-6">
            {event.description && (
              <div
                className="prose prose-sm max-w-none text-foreground [&_p]:my-2 [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-0.5 [&_h1]:text-xl [&_h2]:text-lg [&_h3]:text-base"
                dangerouslySetInnerHTML={{ __html: event.description }}
              />
            )}

            {/* Link online */}
            {event.onlineLink && (event.eventType === "online" || event.eventType === "hybrid") && (
              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-1">
                <p className="text-sm font-semibold">Link Bergabung</p>
                <a
                  href={event.onlineLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary underline break-all"
                >
                  {event.onlineLink}
                </a>
              </div>
            )}
          </div>

          {/* Kanan: Tiket + Form */}
          <div className="space-y-4">
            {tickets.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
                <Ticket className="h-8 w-8 mx-auto mb-2 opacity-40" />
                Pendaftaran belum dibuka
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card p-4 space-y-4">
                <p className="font-semibold text-sm">Daftar Sekarang</p>
                <EventRegisterForm
                  slug={tenantSlug}
                  eventId={event.id}
                  tickets={tickets.map((t) => ({
                    id:    t.id,
                    name:  t.name,
                    price: parseFloat(String(t.price)),
                    quota: t.quota,
                    description: t.description,
                  }))}
                  requireApproval={event.requireApproval}
                  banks={banks}
                  qrisAccounts={qrisAccounts}
                  hasPaidTicket={hasPaidTicket}
                />
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="border-t border-border mt-12 px-6 py-4 text-center text-xs text-muted-foreground">
        {tenant.name} · Powered by jalajogja
      </footer>
    </div>
  );
}
