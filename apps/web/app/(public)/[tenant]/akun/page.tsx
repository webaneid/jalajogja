import { createHash }   from "crypto";
import { redirect }      from "next/navigation";
import { headers }       from "next/headers";
import { eq }            from "drizzle-orm";
import { auth }          from "@/lib/auth";
import { db, tenantMemberships, tenants, members } from "@jalajogja/db";
import { getAkunIdentity, isMemberDataIncomplete } from "@/lib/akun-identity";
import {
  BadgeCheck, Receipt, Heart, CalendarDays,
  ShoppingBag, KeyRound, AlertCircle, Building2, BookOpen, Package,
} from "lucide-react";

type Params = Promise<{ tenant: string }>;

function gravatar(email: string) {
  const hash = createHash("md5").update(email.trim().toLowerCase()).digest("hex");
  return `https://www.gravatar.com/avatar/${hash}?s=80&d=mp`;
}

export default async function AkunPage({ params }: { params: Params }) {
  const { tenant: slug } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect(`/${slug}/login?redirect=/${slug}/akun`);

  const identity = await getAkunIdentity(session.user.id);
  // Jika session ada tapi tidak ada profil front-end → user ini hanya punya akun
  // dashboard (pengurus). Jangan redirect ke /login — akan loop. Arahkan ke dashboard.
  if (!identity) redirect(`/${slug}/dashboard`);

  const isMember     = identity.type === "member";
  const isIncomplete = isMemberDataIncomplete(identity);

  // ── Info keanggotaan di cabang ini ────────────────────────────────────────
  let membershipInfo: {
    memberNumber: string | null;
    status:       string | null;
    tenantName:   string | null;
  } | null = null;

  if (isMember && identity.memberId) {
    const [tenant] = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.slug, slug))
      .limit(1);

    if (tenant) {
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
  }

  const displayEmail = identity.email || session.user.email;

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-8">

      {/* ── Header profil ── */}
      <div className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={gravatar(displayEmail)}
          alt={identity.name}
          width={64}
          height={64}
          className="w-16 h-16 rounded-full ring-2 ring-border object-cover"
        />
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold truncate">{identity.name}</h1>
          <p className="text-sm text-muted-foreground truncate">{displayEmail}</p>
          <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium mt-1 ${
            isMember ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
          }`}>
            {isMember ? "Anggota IKPM" : "Akun Publik"}
          </span>
        </div>
        <a
          href={`/${slug}/akun/profil`}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <KeyRound className="h-3.5 w-3.5" />
          Info Login
        </a>
      </div>

      {/* ── Banner lengkapi data (anggota, data belum lengkap) ── */}
      {isMember && isIncomplete && (
        <a
          href={`/${slug}/akun/lengkapi`}
          className="flex items-start gap-3 rounded-xl border border-border p-4 hover:bg-muted/30 transition-colors"
        >
          <AlertCircle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Data Keanggotaan Belum Lengkap</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Lengkapi data diri agar profil keanggotaan terdaftar dengan benar.
            </p>
          </div>
          <span className="text-xs text-primary font-medium shrink-0 mt-0.5">Lengkapi →</span>
        </a>
      )}

      {/* ── Info keanggotaan (anggota saja) ── */}
      {isMember && (
        <div className="rounded-xl border border-border p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold text-sm">
              <BadgeCheck className="h-4 w-4 text-primary" />
              Informasi Keanggotaan
            </div>
            <a
              href={`/${slug}/akun/lengkapi`}
              className="text-xs text-primary hover:underline"
            >
              {isIncomplete ? "Lengkapi Data →" : "Edit Data Pribadi →"}
            </a>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {membershipInfo?.memberNumber && (
              <>
                <dt className="text-muted-foreground">Nomor Anggota</dt>
                <dd className="font-mono font-medium">{membershipInfo.memberNumber}</dd>
              </>
            )}
            {identity.stambuk && (
              <>
                <dt className="text-muted-foreground">No. Stambuk Gontor</dt>
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
              <a
                href={`/${slug}/anggota/${identity.memberId}`}
                className="text-sm text-primary hover:underline"
              >
                Lihat Detail Profil →
              </a>
            </div>
          )}
        </div>
      )}

      {/* ── Quick links — data anggota (member saja) ── */}
      {isMember && (
        <div className="grid grid-cols-2 gap-3">
          {[
            { href: `/${slug}/akun/pesantren`, icon: BookOpen,  label: "Data Pesantren", desc: "Keterlibatan di pesantren" },
            { href: `/${slug}/akun/usaha`,     icon: Building2, label: "Data Usaha",     desc: "Usaha & bisnis Anda" },
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

          {/* Coming soon: Produk */}
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-border p-4 opacity-50 cursor-not-allowed col-span-2 sm:col-span-1">
            <Package className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="font-medium text-sm text-muted-foreground">Produk</p>
              <p className="text-xs text-muted-foreground">Segera hadir</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Quick links — layanan publik ── */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { href: `/${slug}/akun/transaksi`, icon: Receipt,      label: "Transaksi",  desc: "Riwayat invoice" },
          { href: `/${slug}/donasi`,          icon: Heart,        label: "Donasi",     desc: "Riwayat donasi" },
          { href: `/${slug}/event`,           icon: CalendarDays, label: "Event",      desc: "Riwayat keikutsertaan" },
          { href: `/${slug}/toko`,            icon: ShoppingBag,  label: "Belanja",    desc: "Riwayat pembelian" },
        ].map(({ href, icon: Icon, label, desc }) => (
          <a
            key={href}
            href={href}
            className="flex items-center gap-3 rounded-xl border border-border p-4 hover:border-primary/50 hover:bg-muted/40 transition-all"
          >
            <Icon className="h-5 w-5 text-primary shrink-0" />
            <div className="min-w-0">
              <p className="font-medium text-sm">{label}</p>
              <p className="text-xs text-muted-foreground truncate">{desc}</p>
            </div>
          </a>
        ))}
      </div>

      {/* ── Sign out ── */}
      <div className="pt-2 border-t border-border">
        <form action="/api/auth/sign-out" method="POST">
          <button type="submit" className="text-sm text-muted-foreground hover:text-destructive transition-colors">
            Keluar dari akun
          </button>
        </form>
      </div>
    </div>
  );
}
