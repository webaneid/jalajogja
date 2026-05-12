import { redirect }  from "next/navigation";
import { headers }   from "next/headers";
import { eq }        from "drizzle-orm";
import { auth }      from "@/lib/auth";
import { db, tenantMemberships, tenants, members } from "@jalajogja/db";
import { getAkunIdentity, isMemberDataIncomplete } from "@/lib/akun-identity";
import {
  BadgeCheck, Receipt, Heart, CalendarDays,
  ShoppingBag, AlertCircle, Building2, BookOpen,
} from "lucide-react";

type Params = Promise<{ tenant: string }>;

export default async function AkunPage({ params }: { params: Params }) {
  const { tenant: slug } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect(`/${slug}/login?redirect=/${slug}/akun`);

  const identity = await getAkunIdentity(session.user.id);
  if (!identity) redirect(`/${slug}/dashboard`);

  const isMember     = identity.type === "member";
  const isIncomplete = isMemberDataIncomplete(identity);

  // Info keanggotaan di cabang ini
  let membershipInfo: {
    memberNumber: string | null;
    status:       string | null;
    tenantName:   string | null;
  } | null = null;

  if (isMember && identity.memberId) {
    const [row] = await db
      .select({
        memberNumber: members.memberNumber,
        status:       tenantMemberships.status,
        tenantName:   tenants.name,
      })
      .from(tenantMemberships)
      .innerJoin(members, eq(members.id, tenantMemberships.memberId))
      .innerJoin(tenants, eq(tenants.id, tenantMemberships.tenantId))
      .where(eq(tenantMemberships.memberId, identity.memberId))
      .limit(1);
    if (row) membershipInfo = row;
  }

  return (
    <div className="space-y-6">

      {/* Banner lengkapi data */}
      {isMember && isIncomplete && (
        <a
          href={`/${slug}/akun/lengkapi`}
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
              Keanggotaan IKPM
            </div>
            <a href={`/${slug}/akun/lengkapi`} className="text-xs text-primary hover:underline">
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
            {membershipInfo?.tenantName && (
              <>
                <dt className="text-muted-foreground">Cabang</dt>
                <dd>{membershipInfo.tenantName}</dd>
              </>
            )}
            {membershipInfo?.status && (
              <>
                <dt className="text-muted-foreground">Status</dt>
                <dd className="capitalize">{membershipInfo.status}</dd>
              </>
            )}
            {!membershipInfo && (
              <>
                <dt className="text-muted-foreground">Cabang</dt>
                <dd className="text-muted-foreground italic text-xs">Belum terdaftar di cabang ini</dd>
              </>
            )}
          </dl>
          {identity.memberId && (
            <div className="pt-2 border-t border-border">
              <a href={`/${slug}/anggota/${identity.memberId}`} className="text-sm text-primary hover:underline">
                Lihat profil lengkap →
              </a>
            </div>
          )}
        </div>
      )}

      {/* Quick links data anggota */}
      {isMember && (
        <div className="grid grid-cols-2 gap-3">
          {[
            { href: `/${slug}/akun/pesantren`, icon: BookOpen,  label: "Pesantren", desc: "Data keterlibatan pesantren" },
            { href: `/${slug}/akun/usaha`,     icon: Building2, label: "Usaha",     desc: "Data usaha & bisnis" },
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
          { href: `/${slug}/akun/transaksi`, icon: Receipt,      label: "Transaksi", desc: "Riwayat invoice & pembayaran" },
          { href: `/${slug}/campaign`,        icon: Heart,        label: "Donasi",    desc: "Kampanye & infaq" },
          { href: `/${slug}/agenda`,          icon: CalendarDays, label: "Agenda",    desc: "Event & kegiatan" },
          { href: `/${slug}/produk`,          icon: ShoppingBag,  label: "Produk",    desc: "Belanja produk" },
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
