import { notFound }            from "next/navigation";
import { eq, desc, and }       from "drizzle-orm";
import { createTenantDb, db, tenants, members, getSettings } from "@jalajogja/db";
import { auth }                from "@/lib/auth";
import { headers }             from "next/headers";
import { publicUrl }           from "@/lib/minio";
import { renderBody }          from "@/lib/letter-render";
import { QurbanOrderForm }     from "@/components/donasi/public/qurban-order-form";
import type { Metadata }       from "next";
import { ChevronRight, Heart } from "lucide-react";

export const revalidate = 60;

type Params = Promise<{ tenant: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { tenant: slug, slug: campaignSlug } = await params;
  const [tenant] = await db.select({ name: tenants.name }).from(tenants).where(eq(tenants.slug, slug)).limit(1);
  if (!tenant) return {};
  const tenantClient = createTenantDb(slug);
  const { db: tdb, schema } = tenantClient;
  const [campaign] = await tdb.select({ title: schema.campaigns.title, metaTitle: schema.campaigns.metaTitle, metaDesc: schema.campaigns.metaDesc })
    .from(schema.campaigns).where(and(eq(schema.campaigns.slug, campaignSlug), eq(schema.campaigns.status, "active"))).limit(1);
  if (!campaign) return {};
  return {
    title:       campaign.metaTitle ?? `${campaign.title} — ${tenant.name}`,
    description: campaign.metaDesc ?? undefined,
  };
}

export default async function DonasiDetailPage({ params }: { params: Params }) {
  const { tenant: slug, slug: campaignSlug } = await params;

  const [tenant] = await db.select({ id: tenants.id, name: tenants.name, isActive: tenants.isActive })
    .from(tenants).where(eq(tenants.slug, slug)).limit(1);
  if (!tenant?.isActive) notFound();

  const tenantClient             = createTenantDb(slug);
  const { db: tenantDb, schema } = tenantClient;

  // Fetch campaign
  const [campaign] = await tenantDb
    .select()
    .from(schema.campaigns)
    .where(and(eq(schema.campaigns.slug, campaignSlug), eq(schema.campaigns.status, "active")))
    .limit(1);
  if (!campaign) notFound();

  const isQurban = campaign.campaignType === "qurban";

  // Cover
  let coverUrl: string | null = null;
  if (campaign.coverId) {
    const [m] = await tenantDb.select({ path: schema.media.path }).from(schema.media)
      .where(eq(schema.media.id, campaign.coverId)).limit(1);
    if (m) coverUrl = publicUrl(slug, m.path);
  }

  // Progress
  const collected   = parseFloat(campaign.collectedAmount);
  const target      = campaign.targetAmount ? parseFloat(campaign.targetAmount) : null;
  const progressPct = target ? Math.min(100, Math.round((collected / target) * 100)) : 0;

  // Session untuk pre-fill nama
  const session   = await auth.api.getSession({ headers: await headers() });
  let defaultName = "";
  let memberId: string | null = null;
  if (session?.user?.id) {
    const [member] = await db.select({ id: members.id, name: members.name })
      .from(members).where(eq(members.betterAuthUserId, session.user.id)).limit(1);
    if (member) { defaultName = member.name; memberId = member.id; }
    else defaultName = session.user.name ?? "";
  }

  // Donatur terbaru (jika show_donor_list)
  let donorList: { name: string; isAnonymous: boolean }[] = [];
  if (campaign.showDonorList) {
    donorList = await tenantDb
      .select({ donorName: schema.donations.donorName, isAnonymous: schema.donations.isAnonymous })
      .from(schema.donations)
      .where(eq(schema.donations.campaignId, campaign.id))
      .orderBy(desc(schema.donations.createdAt))
      .limit(10)
      .then(rows => rows.map(r => ({ name: r.isAnonymous ? "Anonim" : r.donorName, isAnonymous: r.isAnonymous })));
  }

  // ── Qurban data ──────────────────────────────────────────────────────────
  type Animal = { id: string; animalType: "domba" | "kambing" | "sapi"; price: number; stock: number; booked: number; split: number | null; isActive: boolean };
  let qurbanAnimals: Animal[]  = [];
  let adminFee      = 0;
  let adminFeeLabel = "Biaya Administrasi";

  type PaymentMethod =
    | { type: "transfer"; bankName: string; accountNumber: string; accountName: string }
    | { type: "qris"; name: string; imageUrl: string };
  let paymentMethods: PaymentMethod[] = [];

  if (isQurban) {
    const [qRows, donasiSettings, paySettings] = await Promise.all([
      tenantDb.select().from(schema.qurbanAnimals)
        .where(and(eq(schema.qurbanAnimals.campaignId, campaign.id), eq(schema.qurbanAnimals.isActive, true))),
      getSettings(tenantClient, "donasi"),
      getSettings(tenantClient, "payment"),
    ]);

    qurbanAnimals = qRows.map(r => ({
      id:         r.id,
      animalType: r.animalType as Animal["animalType"],
      price:      parseFloat(r.price),
      stock:      r.stock,
      booked:     r.booked,
      split:      r.split ?? null,
      isActive:   r.isActive,
    }));

    const qc = donasiSettings.qurban_config as { admin_fee?: number; admin_fee_label?: string } | undefined;
    adminFee      = qc?.admin_fee ?? 0;
    adminFeeLabel = qc?.admin_fee_label ?? "Biaya Administrasi";

    // Rekening + QRIS kategori donasi → fallback general
    type BankAccount = { bankName: string; accountNumber: string; accountName: string; categories?: string[] };
    type QrisAccount = { name: string; imageUrl?: string; categories?: string[] };
    const banks  = (paySettings.bank_accounts as BankAccount[] | undefined) ?? [];
    const qrises = (paySettings.qris_accounts as QrisAccount[] | undefined) ?? [];

    const filterMethod = <T extends { categories?: string[] }>(list: T[]) => {
      const specific = list.filter(a => a.categories?.includes("donasi"));
      return specific.length > 0 ? specific : list.filter(a => !a.categories || a.categories.includes("general"));
    };

    for (const b of filterMethod(banks)) {
      paymentMethods.push({ type: "transfer", bankName: b.bankName, accountNumber: b.accountNumber, accountName: b.accountName });
    }
    for (const q of filterMethod(qrises)) {
      if (q.imageUrl) paymentMethods.push({ type: "qris", name: q.name, imageUrl: q.imageUrl });
    }
  }

  return (
    <div className="py-10 px-4">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <a href={`/${slug}/campaign`} className="hover:text-foreground transition-colors">Donasi</a>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium line-clamp-1">{campaign.title}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Kiri: info campaign */}
          <div className="lg:col-span-3 space-y-6">
            {/* Cover */}
            {coverUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverUrl} alt={campaign.title} className="w-full rounded-xl object-cover aspect-video" />
            )}

            <h1 className="text-2xl font-bold">{campaign.title}</h1>

            {/* Progress bar (non-qurban) */}
            {!isQurban && target && campaign.showAmount && (
              <div className="space-y-2">
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${progressPct}%` }} />
                </div>
                <div className="flex justify-between text-sm">
                  <span>Terkumpul <span className="font-semibold text-primary">Rp {collected.toLocaleString("id-ID")}</span></span>
                  <span className="text-muted-foreground">{progressPct}% dari Rp {target.toLocaleString("id-ID")}</span>
                </div>
              </div>
            )}

            {/* Deskripsi */}
            {campaign.description && (
              <div
                className="prose prose-sm max-w-none [&_p]:my-3 [&_ul]:my-3 [&_ol]:my-3"
                dangerouslySetInnerHTML={{ __html: renderBody(campaign.description) }}
              />
            )}

            {/* Donatur terbaru */}
            {campaign.showDonorList && donorList.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3 text-sm">Donatur Terbaru</h3>
                <ul className="space-y-1.5">
                  {donorList.map((d, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Heart className="h-3.5 w-3.5 text-primary shrink-0" />
                      {d.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Kanan: form */}
          <div className="lg:col-span-2">
            <div className="sticky top-6 rounded-xl border border-border bg-card p-5 space-y-4">
              {isQurban ? (
                <>
                  <h2 className="font-semibold">Pesan Qurban</h2>
                  {campaign.endsAt && (
                    <p className="text-xs text-muted-foreground">
                      Periode: hingga {new Date(campaign.endsAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                  )}
                  <QurbanOrderForm
                    slug={slug}
                    campaignId={campaign.id}
                    animals={qurbanAnimals}
                    adminFee={adminFee}
                    adminFeeLabel={adminFeeLabel}
                    methods={paymentMethods}
                    defaultName={defaultName}
                    memberId={memberId}
                  />
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Heart className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Form donasi akan hadir segera.</p>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
