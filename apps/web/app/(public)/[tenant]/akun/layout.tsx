import { redirect }   from "next/navigation";
import { headers }    from "next/headers";
import { createHash } from "crypto";
import { auth }       from "@/lib/auth";
import { getAkunIdentity } from "@/lib/akun-identity";
import { db, members, createTenantDb } from "@jalajogja/db";
import { eq, and, isNull } from "drizzle-orm";
import { resolveBaseUrl } from "@/lib/resolve-base-url";
import { AkunNav }    from "@/components/akun/akun-nav";
import { AkunMobileHeader } from "@/components/akun/mobile/akun-mobile-header";
import { AkunBottomNav }    from "@/components/akun/mobile/akun-bottom-nav";
import { BadgeCheck } from "lucide-react";
import { resolveAkunBranding } from "@/lib/resolve-akun-branding";
import { getEnabledEkosistemModules } from "@/lib/ekosistem-modules.server";

type Props = {
  children: React.ReactNode;
  params:   Promise<{ tenant: string }>;
};

function gravatar(email: string) {
  const hash = createHash("md5").update(email.trim().toLowerCase()).digest("hex");
  return `https://www.gravatar.com/avatar/${hash}?s=80&d=mp`;
}

export default async function AkunLayout({ children, params }: Props) {
  const { tenant: slug } = await params;
  const hdrs    = await headers();
  const baseUrl = await resolveBaseUrl(slug);

  const session = await auth.api.getSession({ headers: hdrs });
  if (!session?.user) redirect(`${baseUrl}/login?redirect=${baseUrl}/akun`);

  const identity = await getAkunIdentity(session.user.id);
  if (!identity) {
    // Tidak ada front-end identity — cek apakah ini pengurus (yang belum di-link ke members)
    const { db: tenantDb, schema } = createTenantDb(slug);
    const [tenantUser] = await tenantDb
      .select({ memberId: schema.users.memberId })
      .from(schema.users)
      .where(eq(schema.users.betterAuthUserId, session.user.id))
      .limit(1);

    if (tenantUser?.memberId) {
      // Pengurus yang belum punya better_auth_user_id di members → auto-link sekarang
      // Sehingga pengurus bisa pakai front-end sebagai anggota (tidak redirect ke admin)
      await db.update(members)
        .set({ betterAuthUserId: session.user.id })
        .where(and(
          eq(members.id, tenantUser.memberId),
          isNull(members.betterAuthUserId),   // jangan overwrite yang sudah ada
        ));
      redirect(`${baseUrl}/akun`);              // reload — sekarang identity sudah ada
    }

    redirect(`${baseUrl}/akun-error`);
  }

  const isMember    = identity.type === "member";
  const displayEmail = identity.email || session.user.email;
  const avatarUrl    = identity.photoUrl ?? gravatar(displayEmail);

  // Toggle modul ekosistem tenant ini — thread ke nav supaya link Usaha/Pesantren/Profesional
  // yang dimatikan hilang dari sidebar+bottom-nav. Lihat lib/ekosistem-modules.ts.
  const enabledModules = await getEnabledEkosistemModules(createTenantDb(slug));

  // Label keanggotaan — bukan selalu tenant yang sedang dibrowsing, lihat
  // docs/arsitektur-akun.md § Resolusi Branding Kartu Anggota. `memberVerified=false`
  // → label = "Lengkapi Data" (profil belum lolos checkMemberEligibility) — checkmark
  // TIDAK ditampilkan sampai lengkap, berlaku untuk semua tipe tenant.
  let memberBadgeLabel  = "Anggota IKPM";
  let memberVerified    = false;
  if (isMember && identity.memberId) {
    const branding = await resolveAkunBranding(identity.memberId, slug);
    memberBadgeLabel = branding.memberLabel;
    memberVerified   = branding.verified;
  }

  return (
    <>
      {/* ── Desktop (≥md) — TIDAK diubah ── */}
      <div className="hidden md:block max-w-5xl mx-auto px-4 py-8">
        <div className="flex gap-8 items-start">

          {/* ── Sidebar ── */}
          <aside className="flex flex-col w-56 shrink-0 gap-4 sticky top-6">
            {/* Avatar + nama */}
            <div className="flex flex-col items-center gap-2 px-2 py-4 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatarUrl}
                alt={identity.name}
                width={56}
                height={56}
                className="w-14 h-14 rounded-full ring-2 ring-border object-cover"
              />
              <div className="min-w-0 w-full">
                <p className="font-semibold text-sm truncate">{identity.name}</p>
                <p className="text-xs text-muted-foreground truncate">{displayEmail}</p>
              </div>
              <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${
                isMember
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground"
              }`}>
                {isMember && memberVerified && <BadgeCheck className="h-3 w-3" />}
                {isMember ? memberBadgeLabel : "Akun Publik"}
              </span>
            </div>

            {/* Nav */}
            <AkunNav slug={slug} isMember={isMember} baseUrl={baseUrl} enabledModules={enabledModules} />
          </aside>

          {/* ── Konten ── */}
          <div className="flex-1 min-w-0">
            {children}
          </div>
        </div>
      </div>

      {/* ── Mobile (<md) — "app mode": header+bottom-nav sendiri, site chrome disembunyikan
          via isAkunAppMode (lib/mobile-route-checks.ts). Spacer dibundle di AkunBottomNav
          sendiri (elemen PALING TERAKHIR di sini — {children} lalu AkunBottomNav, tidak ada
          sibling lain di luar file ini yang render setelah layout — kasus paling aman dari
          pola spacer, lihat docs/arsitektur-mobile-shell.md § 5.3 Pola A). ── */}
      <div className="md:hidden">
        <AkunMobileHeader
          name={identity.name}
          avatarUrl={avatarUrl}
          badgeLabel={isMember ? memberBadgeLabel : "Akun Publik"}
        />
        <div className="px-4 py-4">
          {children}
        </div>
        <AkunBottomNav slug={slug} baseUrl={baseUrl} isMember={isMember} enabledModules={enabledModules} />
      </div>
    </>
  );
}
