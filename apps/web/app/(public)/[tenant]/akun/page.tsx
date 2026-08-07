import { redirect }  from "next/navigation";
import { headers }   from "next/headers";
import { eq, and, inArray } from "drizzle-orm";
import { auth }      from "@/lib/auth";
import { resolveBaseUrl } from "@/lib/resolve-base-url";
import { db, tenantMemberships, tenants, members, refIkpmCabang, createTenantDb, getSettings } from "@jalajogja/db";
import { getAkunIdentity, isMemberDataIncomplete } from "@/lib/akun-identity";
import { resolveAkunBranding } from "@/lib/resolve-akun-branding";
import { getTenantSeoBase }    from "@/lib/tenant-seo";
import { checkMemberEligibility, type MemberEligibilityField } from "@/lib/member-eligibility";
import { getEnabledEkosistemModules, getEkosistemModuleLabels } from "@/lib/ekosistem-modules.server";
import { enabledModuleList, resolveEkosistemModuleLabel, type EkosistemModule } from "@/lib/ekosistem-modules";
import { MemberCard } from "@/components/akun/mobile/member-card";
import { MembershipEligibilityOverlay } from "@/components/akun/membership-eligibility-overlay";
import {
  BadgeCheck, Receipt, Heart, CalendarDays,
  ShoppingBag, AlertCircle, Building2, BookOpen, ImageIcon, Briefcase, ClipboardList,
} from "lucide-react";

type Params = Promise<{ tenant: string }>;

export default async function AkunPage({ params }: { params: Params }) {
  const { tenant: slug } = await params;
  const hdrs    = await headers();
  const baseUrl = await resolveBaseUrl(slug);

  const session = await auth.api.getSession({ headers: hdrs });
  if (!session?.user) redirect(`${baseUrl}/login?redirect=${baseUrl}/akun`);

  const identity = await getAkunIdentity(session.user.id);
  if (!identity) redirect(`${baseUrl}/akun-error`);  // layout sudah handle ini, ini safety fallback

  const isMember     = identity.type === "member";
  const isIncomplete = isMemberDataIncomplete(identity);

  const tenantDb = createTenantDb(slug);

  // Modul ekosistem aktif tenant ini — dipakai untuk filter quick-action link Pesantren/
  // Usaha/Profesional DAN untuk mempersempit himpunan eligibility "directory". Lihat
  // lib/ekosistem-modules.ts + docs/arsitektur-ekosistem.md.
  const enabledModulesConfig = await getEnabledEkosistemModules(tenantDb);
  const enabledModulesArr    = enabledModuleList(enabledModulesConfig);
  // Label custom nama modul (2026-08-07) — thread ke quick-action links + overlay eligibility.
  const moduleLabels         = await getEkosistemModuleLabels(tenantDb);

  // Info keanggotaan
  let membershipInfo: {
    memberNumber:    string | null;
    status:          string | null;
    primaryCabangNama: string | null;  // dari ref_ikpm_cabang (cabang resmi PP IKPM)
    forumMembershipNumber: string | null; // nomor lokal forum (khusus tenant forum, opsional)
  } | null = null;
  let orgMemberLabel = "Keanggotaan IKPM";

  if (isMember && identity.memberId) {
    // Ambil member data + cabang resmi
    const [memberRow] = await db
      .select({
        memberNumber:    members.memberNumber,
        primaryCabangRefId: members.primaryCabangRefId,
      })
      .from(members)
      .where(eq(members.id, identity.memberId))
      .limit(1);

    // Status keanggotaan SAYA DI TENANT INI — fakta per-tenant, scoped ke browsed
    // tenant secara sengaja (beda dari branding, lihat resolveAkunBranding di bawah).
    // membershipNumber ikut di-select — kalau tenant ini forum dan sudah dikonfigurasi,
    // ini nomor lokal forum (bukan member_number global).
    const [membershipRow] = await db
      .select({ status: tenantMemberships.status, membershipNumber: tenantMemberships.membershipNumber })
      .from(tenantMemberships)
      .innerJoin(tenants, eq(tenants.id, tenantMemberships.tenantId))
      .where(and(
        eq(tenantMemberships.memberId, identity.memberId),
        eq(tenants.slug, slug),
      ))
      .limit(1);

    // Nama cabang resmi dari ref_ikpm_cabang
    let primaryCabangNama: string | null = null;
    if (memberRow?.primaryCabangRefId) {
      const [cabangRow] = await db
        .select({ nama: refIkpmCabang.nama })
        .from(refIkpmCabang)
        .where(eq(refIkpmCabang.id, memberRow.primaryCabangRefId))
        .limit(1);
      primaryCabangNama = cabangRow?.nama ?? null;
    }

    if (memberRow) {
      membershipInfo = {
        memberNumber:      memberRow.memberNumber,
        status:            membershipRow?.status ?? null,
        primaryCabangNama,
        forumMembershipNumber: membershipRow?.membershipNumber ?? null,
      };
    }
  }

  // Eligibility overlay — standar UMUM untuk SEMUA tipe tenant, bukan cuma forum. Kartu
  // tetap dirender di belakang, cuma ketutup visual. Lihat docs/arsitektur-akun.md
  // § "Eligibility Overlay Generik". Query tenant terpisah dari membershipInfo di atas
  // (sengaja) — INNER JOIN di atas mensyaratkan baris tenant_memberships sudah ada,
  // padahal justru "belum ada baris sama sekali" adalah kasus utama yang harus
  // terdeteksi di sini.
  //
  // Kondisi tampil beda per tipe tenant:
  //   - Forum: TIDAK lagi cuma gerbang `forumStatus`. Sejak admin bisa auto-join
  //     member ke forum (createMemberAction/commitImportAction set forumStatus='active'
  //     langsung, tanpa melalui pengecekan eligibility yang biasanya dipaksakan /gabung),
  //     eligibility WAJIB selalu dicek — bukan cuma saat belum joined. Overlay tampil
  //     kalau BELUM eligible (regardless status join) ATAU sudah eligible tapi belum
  //     genuinely joined (forumStatus != 'active'). Begitu eligible DAN sudah joined →
  //     tidak ada overlay sama sekali, tidak ada "ajakan bergabung" lagi.
  //   - Cabang/marhalah: HANYA selama belum eligible — begitu eligible, keanggotaan
  //     SUDAH otomatis (auto-populate), overlay tidak perlu tampil lagi.
  let showEligibilityOverlay = false;
  let overlayMissing: MemberEligibilityField[] = [];
  let overlayTenantName = "";
  let overlayIsForum = false;
  // Sudah GENUINELY menjadi anggota tenant ini (forumStatus='active' untuk forum, atau
  // baris tenant_memberships sudah ada untuk cabang/marhalah — auto-populate selalu insert
  // status='active' langsung, tidak ada lifecycle "pending" seperti forum). Dipakai overlay
  // untuk membedakan framing pesan: "lengkapi profil" (sudah anggota) vs "sebelum bisa
  // mendaftar" (belum anggota) — supaya tidak kontradiktif dengan kartu keanggotaan yang
  // sudah menampilkan No. Anggota/Status di baliknya.
  let overlayIsJoined = false;
  // Modul (Usaha/Pesantren/Profesional) yang sudah MULAI diisi member (punya baris) tapi
  // belum lengkap field wajibnya — dipakai overlay untuk arahkan langsung ke situ ("Lengkapi
  // Data Usaha Anda"), bukan minta pilih ulang dari 3 opsi. Lihat lib/member-eligibility.ts.
  let overlayDirectoryIncompleteModule: EkosistemModule | null = null;
  // Ada invoice OUTSTANDING (belum lunas) hasil komitmen /gabung — kalau terisi, PRIORITAS
  // TERTINGGI di atas eligibility apa pun (user sudah commit membayar). Lihat
  // docs/arsitektur-gabung-forum.md § "Koreksi: Komitmen Cart Selalu Menahan Aktivasi Sampai
  // Bayar".
  let overlayPendingInvoiceId: string | null = null;

  if (isMember && identity.memberId) {
    const [browsedTenantRow] = await db
      .select({ id: tenants.id, tenantType: tenants.tenantType, name: tenants.name })
      .from(tenants)
      .where(eq(tenants.slug, slug))
      .limit(1);

    if (browsedTenantRow) {
      overlayTenantName = browsedTenantRow.name;
      overlayIsForum    = browsedTenantRow.tenantType === "forum";

      if (overlayIsForum) {
        const [forumMembershipRow] = await db
          .select({ forumStatus: tenantMemberships.forumStatus })
          .from(tenantMemberships)
          .where(and(
            eq(tenantMemberships.tenantId, browsedTenantRow.id),
            eq(tenantMemberships.memberId, identity.memberId),
          ))
          .limit(1);

        const isJoined = forumMembershipRow?.forumStatus === "active";
        overlayIsJoined = isJoined;

        // Ada invoice belum lunas hasil komitmen /gabung? Kalau ada, itu PRIORITAS mutlak di
        // atas ajakan "Lengkapi Data"/"Gabung X" — user sudah memilih untuk membayar, overlay
        // harus mengarahkan mereka melunasi, bukan menyuruh mulai dari awal lagi. Query-based
        // (bukan baris tenant_memberships eager-written) — lihat § "Koreksi..." di
        // docs/arsitektur-gabung-forum.md untuk alasan.
        let pendingInvoiceId: string | null = null;
        if (!isJoined) {
          const { db: tdb, schema } = tenantDb;
          const [pendingInvoiceRow] = await tdb
            .select({ id: schema.invoices.id })
            .from(schema.invoices)
            .innerJoin(schema.invoiceItems, eq(schema.invoiceItems.invoiceId, schema.invoices.id))
            .where(and(
              eq(schema.invoices.memberId, identity.memberId),
              inArray(schema.invoices.status, ["pending", "waiting_verification", "partial", "overdue"]),
              eq(schema.invoiceItems.forGabungRegistration, true),
            ))
            .limit(1);
          pendingInvoiceId = pendingInvoiceRow?.id ?? null;
        }

        if (pendingInvoiceId) {
          showEligibilityOverlay  = true;
          overlayPendingInvoiceId = pendingInvoiceId;
        } else {
          const eligibility = await checkMemberEligibility(identity.memberId, enabledModulesArr);
          if (!eligibility.eligible || !isJoined) {
            showEligibilityOverlay = true;
            overlayMissing = eligibility.missing; // kosong = eligible, komponen tampilkan "Gabung X"
            overlayDirectoryIncompleteModule = eligibility.directoryIncompleteModule;
          }
        }
      } else {
        // Cabang/marhalah: auto-populate SELALU insert status='active' langsung (tidak ada
        // lifecycle pending seperti forum) — jadi baris tenant_memberships sudah ADA berarti
        // genuinely anggota, meski profil datanya belum lengkap.
        overlayIsJoined = membershipInfo?.status != null;
        const eligibility = await checkMemberEligibility(identity.memberId, enabledModulesArr);
        if (!eligibility.eligible) {
          showEligibilityOverlay = true;
          overlayMissing = eligibility.missing;
          overlayDirectoryIncompleteModule = eligibility.directoryIncompleteModule;
        }
      }
    }
  }

  // Branding — untuk MemberCard mobile + badge "Info keanggotaan" desktop.
  // Anggota IKPM: resolusi bukan selalu tenant yang sedang dibrowsing (lihat
  // docs/arsitektur-akun.md § Resolusi Branding Kartu Anggota). Akun publik: tidak
  // punya konsep cabang, selalu pakai tenant yang sedang dibrowsing.
  let logoUrl: string | null;
  let siteName: string;
  let primaryColor: string;
  let memberVerified = false;
  if (isMember && identity.memberId) {
    const branding = await resolveAkunBranding(identity.memberId, slug);
    logoUrl        = branding.logoUrl;
    siteName       = branding.orgName;
    orgMemberLabel = branding.memberLabel;
    primaryColor   = branding.primaryColor;
    memberVerified = branding.verified;
  } else {
    const [seo, displaySettings] = await Promise.all([
      getTenantSeoBase(slug),
      getSettings(createTenantDb(slug), "display"),
    ]);
    logoUrl      = seo.logoUrl;
    siteName     = seo.siteName;
    primaryColor = (displaySettings.primary_color as string | undefined) || "#2563eb";
  }

  // Link ke 3 modul ekosistem + Foto Saya — item ber-moduleKey hilang kalau modul itu
  // dimatikan admin di tenant ini (Foto Saya tidak punya moduleKey, selalu tampil).
  const directoryLinks = (
    [
      { href: `${baseUrl}/akun/pesantren`,   icon: BookOpen,   label: resolveEkosistemModuleLabel("pesantren", moduleLabels),   desc: "Data keterlibatan pesantren", moduleKey: "pesantren" },
      { href: `${baseUrl}/akun/usaha`,       icon: Building2,  label: resolveEkosistemModuleLabel("usaha", moduleLabels),       desc: "Data usaha & bisnis",         moduleKey: "usaha" },
      { href: `${baseUrl}/akun/profesional`, icon: Briefcase,  label: resolveEkosistemModuleLabel("profesional", moduleLabels), desc: "Data profesi & kredensial",   moduleKey: "profesional" },
      { href: `${baseUrl}/akun/media`,       icon: ImageIcon,  label: "Foto Saya",   desc: "Kelola foto yang Anda upload" },
    ] as Array<{ href: string; icon: React.ElementType; label: string; desc: string; moduleKey?: EkosistemModule }>
  ).filter((item) => !item.moduleKey || enabledModulesConfig[item.moduleKey]);

  const completeBanner = isMember && isIncomplete && (
    <a
      href={`${baseUrl}/akun/lengkapi`}
      className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800 p-4 hover:bg-amber-100 dark:hover:bg-amber-900 transition-colors"
    >
      <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">Data Keanggotaan Belum Lengkap</p>
        <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
          Lengkapi data diri agar profil keanggotaan terdaftar dengan benar.
        </p>
      </div>
      <span className="text-xs text-amber-700 dark:text-amber-300 font-medium shrink-0 mt-0.5">Lengkapi →</span>
    </a>
  );

  return (
    <>
    {/* ══════════ Desktop (≥md) — TIDAK diubah ══════════ */}
    <div className="hidden md:block space-y-6">

      {completeBanner}

      {/* Info keanggotaan (anggota saja) */}
      {isMember && (
        <div className="relative">
          <div className="rounded-xl border border-border p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold text-sm">
                {memberVerified && <BadgeCheck className="h-4 w-4 text-primary" />}
                {orgMemberLabel}
              </div>
              <a href={`${baseUrl}/akun/lengkapi`} className="text-xs text-primary hover:underline">
                {isIncomplete ? "Lengkapi →" : "Edit →"}
              </a>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {membershipInfo?.memberNumber && (
                <>
                  <dt className="text-muted-foreground">No. Anggota</dt>
                  <dd className="font-mono font-medium">{membershipInfo.memberNumber}</dd>
                </>
              )}
              {membershipInfo?.forumMembershipNumber && (
                <>
                  <dt className="text-muted-foreground">No. Anggota Forum</dt>
                  <dd className="font-mono font-medium">{membershipInfo.forumMembershipNumber}</dd>
                </>
              )}
              {identity.stambuk && (
                <>
                  <dt className="text-muted-foreground">Stambuk Gontor</dt>
                  <dd className="font-mono">{identity.stambuk}</dd>
                </>
              )}
              {membershipInfo?.primaryCabangNama ? (
                <>
                  <dt className="text-muted-foreground">PC IKPM</dt>
                  <dd>{membershipInfo.primaryCabangNama}</dd>
                </>
              ) : (
                <>
                  <dt className="text-muted-foreground">PC IKPM</dt>
                  <dd className="text-muted-foreground italic text-xs">
                    <a href={`${baseUrl}/akun/lengkapi`} className="underline hover:text-foreground">Pilih cabang Anda →</a>
                  </dd>
                </>
              )}
              {membershipInfo?.status && (
                <>
                  <dt className="text-muted-foreground">Status</dt>
                  <dd className="capitalize">{membershipInfo.status}</dd>
                </>
              )}
            </dl>
            {identity.memberId && (
              <div className="pt-2 border-t border-border">
                <a href={`${baseUrl}/anggota/${identity.memberId}`} className="text-sm text-primary hover:underline">
                  Lihat profil lengkap →
                </a>
              </div>
            )}
          </div>
          {showEligibilityOverlay && (
            <MembershipEligibilityOverlay
              tenantName={overlayTenantName}
              missing={overlayMissing}
              directoryIncompleteModule={overlayDirectoryIncompleteModule}
              baseUrl={baseUrl}
              isForum={overlayIsForum}
              isJoined={overlayIsJoined}
              enabledModules={enabledModulesConfig}
              moduleLabels={moduleLabels}
              pendingInvoiceId={overlayPendingInvoiceId}
            />
          )}
        </div>
      )}

      {/* Quick links data anggota */}
      {isMember && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {directoryLinks.map(({ href, icon: Icon, label, desc }) => (
            <a key={href} href={href}
              className="flex items-center gap-3 rounded-xl border border-border p-4 hover:border-primary/50 hover:bg-muted/40 transition-all">
              <Icon className="h-5 w-5 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="font-medium text-sm">{label}</p>
                <p className="text-xs text-muted-foreground truncate">{desc}</p>
              </div>
            </a>
          ))}
        </div>
      )}

      {/* Quick links layanan */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { href: `${baseUrl}/akun/transaksi`, icon: Receipt,      label: "Transaksi", desc: "Riwayat invoice & pembayaran" },
          { href: `${baseUrl}/campaign`,        icon: Heart,        label: "Donasi",    desc: "Kampanye & infaq" },
          { href: `${baseUrl}/agenda`,          icon: CalendarDays, label: "Agenda",    desc: "Event & kegiatan" },
          { href: `${baseUrl}/produk`,          icon: ShoppingBag,  label: "Produk",    desc: "Belanja produk" },
        ].map(({ href, icon: Icon, label, desc }) => (
          <a key={href} href={href}
            className="flex items-center gap-3 rounded-xl border border-border p-4 hover:border-primary/50 hover:bg-muted/40 transition-all">
            <Icon className="h-5 w-5 text-primary shrink-0" />
            <div className="min-w-0">
              <p className="font-medium text-sm">{label}</p>
              <p className="text-xs text-muted-foreground truncate">{desc}</p>
            </div>
          </a>
        ))}
      </div>
    </div>

    {/* ══════════ Mobile (<md) — kartu anggota + quick actions ══════════ */}
    <div className="md:hidden space-y-4">

      {/* Ditarik naik (-mt-16) — overlap ke area gradasi AkunMobileHeader yang sengaja
          dilebarkan (pb-20), supaya kartu tampak mengambang di atas gradasi. HANYA blok
          pertama ini yang ditarik — space-y-4 di parent tidak kena (first child tidak dapat
          margin-top dari space-y sama sekali, jadi -mt-16 di sini tidak konflik). */}
      <div className="-mt-16 space-y-4">
        {completeBanner}
        <div className="relative">
          <MemberCard
            type={identity.type}
            name={identity.name}
            photoUrl={identity.photoUrl}
            memberNumber={membershipInfo?.memberNumber ?? null}
            stambuk={identity.stambuk}
            logoUrl={logoUrl}
            siteName={siteName}
            color={primaryColor}
            forumMembershipNumber={membershipInfo?.forumMembershipNumber ?? null}
          />
          {showEligibilityOverlay && (
            <MembershipEligibilityOverlay
              tenantName={overlayTenantName}
              missing={overlayMissing}
              directoryIncompleteModule={overlayDirectoryIncompleteModule}
              baseUrl={baseUrl}
              isForum={overlayIsForum}
              isJoined={overlayIsJoined}
              enabledModules={enabledModulesConfig}
              moduleLabels={moduleLabels}
              pendingInvoiceId={overlayPendingInvoiceId}
            />
          )}
        </div>
      </div>

      {/* 3 quick action utama */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { href: `${baseUrl}/akun/transaksi`, icon: Receipt,      label: "Transaksi" },
          { href: `${baseUrl}/akun/profil`,    icon: BadgeCheck,   label: "Info Login" },
          { href: `${baseUrl}/akun/${isMember ? "lengkapi" : "data"}`, icon: ClipboardList, label: "Edit Profil" },
        ].map(({ href, icon: Icon, label }) => (
          <a key={href} href={href}
            className="flex flex-col items-center gap-2 rounded-xl border border-border py-3 hover:border-primary/50 hover:bg-muted/40 transition-all">
            <Icon className="h-5 w-5 text-primary" />
            <span className="text-xs font-medium">{label}</span>
          </a>
        ))}
      </div>

      {/* Menu cepat data anggota — horizontal scroll, ikon bulat (anggota saja) */}
      {isMember && (
        <div>
          <p className="mb-2 text-sm font-semibold">Menu Cepat</p>
          <div className="flex gap-4 overflow-x-auto pb-1">
            {directoryLinks.map(({ href, icon: Icon, label }) => (
              <a key={href} href={href} className="flex shrink-0 flex-col items-center gap-1.5 w-16">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="text-center text-[11px] leading-tight text-muted-foreground">{label}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Layanan lain */}
      <div>
        <p className="mb-2 text-sm font-semibold">Layanan</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { href: `${baseUrl}/agenda`,   icon: CalendarDays, label: "Agenda", desc: "Event & kegiatan" },
            { href: `${baseUrl}/produk`,   icon: ShoppingBag,  label: "Produk", desc: "Belanja produk" },
            { href: `${baseUrl}/campaign`, icon: Heart,        label: "Donasi", desc: "Kampanye & infaq" },
          ].map(({ href, icon: Icon, label, desc }) => (
            <a key={href} href={href}
              className="flex items-center gap-3 rounded-xl border border-border p-3 hover:border-primary/50 hover:bg-muted/40 transition-all">
              <Icon className="h-5 w-5 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium">{label}</p>
                <p className="truncate text-xs text-muted-foreground">{desc}</p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
    </>
  );
}
