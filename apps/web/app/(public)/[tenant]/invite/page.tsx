// Halaman terima undangan — PUBLIC, aksesibel tanpa auth
// Tapi jika user belum login, form daftar akun akan ditampilkan
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { createTenantDb, db, tenants, members } from "@jalajogja/db";
import { getCurrentSession } from "@/lib/tenant";
import { InviteAcceptClient } from "./invite-accept-client";

const ROLE_LABELS: Record<string, string> = {
  ketua:      "Ketua",
  sekretaris: "Sekretaris",
  bendahara:  "Bendahara",
  custom:     "Role Kustom",
};

export default async function InvitePage({
  params,
  searchParams,
}: {
  params:       Promise<{ tenant: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { tenant: slug } = await params;
  const { token } = await searchParams;

  if (!token) notFound();

  // Validasi tenant
  const [tenant] = await db
    .select({ id: tenants.id, name: tenants.name, isActive: tenants.isActive })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);

  if (!tenant || !tenant.isActive) notFound();

  const { db: tenantDb, schema } = createTenantDb(slug);

  // Cari invite by token
  const [invite] = await tenantDb
    .select()
    .from(schema.tenantInvites)
    .where(eq(schema.tenantInvites.token, token))
    .limit(1);

  // Fetch custom role name jika ada
  let customRoleName: string | null = null;
  if (invite?.customRoleId) {
    const [cr] = await tenantDb
      .select({ name: schema.customRoles.name })
      .from(schema.customRoles)
      .where(eq(schema.customRoles.id, invite.customRoleId))
      .limit(1);
    customRoleName = cr?.name ?? null;
  }

  // Fetch nama member yang diundang
  let memberName: string | null = null;
  let memberEmail: string | null = invite?.email ?? null;
  if (invite?.memberId) {
    const [m] = await db
      .select({ name: members.name })
      .from(members)
      .where(eq(members.id, invite.memberId))
      .limit(1);
    memberName = m?.name ?? null;
  }

  // Cek sesi login saat ini
  const session = await getCurrentSession();
  const isLoggedIn = !!session?.user;

  // Tentukan status undangan
  const isAccepted = !!invite?.acceptedAt;
  const isExpired  = invite ? new Date(invite.expiresAt) < new Date() : false;
  const isInvalid  = !invite;

  // Cek apakah user yang sedang login sudah jadi anggota tenant ini
  let alreadyMember = false;
  if (isLoggedIn && session?.user) {
    const [existing] = await tenantDb
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.betterAuthUserId, session.user.id))
      .limit(1);
    alreadyMember = !!existing;
  }

  const roleName = invite
    ? (invite.role === "custom" && customRoleName
        ? customRoleName
        : (ROLE_LABELS[invite.role] ?? invite.role))
    : null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="max-w-md mx-auto">
          <span className="font-semibold text-sm">{tenant.name}</span>
          <span className="text-xs text-muted-foreground ml-2">· Undangan Dashboard</span>
        </div>
      </header>

      {/* Konten */}
      <main className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-md space-y-5">
          {isInvalid && (
            <StatusCard
              type="error"
              title="Link Tidak Valid"
              message="Link undangan ini tidak ditemukan. Pastikan link yang Anda buka sudah benar."
            />
          )}

          {!isInvalid && isAccepted && (
            <StatusCard
              type="success"
              title="Undangan Sudah Diterima"
              message="Undangan ini sudah pernah digunakan. Silakan login ke dashboard."
              action={<a href={`/${slug}/dashboard`} className="text-sm text-primary underline">
                Buka Dashboard
              </a>}
            />
          )}

          {!isInvalid && !isAccepted && isExpired && (
            <StatusCard
              type="error"
              title="Undangan Kadaluarsa"
              message="Link undangan ini sudah tidak berlaku. Hubungi admin untuk mendapatkan link baru."
            />
          )}

          {!isInvalid && !isAccepted && !isExpired && (
            <>
              {/* Info undangan */}
              <div className="rounded-lg border border-border p-5 space-y-3">
                <h1 className="text-base font-semibold">
                  Anda diundang bergabung sebagai pengurus
                </h1>
                <div className="space-y-1 text-sm">
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-28">Organisasi</span>
                    <span className="font-medium">{tenant.name}</span>
                  </div>
                  {memberName && (
                    <div className="flex gap-2">
                      <span className="text-muted-foreground w-28">Untuk</span>
                      <span className="font-medium">{memberName}</span>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-28">Role</span>
                    <span className="font-medium">{roleName}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-28">Berlaku sampai</span>
                    <span>
                      {new Date(invite!.expiresAt).toLocaleDateString("id-ID", {
                        day: "numeric", month: "long", year: "numeric",
                      })}
                    </span>
                  </div>
                </div>
              </div>

              {alreadyMember ? (
                <StatusCard
                  type="success"
                  title="Anda sudah memiliki akses"
                  message="Akun Anda sudah terdaftar di dashboard organisasi ini."
                  action={<a href={`/${slug}/dashboard`} className="text-sm text-primary underline">
                    Buka Dashboard
                  </a>}
                />
              ) : (
                <InviteAcceptClient
                  slug={slug}
                  token={token}
                  isLoggedIn={isLoggedIn}
                  loggedInName={session?.user.name ?? null}
                  loggedInEmail={session?.user.email ?? null}
                  prefillName={memberName}
                  prefillEmail={memberEmail}
                />
              )}
            </>
          )}
        </div>
      </main>

      <footer className="border-t border-border px-6 py-4 text-center text-xs text-muted-foreground">
        Dikelola oleh jalajogja · Platform super-app organisasi
      </footer>
    </div>
  );
}

// ─── Status Card ──────────────────────────────────────────────────────────────

function StatusCard({
  type,
  title,
  message,
  action,
}: {
  type:     "success" | "error";
  title:    string;
  message:  string;
  action?:  React.ReactNode;
}) {
  const colors =
    type === "success"
      ? "border-green-200 bg-green-50 text-green-800"
      : "border-red-200 bg-red-50 text-red-800";

  return (
    <div className={`rounded-lg border p-4 space-y-1 ${colors}`}>
      <p className="font-semibold text-sm">{title}</p>
      <p className="text-sm opacity-80">{message}</p>
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}
