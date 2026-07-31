import { redirect }      from "next/navigation";
import { headers }       from "next/headers";
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
import type { MembershipConfigData } from "../../../(dashboard)/app/[tenant]/settings/actions";
import { JoinForumButton } from "./join-forum-button";
import { CheckCircle2, ArrowRight, Heart, Info } from "lucide-react";

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
  // anggota. Lihat docs/arsitektur-backbone-ikpm.md § "Alur Pendaftaran Forum v2 — 2.
  // Konfigurasi Pembayaran per Forum".
  const { db: tdb, schema } = tenantDb;
  const [config, generalSettings] = await Promise.all([
    getSetting<MembershipConfigData>(tenantDb, "membership_config", "forum"),
    getSettings(tenantDb, "general"),
  ]);
  const registrationInfo = config?.registrationInfo?.trim() || null;
  const logoUrl = (generalSettings.logo_url as string | undefined) || null;

  let paymentRequired = false;
  let supportProduct:  { name: string; slug: string } | null = null;
  let supportCampaign: { title: string; slug: string } | null = null;
  let requireMode: "either" | "both" = "either";

  if (eligibility.eligible && config) {
    paymentRequired = config.paymentRequired;
    requireMode     = config.requireMode;

    if (config.requiredProductId) {
      const [p] = await tdb
        .select({ name: schema.products.name, slug: schema.products.slug })
        .from(schema.products)
        .where(eq(schema.products.id, config.requiredProductId))
        .limit(1);
      if (p) supportProduct = p;
    }
    if (config.requiredCampaignId) {
      const [c] = await tdb
        .select({ title: schema.campaigns.title, slug: schema.campaigns.slug })
        .from(schema.campaigns)
        .where(eq(schema.campaigns.id, config.requiredCampaignId))
        .limit(1);
      if (c) supportCampaign = { title: c.title, slug: c.slug };
    }
  }

  const hasSupportOption = !!supportProduct || !!supportCampaign;

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
            {paymentRequired ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground text-center">
                  Forum ini mewajibkan pembayaran berikut untuk anggota baru. Keanggotaan Anda
                  akan <strong>aktif otomatis</strong> begitu pembayaran dikonfirmasi.
                  {supportProduct && supportCampaign && requireMode === "either" && " Cukup selesaikan salah satu di bawah."}
                  {supportProduct && supportCampaign && requireMode === "both" && " Kedua-duanya wajib diselesaikan."}
                </p>
                {/* ?forGabung=1 — penanda eksplisit "niat bayar untuk daftar forum", dibaca
                    oleh halaman produk/campaign lalu diteruskan ke cart_items.
                    for_gabung_registration. TANPA penanda ini, siapa pun yang beli/donasi item
                    yang SAMA lewat halaman biasa (bukan dari sini) TIDAK PERNAH mengaktifkan
                    keanggotaan forum — donasi organik dan registrasi forum sengaja dipisah
                    total. Lihat docs/arsitektur-backbone-ikpm.md § "Pemisahan Donasi vs
                    Registrasi Forum". */}
                <div className="space-y-2">
                  {supportProduct && (
                    <a
                      href={`${baseUrl}/produk/${supportProduct.slug}?forGabung=1`}
                      className="flex items-center justify-between gap-2 rounded-xl border border-border p-4 text-sm hover:border-primary/50 hover:bg-muted/40 transition-all"
                    >
                      <span>Beli produk: <strong>{supportProduct.name}</strong></span>
                      <ArrowRight className="h-4 w-4 shrink-0" />
                    </a>
                  )}
                  {supportCampaign && (
                    <a
                      href={`${baseUrl}/campaign/${supportCampaign.slug}?forGabung=1`}
                      className="flex items-center justify-between gap-2 rounded-xl border border-border p-4 text-sm hover:border-primary/50 hover:bg-muted/40 transition-all"
                    >
                      <span>Donasi: <strong>{supportCampaign.title}</strong></span>
                      <ArrowRight className="h-4 w-4 shrink-0" />
                    </a>
                  )}
                </div>
                <a href={`${baseUrl}/akun`} className="btn btn-ghost btn-md btn-full">
                  ← Kembali ke Akun
                </a>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground text-center">
                  Data Anda sudah lengkap. Klik tombol di bawah untuk bergabung.
                </p>
                <JoinForumButton slug={slug} baseUrl={baseUrl} />
                {hasSupportOption && (
                  <div className="space-y-2 rounded-xl border border-dashed border-border p-4">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <Heart className="h-3.5 w-3.5" /> Ingin mendukung {tenantRow.name}? (opsional)
                    </p>
                    {supportProduct && (
                      <a href={`${baseUrl}/produk/${supportProduct.slug}`} className="block text-sm text-primary hover:underline">
                        {supportProduct.name} →
                      </a>
                    )}
                    {supportCampaign && (
                      <a href={`${baseUrl}/campaign/${supportCampaign.slug}`} className="block text-sm text-primary hover:underline">
                        {supportCampaign.title} →
                      </a>
                    )}
                  </div>
                )}
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
