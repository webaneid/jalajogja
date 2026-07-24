import { notFound }            from "next/navigation";
import { eq, desc, and, inArray } from "drizzle-orm";
import { renderBody }              from "@/lib/letter-render";
import { createTenantDb, db, tenants, members, contacts, getSettings } from "@jalajogja/db";
import { auth }                from "@/lib/auth";
import { headers }             from "next/headers";
import { publicUrl, resolveMediaUrl } from "@/lib/minio";
import { CampaignDetailClient } from "@/components/donasi/public/campaign-detail-client";
import { CampaignDetailTabs }  from "@/components/donasi/public/campaign-detail-tabs";
import type { DonorEntry }     from "@/components/donasi/public/campaign-detail-tabs";
import { CampaignArchiveCards } from "@/components/website/public/campaign-cards/campaign-archive-cards";
import type { CampaignCardData } from "@/lib/campaign-card-templates";
import { CAMPAIGN_TYPE_LABELS, CAMPAIGN_TYPE_COLORS, buildProgressInfoBlock } from "@/lib/campaign-card-templates";
import { resolveQurbanInfoBlocks } from "@/lib/campaign-info-block";
import { resolveDonorCounts } from "@/lib/campaign-donor-count";
import { CAMPAIGN_ARCHIVE_CARD_DESIGN_IDS, type CampaignArchiveCardDesignId } from "@/lib/campaign-archive-card-designs";
import type { Metadata }       from "next";
import { ChevronRight } from "lucide-react";
import { generateMetadata as buildMetadata } from "@/lib/seo";
import { getTenantSeoBase } from "@/lib/tenant-seo";
import { resolveBaseUrl } from "@/lib/resolve-base-url";
import { getPublicNavMenu } from "@/lib/get-public-nav-menu";
import { SingleFeatureImage } from "@/components/website/public/single/single-feature-image";
import { CategoryPill } from "@/components/website/public/single/category-pill";
import { SocialShareCard } from "@/components/website/public/single/social-share-card";
import { CampaignMobileDonationBar } from "@/components/donasi/public/campaign-mobile-donation-bar";

export const revalidate = 60;

type Params = Promise<{ tenant: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { tenant: slug, slug: campaignSlug } = await params;
  const [base] = await Promise.all([getTenantSeoBase(slug)]);
  const tenantClient = createTenantDb(slug);
  const { db: tdb, schema } = tenantClient;
  const [campaign] = await tdb
    .select({ title: schema.campaigns.title, metaTitle: schema.campaigns.metaTitle, metaDesc: schema.campaigns.metaDesc, coverId: schema.campaigns.coverId })
    .from(schema.campaigns).where(and(eq(schema.campaigns.slug, campaignSlug), eq(schema.campaigns.status, "active"))).limit(1);
  if (!campaign) return {};
  let ogImage = base.logoUrl;
  if (campaign.coverId) {
    const [media] = await tdb.select({ path: schema.media.path, variants: schema.media.variants })
      .from(schema.media).where(eq(schema.media.id, campaign.coverId)).limit(1);
    if (media) {
      const vv = media.variants as Record<string, string> | null;
      ogImage = resolveMediaUrl(slug, media.path, vv);
    }
  }
  return buildMetadata({
    title:       campaign.metaTitle ?? campaign.title,
    description: campaign.metaDesc ?? undefined,
    siteName:    base.siteName,
    canonicalUrl: `${base.baseUrl}/campaign/${campaignSlug}`,
    ogImageUrl:  ogImage,
    ogType:      "article",
  });
}

export default async function CampaignDetailPage({
  params, searchParams,
}: {
  params: Params;
  searchParams: Promise<{ forGabung?: string }>;
}) {
  const { tenant: slug, slug: campaignSlug } = await params;
  const { forGabung } = await searchParams;
  // Penanda "niat bayar untuk daftar forum" dari /gabung — lihat
  // docs/arsitektur-backbone-ikpm.md § "Pemisahan Donasi vs Registrasi Forum".
  const isForGabungRegistration = forGabung === "1";

  const [tenant] = await db.select({ id: tenants.id, name: tenants.name, isActive: tenants.isActive })
    .from(tenants).where(eq(tenants.slug, slug)).limit(1);
  if (!tenant?.isActive) notFound();

  const tenantClient             = createTenantDb(slug);
  const { db: tenantDb, schema } = tenantClient;

  const [campaign] = await tenantDb.select().from(schema.campaigns)
    .where(and(eq(schema.campaigns.slug, campaignSlug), eq(schema.campaigns.status, "active"))).limit(1);
  if (!campaign) notFound();

  // Cover
  let coverUrl: string | null = null;
  if (campaign.coverId) {
    const [m] = await tenantDb.select({ path: schema.media.path }).from(schema.media)
      .where(eq(schema.media.id, campaign.coverId)).limit(1);
    if (m) coverUrl = publicUrl(slug, m.path);
  }

  // Session
  const session   = await auth.api.getSession({ headers: await headers() });
  let defaultName = "";
  let memberPhone = "";
  let memberEmail = "";
  if (session?.user?.id) {
    const [member] = await db
      .select({ name: members.name, contactId: members.contactId })
      .from(members).where(eq(members.betterAuthUserId, session.user.id)).limit(1);
    defaultName = member?.name ?? session.user.name ?? "";
    if (member?.contactId) {
      const [contact] = await db
        .select({ phone: contacts.phone, email: contacts.email })
        .from(contacts).where(eq(contacts.id, member.contactId)).limit(1);
      memberPhone = contact?.phone ?? "";
      memberEmail = contact?.email ?? "";
    }
    if (!memberEmail) memberEmail = session.user.email ?? "";
  }

  // Progress
  const collected   = parseFloat(campaign.collectedAmount);
  const target      = campaign.targetAmount ? parseFloat(campaign.targetAmount) : null;
  const progressPct = target ? Math.min(100, Math.round((collected / target) * 100)) : 0;

  // Donasi — gabungkan dua sumber:
  //   1. Lama: tabel donations (data historis sebelum migrasi ke cart universal)
  //   2. Baru: invoice_items (alur cart universal — sumber utama sejak donasi publik pindah ke cart)
  let donorList: DonorEntry[] = [];
  if (campaign.showDonorList) {
    const [legacyRows, cartRows] = await Promise.all([
      // Sumber lama
      tenantDb
        .select({
          donorName:   schema.donations.donorName,
          isAnonymous: schema.donations.isAnonymous,
          amount:      schema.payments.amount,
          createdAt:   schema.donations.createdAt,
        })
        .from(schema.donations)
        .innerJoin(schema.payments, and(
          eq(schema.payments.sourceType, "donation"),
          eq(schema.payments.sourceId, schema.donations.id),
          eq(schema.payments.status, "paid"),
        ))
        .where(eq(schema.donations.campaignId, campaign.id))
        .orderBy(desc(schema.donations.createdAt))
        .limit(100),

      // Sumber baru (cart universal) — hanya invoice status paid
      tenantDb
        .select({
          customerName: schema.invoices.customerName,
          amount:       schema.invoiceItems.total,
          description:  schema.invoiceItems.description,
          createdAt:    schema.invoices.createdAt,
        })
        .from(schema.invoiceItems)
        .innerJoin(schema.invoices, eq(schema.invoices.id, schema.invoiceItems.invoiceId))
        .where(and(
          eq(schema.invoiceItems.itemType, "donation"),
          eq(schema.invoiceItems.itemId, campaign.id),
          eq(schema.invoices.status, "paid"),
        ))
        .orderBy(desc(schema.invoices.createdAt))
        .limit(100),
    ]);

    const legacy: DonorEntry[] = legacyRows.map(r => ({
      donorName:   (r.isAnonymous ?? false) ? "Anonim" : (r.donorName ?? "Donatur"),
      isAnonymous: r.isAnonymous ?? false,
      amount:      r.amount,
      createdAt:   r.createdAt.toISOString(),
    }));

    const cart: DonorEntry[] = cartRows.map(r => {
      const isAnon = r.description === "Anonim";
      return {
        donorName:   isAnon ? "Anonim" : (r.customerName ?? "Donatur"),
        isAnonymous: isAnon,
        amount:      r.amount,
        createdAt:   r.createdAt.toISOString(),
      };
    });

    donorList = [...legacy, ...cart]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 100);
  }

  // Qurban data
  type QurbanAnimal = { id: string; animalType: "domba"|"kambing"|"sapi"; price: number; stock: number; booked: number; split: number | null; isActive: boolean };
  let qurbanAnimals: QurbanAnimal[] = [];
  let slaughterFees = { domba: 0, kambing: 0, sapi: 0 };

  if (campaign.campaignType === "qurban") {
    const [qRows, donasiSettings] = await Promise.all([
      tenantDb.select().from(schema.qurbanAnimals)
        .where(and(eq(schema.qurbanAnimals.campaignId, campaign.id), eq(schema.qurbanAnimals.isActive, true))),
      getSettings(tenantClient, "donasi"),
    ]);
    qurbanAnimals = qRows.map(r => ({
      id:         r.id,
      animalType: r.animalType as QurbanAnimal["animalType"],
      price:      parseFloat(r.price),
      stock:      r.stock,
      booked:     r.booked,
      split:      r.split ?? null,
      isActive:   r.isActive,
    }));
    const qc = donasiSettings.qurban_config as { slaughter_fees?: { domba?: number; kambing?: number; sapi?: number } } | undefined;
    slaughterFees = {
      domba:   qc?.slaughter_fees?.domba   ?? 0,
      kambing: qc?.slaughter_fees?.kambing ?? 0,
      sapi:    qc?.slaughter_fees?.sapi    ?? 0,
    };
  }

  const donasiSettings = await getSettings(tenantClient, "donasi");

  // Nominal rekomendasi untuk donasi reguler
  let recommendedAmounts: number[] = [];
  if (campaign.campaignType !== "qurban") {
    const dc = donasiSettings.donation_config as { recommended_amounts?: number[] } | undefined;
    recommendedAmounts = dc?.recommended_amounts ?? [10000, 25000, 50000, 100000];
  }

  // Desain kartu "Campaign Lainnya" — lihat docs/arsitektur-donasi.md § 14l
  const archiveDesignRaw = donasiSettings.campaign_archive_design as { design?: string } | undefined;
  const archiveDesign: CampaignArchiveCardDesignId = CAMPAIGN_ARCHIVE_CARD_DESIGN_IDS.includes(archiveDesignRaw?.design as CampaignArchiveCardDesignId)
    ? (archiveDesignRaw!.design as CampaignArchiveCardDesignId)
    : "1";

  // Kampanye terkait (kategori sama)
  let relatedCampaigns: CampaignCardData[] = [];
  if (campaign.categoryId) {
    const relRows = await tenantDb.select({
      id: schema.campaigns.id, title: schema.campaigns.title, slug: schema.campaigns.slug,
      description: schema.campaigns.description, campaignType: schema.campaigns.campaignType,
      coverId: schema.campaigns.coverId, targetAmount: schema.campaigns.targetAmount,
      collectedAmount: schema.campaigns.collectedAmount, endsAt: schema.campaigns.endsAt,
      categoryName: schema.campaignCategories.name,
    })
    .from(schema.campaigns)
    .leftJoin(schema.campaignCategories, eq(schema.campaignCategories.id, schema.campaigns.categoryId))
    .where(and(eq(schema.campaigns.status, "active"), eq(schema.campaigns.categoryId, campaign.categoryId)))
    .orderBy(desc(schema.campaigns.createdAt)).limit(4);

    const relCoverIds = [...new Set(relRows.map(r => r.coverId).filter(Boolean))] as string[];
    const relCoverMap = new Map<string, string>();
    if (relCoverIds.length > 0) {
      const media = await tenantDb.select({ id: schema.media.id, path: schema.media.path })
        .from(schema.media).where(inArray(schema.media.id, relCoverIds));
      media.forEach(m => relCoverMap.set(m.id, publicUrl(slug, m.path)));
    }

    const filteredRows = relRows.filter(r => r.id !== campaign.id).slice(0, 3);

    // Batch resolve info block qurban — satu query untuk semua related campaign qurban
    const qurbanIds     = filteredRows.filter(r => r.campaignType === "qurban").map(r => r.id);
    const qurbanInfoMap = await resolveQurbanInfoBlocks(tenantClient, qurbanIds);
    const donorCountMap = await resolveDonorCounts(tenantClient, filteredRows.map(r => r.id));

    relatedCampaigns = filteredRows.map(r => {
      const col = parseFloat(r.collectedAmount ?? "0");
      const tgt = r.targetAmount ? parseFloat(r.targetAmount) : null;
      return {
        id:              r.id, title: r.title, slug: r.slug, description: r.description,
        campaignType:    (r.campaignType ?? "donasi") as CampaignCardData["campaignType"],
        coverUrl:        r.coverId ? (relCoverMap.get(r.coverId) ?? null) : null,
        categoryName:    r.categoryName ?? null,
        targetAmount:    r.targetAmount ?? null,
        collectedAmount: String(col),
        progressPercent: tgt ? Math.min(100, Math.round((col / tgt) * 100)) : null,
        endsAt:          r.endsAt ? r.endsAt.toISOString() : null,
        isRecurring:     false,
        infoBlock:       r.campaignType === "qurban"
          ? (qurbanInfoMap.get(r.id) ?? { kind: "qurban_habis" as const })
          : buildProgressInfoBlock(col, tgt),
        donorCount:      donorCountMap.get(r.id) ?? 0,
      };
    });
  }

  const typeColor = CAMPAIGN_TYPE_COLORS[campaign.campaignType] ?? "bg-primary/10 text-primary";

  // Shell mobile — lihat lesson CLAUDE.md "Mobile Single-Page Shell" / post/[slug]/page.tsx
  // sebagai pola referensi.
  const [relativeBaseUrl, seoBase] = await Promise.all([
    resolveBaseUrl(slug),
    getTenantSeoBase(slug),
  ]);
  const navMenu = await getPublicNavMenu(tenantClient, slug, relativeBaseUrl);
  const pageUrl = `${seoBase.baseUrl}/campaign/${campaignSlug}`;

  // Konten panel donasi — SAMA PERSIS dipakai di kolom kanan desktop (sticky) dan di dalam
  // bottom sheet mobile (CampaignMobileDonationBar), supaya CampaignDetailClient (form
  // donasi/qurban, cukup kompleks — phone lookup, popup state machine) tidak terduplikasi.
  const donationPanelContent = (
    <>
      <h2 className="font-semibold mb-4">
        {campaign.campaignType === "qurban" ? "Pesan Qurban" : "Donasi Sekarang"}
      </h2>
      <CampaignDetailClient
        campaignId={campaign.id}
        campaignTitle={campaign.title}
        campaignType={campaign.campaignType as "donasi"|"zakat"|"wakaf"|"qurban"}
        tenantSlug={slug}
        recommendedAmounts={recommendedAmounts}
        qurbanAnimals={qurbanAnimals}
        slaughterFees={slaughterFees}
        defaultName={defaultName}
        isLoggedIn={!!session?.user?.id}
        memberPhone={memberPhone}
        memberEmail={memberEmail}
        forGabungRegistration={isForGabungRegistration}
      />
    </>
  );

  return (
    <>
      {/* ── Mobile shell — gambar full-bleed + overlay back/menu, urutan beda dari desktop ── */}
      <div className="md:hidden">
        <SingleFeatureImage
          src={coverUrl}
          alt={campaign.title}
          backHref={`${relativeBaseUrl}/campaign`}
          navMenu={navMenu}
          siteName={tenant.name}
        />
        <div className="px-4 pt-4 space-y-3">
          <CategoryPill label={CAMPAIGN_TYPE_LABELS[campaign.campaignType]} />
          <h1 className="text-2xl font-bold leading-tight">{campaign.title}</h1>
          <SocialShareCard url={pageUrl} title={campaign.title} />
        </div>
      </div>

    <div className="py-10 px-4">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Breadcrumb — desktop saja, mobile sudah punya tombol back di overlay */}
        <nav className="hidden md:flex items-center gap-1.5 text-sm text-muted-foreground">
          <a href={`/${slug}/campaign`} className="hover:text-foreground transition-colors">Donasi</a>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium line-clamp-1">{campaign.title}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Kiri: info */}
          <div className="lg:col-span-3 space-y-5">
            {/* Cover + Badge + Judul — DESKTOP SAJA, mobile sudah render sendiri di shell atas */}
            <div className="hidden md:block space-y-5">
              {coverUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={coverUrl} alt={campaign.title} className="w-full rounded-xl object-cover aspect-video" />
              )}

              <div className="space-y-2">
                <span className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full ${typeColor}`}>
                  {CAMPAIGN_TYPE_LABELS[campaign.campaignType]}
                </span>
                <h1 className="text-2xl font-bold">{campaign.title}</h1>
              </div>
            </div>

            {/* Terkumpul / Progress — selalu tampil untuk non-qurban jika showAmount aktif */}
            {campaign.campaignType !== "qurban" && campaign.showAmount && (
              <div className="space-y-2">
                {target ? (
                  <>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${progressPct}%` }} />
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Terkumpul <span className="font-semibold text-primary">Rp {collected.toLocaleString("id-ID")}</span></span>
                      <span className="text-muted-foreground">{progressPct}% dari Rp {target.toLocaleString("id-ID")}</span>
                    </div>
                  </>
                ) : (
                  <p className="text-sm">
                    Terkumpul <span className="font-semibold text-primary">Rp {collected.toLocaleString("id-ID")}</span>
                  </p>
                )}
              </div>
            )}

            {/* Deskripsi + Tab Donatur */}
            <CampaignDetailTabs
              descriptionHtml={campaign.description
                ? renderBody(campaign.description, { imageBaseUrl: `${process.env.MINIO_PUBLIC_URL ?? "https://minio.jalakarta.com"}/tenant-${slug}` })
                : null}
              donorList={donorList}
              showDonorList={campaign.showDonorList}
            />
          </div>

          {/* Kanan: form — desktop sticky (tidak diubah) + mobile bottom sheet */}
          <div className="lg:col-span-2">
            <div className="hidden md:block sticky top-6 rounded-xl border border-border bg-card p-5">
              {donationPanelContent}
            </div>
            <CampaignMobileDonationBar campaignType={campaign.campaignType}>
              {donationPanelContent}
            </CampaignMobileDonationBar>
          </div>
        </div>

        {/* Related campaigns */}
        {relatedCampaigns.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-4 pb-2 border-b border-border">Campaign Lainnya</h2>
            <CampaignArchiveCards design={archiveDesign} campaigns={relatedCampaigns} tenantSlug={slug} />
          </section>
        )}

        {/* Spacer — elemen PALING TERAKHIR di halaman, cegah konten "Campaign Lainnya" di atas
            ketutupan bar collapsed MobileActionSheet (yang render di dalam kolom "Kanan: form"
            di atas, bukan di sini — spacer lokal MobileActionSheet sendiri tidak cukup karena
            section ini render SETELAHNYA). Tinggi cocok dengan collapsed bar (h-24 di
            mobile-action-sheet.tsx). Lihat lesson CLAUDE.md soal kelas bug ini. */}
        <div className="h-24 md:hidden" />

      </div>
    </div>
    </>
  );
}
