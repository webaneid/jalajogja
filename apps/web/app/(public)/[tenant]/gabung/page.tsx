import { redirect }      from "next/navigation";
import { headers, cookies } from "next/headers";
import { eq, and }       from "drizzle-orm";
import { auth }          from "@/lib/auth";
import { resolveBaseUrl } from "@/lib/resolve-base-url";
import { db, tenants, tenantMemberships, createTenantDb, getSetting, getSettings } from "@jalajogja/db";
import { getAkunIdentity } from "@/lib/akun-identity";
import {
  checkMemberEligibility, MEMBER_ELIGIBILITY_LABELS, memberEligibilityFixHref,
} from "@/lib/member-eligibility";
import { getEnabledEkosistemModules } from "@/lib/ekosistem-modules.server";
import { enabledModuleList, EKOSISTEM_MODULE_LABELS } from "@/lib/ekosistem-modules";
import { hasPaymentRequirement, isRequirementSatisfied } from "@/lib/membership-config";
import type { MembershipConfigData } from "../../../(dashboard)/app/[tenant]/settings/actions";
import { JoinForumButton } from "./join-forum-button";
import { GabungItemWidget } from "./gabung-item-widget";
import { GabungCheckoutButton } from "./gabung-checkout-button";
import { CheckCircle2, ArrowRight, Info } from "lucide-react";
import { resolveMediaUrl } from "@/lib/minio";
import type { ProductVariationData, AttributeGroup, ViewerImage } from "@/components/toko/public/product-detail-client";

// Sama dengan produk/page.tsx & keranjang/page.tsx — images JSONB sudah berisi URL penuh
// (dari MediaPicker), tidak perlu publicUrl() lagi. Prioritas variant persegi (square) dulu.
function extractCoverUrl(images: unknown): string | null {
  if (!Array.isArray(images) || images.length === 0) return null;
  const first = images[0] as { url?: string; variants?: Record<string, string> | null };
  return first.variants?.["square"] ?? first.variants?.["square-large"] ?? first.url ?? null;
}

type Params = Promise<{ tenant: string }>;

export default async function GabungPage({ params }: { params: Params }) {
  const { tenant: slug } = await params;
  const hdrs    = await headers();
  const baseUrl = await resolveBaseUrl(slug);

  const session = await auth.api.getSession({ headers: hdrs });
  if (!session?.user) redirect(`${baseUrl}/login?redirect=${baseUrl}/gabung`);

  const [tenantRow] = await db
    .select({ id: tenants.id, name: tenants.name, tenantType: tenants.tenantType })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);

  // Bukan tenant forum — halaman ini tidak relevan di sini.
  if (!tenantRow || tenantRow.tenantType !== "forum") redirect(`${baseUrl}/akun`);

  const identity = await getAkunIdentity(session.user.id);
  if (!identity || identity.type !== "member" || !identity.memberId) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md space-y-4 text-center">
          <h1 className="text-2xl font-bold">Khusus Anggota IKPM</h1>
          <p className="text-sm text-muted-foreground">
            Hanya anggota IKPM yang punya profil alumni yang bisa bergabung ke forum ini.
            Akun publik tidak bisa mendaftar sebagai anggota forum.
          </p>
          <a href={`${baseUrl}/akun`} className="btn btn-outline-dark btn-md">
            ← Kembali ke Akun
          </a>
        </div>
      </div>
    );
  }

  const [membershipRow] = await db
    .select({ forumStatus: tenantMemberships.forumStatus })
    .from(tenantMemberships)
    .where(and(
      eq(tenantMemberships.tenantId, tenantRow.id),
      eq(tenantMemberships.memberId, identity.memberId),
    ))
    .limit(1);

  const alreadyMember = membershipRow?.forumStatus === "active";

  if (alreadyMember) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md space-y-4 text-center">
          <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
          <h1 className="text-2xl font-bold">Anda Sudah Bergabung</h1>
          <p className="text-sm text-muted-foreground">
            Anda sudah terdaftar sebagai anggota <strong>{tenantRow.name}</strong>.
          </p>
          <a href={`${baseUrl}/akun`} className="btn btn-primary btn-md">
            Kembali ke Akun
          </a>
        </div>
      </div>
    );
  }

  const tenantDb = createTenantDb(slug);

  // Eligibility dipersempit ke modul ekosistem yang aktif untuk tenant forum ini
  // (lib/ekosistem-modules.ts) — dipakai juga di memberEligibilityFixHref di bawah supaya
  // link "Lengkapi Data" tidak mengarah ke modul yang justru dimatikan tenant ini.
  const enabledModulesConfig = await getEnabledEkosistemModules(tenantDb);
  const enabledModulesArr    = enabledModuleList(enabledModulesConfig);
  const eligibility = await checkMemberEligibility(identity.memberId, enabledModulesArr);

  // Konfigurasi forum (info pendaftaran + syarat iuran opsional) — dibaca selalu, terlepas
  // status eligibility, karena teks info organisasi relevan ditampilkan ke semua calon
  // anggota. Lihat docs/arsitektur-gabung-forum.md § "Redesain /gabung".
  const { db: tdb, schema } = tenantDb;
  const [config, generalSettings] = await Promise.all([
    getSetting<MembershipConfigData>(tenantDb, "membership_config", "forum"),
    getSettings(tenantDb, "general"),
  ]);
  const registrationInfo = config?.registrationInfo?.trim() || null;
  const logoUrl = (generalSettings.logo_url as string | undefined) || null;

  const anyRequired = hasPaymentRequirement(config);

  type ProductWidgetData = {
    productId: string; name: string; coverUrl: string | null;
    productType: "simple" | "variable"; unitPrice: number; alreadyInCart: boolean;
    variationData?: { variations: ProductVariationData[]; attrGroups: AttributeGroup[]; images: ViewerImage[] };
  };
  type CampaignWidgetData = {
    campaignId: string; title: string; coverUrl: string | null; amounts: number[]; alreadyInCart: boolean;
  };

  let productWidget:  ProductWidgetData  | null = null;
  let campaignWidget: CampaignWidgetData | null = null;
  let productRelevantIds = new Set<string>();

  if (eligibility.eligible && config) {
    if (config.requiredProductId) {
      const [p] = await tdb
        .select({
          id: schema.products.id, name: schema.products.name, images: schema.products.images,
          productType: schema.products.productType, price: schema.products.price,
          attributeGroups: schema.products.attributeGroups,
        })
        .from(schema.products)
        .where(eq(schema.products.id, config.requiredProductId))
        .limit(1);

      if (p) {
        const isVariable = p.productType === "variable";
        let variationData: ProductWidgetData["variationData"];

        if (isVariable) {
          const vrows = await tdb
            .select({
              id: schema.productVariations.id, sku: schema.productVariations.sku,
              price: schema.productVariations.price, publicPrice: schema.productVariations.publicPrice,
              memberPrice: schema.productVariations.memberPrice, stock: schema.productVariations.stock,
              images: schema.productVariations.images, attributeCombo: schema.productVariations.attributeCombo,
              isActive: schema.productVariations.isActive,
            })
            .from(schema.productVariations)
            .where(and(
              eq(schema.productVariations.productId, p.id),
              eq(schema.productVariations.isActive, true),
            ))
            .orderBy(schema.productVariations.createdAt);

          const variations: ProductVariationData[] = vrows.map((v) => ({
            id: v.id, sku: v.sku ?? null,
            price: String(v.price ?? p.price),
            publicPrice: v.publicPrice != null ? String(v.publicPrice) : null,
            memberPrice: v.memberPrice != null ? String(v.memberPrice) : null,
            stock: v.stock,
            images: (Array.isArray(v.images) ? v.images : []) as ProductVariationData["images"],
            attributeCombo: (v.attributeCombo ?? {}) as Record<string, string>,
            isActive: v.isActive,
          }));

          productRelevantIds = new Set(variations.map((v) => v.id));

          const rawImages = Array.isArray(p.images) ? p.images as Array<{
            id: string; url: string; variants?: Record<string, string> | null; alt: string;
          }> : [];

          variationData = {
            variations,
            attrGroups: (p.attributeGroups ?? []) as AttributeGroup[],
            images: rawImages.map((img) => ({ id: img.id, url: img.url, variants: img.variants, alt: img.alt })),
          };
        }

        productRelevantIds.add(p.id);

        productWidget = {
          productId: p.id, name: p.name, coverUrl: extractCoverUrl(p.images),
          productType: (p.productType ?? "simple") as "simple" | "variable",
          unitPrice: parseFloat(String(p.price)),
          alreadyInCart: false, // dihitung di bawah setelah cartRows tersedia
          variationData,
        };
      }
    }

    if (config.requiredCampaignId) {
      const [c] = await tdb
        .select({ title: schema.campaigns.title, coverId: schema.campaigns.coverId })
        .from(schema.campaigns)
        .where(eq(schema.campaigns.id, config.requiredCampaignId))
        .limit(1);
      if (c) {
        let coverUrl: string | null = null;
        if (c.coverId) {
          const [m] = await tdb
            .select({ path: schema.media.path, variants: schema.media.variants })
            .from(schema.media)
            .where(eq(schema.media.id, c.coverId))
            .limit(1);
          if (m) coverUrl = resolveMediaUrl(slug, m.path, m.variants as Record<string, string> | null, ["square", "square-large", "large", "original"]);
        }
        const donasiSettings = await getSettings(tenantDb, "donasi");
        const dc = donasiSettings.donation_config as { recommended_amounts?: number[] } | undefined;
        campaignWidget = {
          campaignId: config.requiredCampaignId, title: c.title, coverUrl,
          amounts: dc?.recommended_amounts ?? [10000, 25000, 50000, 100000],
          alreadyInCart: false,
        };
      }
    }
  }

  // Cek "sudah di cart?" — query langsung ke cart_items milik session cart aktif (bukan lewat
  // getCartAction/CartItem, yang tidak expose forGabungRegistration).
  let productInCart  = false;
  let campaignInCart = false;

  if (productWidget || campaignWidget) {
    const cookieStore = await cookies();
    const token = cookieStore.get("cart_session")?.value ?? null;

    if (token) {
      const cartRows = await tdb
        .select({
          itemType: schema.cartItems.itemType, itemId: schema.cartItems.itemId,
          forGabungRegistration: schema.cartItems.forGabungRegistration,
        })
        .from(schema.cartItems)
        .innerJoin(schema.carts, eq(schema.carts.id, schema.cartItems.cartId))
        .where(eq(schema.carts.sessionToken, token));

      productInCart = cartRows.some((r) =>
        r.itemType === "product" && r.forGabungRegistration && r.itemId && productRelevantIds.has(r.itemId));
      campaignInCart = cartRows.some((r) =>
        r.itemType === "donation" && r.forGabungRegistration && r.itemId === config?.requiredCampaignId);
    }
  }

  if (productWidget)  productWidget.alreadyInCart  = productInCart;
  if (campaignWidget) campaignWidget.alreadyInCart = campaignInCart;

  const canProceed = config ? isRequirementSatisfied(config, { product: productInCart, campaign: campaignInCart }) : true;
  const hasSupportOption = !!productWidget || !!campaignWidget;

  // Komitmen cart (WAJIB atau tidak, tidak relevan) selalu menahan aktivasi sampai bayar —
  // begitu user menambahkan item apa pun via GabungItemWidget, alur join-gratis tidak boleh
  // dipakai lagi, terlepas admin mewajibkannya atau tidak. Lihat docs/arsitektur-gabung-forum.md
  // § "Koreksi: Komitmen Cart Selalu Menahan Aktivasi Sampai Bayar".
  const hasCartCommitment = productInCart || campaignInCart;
  const useCheckoutFlow   = anyRequired || hasCartCommitment;

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Daftar Menjadi Anggota</h1>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={tenantRow.name}
              className="mx-auto mt-2 h-16 w-16 rounded-full border-4 border-background object-cover shadow-md ring-4 ring-primary/10"
            />
          ) : (
            <p className="text-lg font-semibold text-primary mt-1">{tenantRow.name}</p>
          )}
        </div>

        {registrationInfo && (
          <div className="rounded-2xl border border-border bg-gradient-to-b from-primary/[0.04] to-transparent p-5">
            <div className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
              <Info className="h-3.5 w-3.5" />
              Tentang {tenantRow.name}
            </div>
            <div className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
              {registrationInfo}
            </div>
          </div>
        )}

        {eligibility.eligible ? (
          <div className="space-y-4">
            {useCheckoutFlow ? (
              <div className="space-y-4">
                <GabungItemWidget
                  tenantSlug={slug}
                  required={anyRequired}
                  product={productWidget}
                  campaign={campaignWidget}
                />
                {!anyRequired && (
                  <p className="text-xs text-muted-foreground text-center">
                    Karena Anda menambahkan dukungan di atas, keanggotaan akan aktif otomatis
                    setelah pembayaran selesai.
                  </p>
                )}
                <GabungCheckoutButton slug={slug} baseUrl={baseUrl} canProceed={canProceed} />
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground text-center">
                  Data Anda sudah lengkap. Klik tombol di bawah untuk bergabung.
                </p>
                {hasSupportOption && (
                  <GabungItemWidget
                    tenantSlug={slug}
                    required={false}
                    product={productWidget}
                    campaign={campaignWidget}
                  />
                )}
                {/* JoinForumButton WAJIB jadi elemen paling terakhir di branch ini — bar fixed
                    mobile-nya sendiri (self-contained spacer) hanya menjamin konten TIDAK
                    ketutupan kalau tidak ada konten lain dirender SETELAHNYA. Lihat
                    docs/arsitektur-mobile-shell.md § spacer. */}
                <JoinForumButton slug={slug} baseUrl={baseUrl} tenantName={tenantRow.name} />
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Anda harus melengkapi data berikut sebelum dapat mendaftar menjadi anggota{" "}
              <strong>{tenantRow.name}</strong>:
            </p>
            <ul className="space-y-2 rounded-xl border border-border p-4">
              {eligibility.missing.map((field) => {
                // "directory" + sudah mulai isi salah satu modul (belum lengkap) — tunjuk
                // modul itu spesifik ("Data Usaha Anda (belum lengkap)"), bukan label generik
                // "pilih salah satu" yang menyuruh mereka memilih ulang dari awal.
                const label = field === "directory" && eligibility.directoryIncompleteModule
                  ? `Data ${EKOSISTEM_MODULE_LABELS[eligibility.directoryIncompleteModule]} Anda (belum lengkap)`
                  : MEMBER_ELIGIBILITY_LABELS[field];
                return (
                  <li key={field}>
                    <a
                      href={memberEligibilityFixHref(field, baseUrl, enabledModulesArr, eligibility.directoryIncompleteModule)}
                      className="flex items-center justify-between gap-2 text-sm hover:text-primary transition-colors"
                    >
                      <span>{label}</span>
                      <ArrowRight className="h-4 w-4 shrink-0" />
                    </a>
                  </li>
                );
              })}
            </ul>
            <a href={`${baseUrl}/akun`} className="btn btn-ghost btn-md btn-full">
              ← Kembali ke Akun
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
