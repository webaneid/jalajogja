import { redirect }  from "next/navigation";
import { headers }   from "next/headers";
import { eq, and }   from "drizzle-orm";
import { auth }      from "@/lib/auth";
import { resolveBaseUrl } from "@/lib/resolve-base-url";
import { db, tenantMemberships, tenants, members, refIkpmCabang } from "@jalajogja/db";
import { getAkunIdentity, isMemberDataIncomplete } from "@/lib/akun-identity";
import { resolveOrgLabels } from "@/lib/tenant-org-label";
import {
  BadgeCheck, Receipt, Heart, CalendarDays,
  ShoppingBag, AlertCircle, Building2, BookOpen, ImageIcon, Briefcase,
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

  // Info keanggotaan
  let membershipInfo: {
    memberNumber:    string | null;
    status:          string | null;
    primaryCabangNama: string | null;  // dari ref_ikpm_cabang (cabang resmi PP IKPM)
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

    // Status keanggotaan + info tenant (untuk label dinamis) dari tenant ini
    const [membershipRow] = await db
      .select({
        status:         tenantMemberships.status,
        tenantName:     tenants.name,
        tenantType:     tenants.tenantType,
        marhalahYear:   tenants.marhalahYear,
        marhalahPeriod: tenants.marhalahPeriod,
      })
      .from(tenantMemberships)
      .innerJoin(tenants, eq(tenants.id, tenantMemberships.tenantId))
      .where(and(
        eq(tenantMemberships.memberId, identity.memberId),
        eq(tenants.slug, slug),
      ))
      .limit(1);

    if (membershipRow) {
      orgMemberLabel = resolveOrgLabels({
        name:           membershipRow.tenantName,
        tenantType:     (membershipRow.tenantType as "cabang" | "marhalah" | "forum") ?? "cabang",
        marhalahYear:   membershipRow.marhalahYear ?? null,
        marhalahPeriod: (membershipRow.marhalahPeriod as "awal" | "akhir" | null) ?? null,
      }).memberLabel;
    }

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
      };
    }
  }

  return (
    <div className="space-y-6">

      {/* Banner lengkapi data */}
      {isMember && isIncomplete && (
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
      )}

      {/* Info keanggotaan (anggota saja) */}
      {isMember && (
        <div className="rounded-xl border border-border p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold text-sm">
              <BadgeCheck className="h-4 w-4 text-primary" />
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
      )}

      {/* Quick links data anggota */}
      {isMember && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { href: `${baseUrl}/akun/pesantren`,   icon: BookOpen,   label: "Pesantren",   desc: "Data keterlibatan pesantren" },
            { href: `${baseUrl}/akun/usaha`,       icon: Building2,  label: "Usaha",       desc: "Data usaha & bisnis" },
            { href: `${baseUrl}/akun/profesional`, icon: Briefcase,  label: "Profesional", desc: "Data profesi & kredensial" },
            { href: `${baseUrl}/akun/media`,       icon: ImageIcon,  label: "Foto Saya",   desc: "Kelola foto yang Anda upload" },
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
  );
}
