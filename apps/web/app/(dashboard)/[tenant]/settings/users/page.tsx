import { redirect } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import { createTenantDb, db, members, tenantMemberships, user as authUser, contacts } from "@jalajogja/db";
// contacts dipakai untuk fetch email anggota yang tersedia
import { getTenantAccess } from "@/lib/tenant";
import { canManageUsers } from "@/lib/permissions";
import { UsersManageClient } from "@/components/settings/users-manage-client";

export default async function SettingsUsersPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;

  const access = await getTenantAccess(slug);
  if (!access) redirect("/dashboard-redirect");

  // Hanya owner/ketua yang bisa akses halaman ini
  if (!canManageUsers(access.tenantUser)) {
    redirect(`/${slug}/settings/general`);
  }

  const { db: tenantDb, schema } = createTenantDb(slug);

  // ── Fetch users aktif ──────────────────────────────────────────────────────
  const tenantUsers = await tenantDb
    .select({
      id:             schema.users.id,
      betterAuthUserId: schema.users.betterAuthUserId,
      role:           schema.users.role,
      memberId:       schema.users.memberId,
      customRoleId:   schema.users.customRoleId,
      createdAt:      schema.users.createdAt,
    })
    .from(schema.users)
    .orderBy(schema.users.createdAt);

  // Fetch nama dari Better Auth user
  const betterAuthIds = tenantUsers.map((u) => u.betterAuthUserId);
  const authUsers = betterAuthIds.length > 0
    ? await db
        .select({ id: authUser.id, name: authUser.name, email: authUser.email })
        .from(authUser)
        .where(inArray(authUser.id, betterAuthIds))
    : [];

  const authUserMap = new Map(authUsers.map((u) => [u.id, u]));

  // Fetch nama member
  const memberIds = tenantUsers.map((u) => u.memberId).filter(Boolean) as string[];
  const memberList = memberIds.length > 0
    ? await db
        .select({ id: members.id, name: members.name })
        .from(members)
        .where(inArray(members.id, memberIds))
    : [];
  const memberMap = new Map(memberList.map((m) => [m.id, m]));

  // Fetch nama custom roles
  const customRoles = await tenantDb
    .select({ id: schema.customRoles.id, name: schema.customRoles.name })
    .from(schema.customRoles)
    .orderBy(schema.customRoles.name);

  const customRoleMap = new Map(customRoles.map((r) => [r.id, r.name]));

  const userRows = tenantUsers.map((u) => ({
    id:           u.id,
    name:         memberMap.get(u.memberId ?? "")?.name
                    ?? authUserMap.get(u.betterAuthUserId)?.name
                    ?? "—",
    email:        authUserMap.get(u.betterAuthUserId)?.email ?? null,
    role:         u.role,
    customRoleName: u.customRoleId ? (customRoleMap.get(u.customRoleId) ?? null) : null,
    memberId:     u.memberId,
    isCurrentUser: u.id === access.tenantUser.id,
    createdAt:    u.createdAt.toISOString(),
  }));

  // ── Fetch pending invites ──────────────────────────────────────────────────
  const inviteRows = await tenantDb
    .select()
    .from(schema.tenantInvites)
    .orderBy(schema.tenantInvites.createdAt);

  // Fetch nama member untuk invites
  const inviteMemberIds = inviteRows.map((i) => i.memberId).filter(Boolean) as string[];
  const inviteMembers = inviteMemberIds.length > 0
    ? await db
        .select({ id: members.id, name: members.name })
        .from(members)
        .where(inArray(members.id, inviteMemberIds))
    : [];
  const inviteMemberMap = new Map(inviteMembers.map((m) => [m.id, m.name]));

  const invites = inviteRows.map((i) => ({
    id:            i.id,
    memberName:    i.memberId ? (inviteMemberMap.get(i.memberId) ?? "—") : "—",
    email:         i.email,
    role:          i.role,
    customRoleName: i.customRoleId ? (customRoleMap.get(i.customRoleId) ?? null) : null,
    token:         i.token,
    expiresAt:     i.expiresAt.toISOString(),
    acceptedAt:    i.acceptedAt?.toISOString() ?? null,
    deliveryMethod: i.deliveryMethod,
  }));

  // ── Fetch anggota yang bisa diundang (belum jadi user, belum punya invite pending) ──
  const existingMemberIds = new Set([
    ...tenantUsers.map((u) => u.memberId).filter(Boolean) as string[],
    ...inviteRows
      .filter((i) => !i.acceptedAt && new Date(i.expiresAt) > new Date())
      .map((i) => i.memberId)
      .filter(Boolean) as string[],
  ]);

  const memberships = await db
    .select({ memberId: tenantMemberships.memberId })
    .from(tenantMemberships)
    .where(eq(tenantMemberships.tenantId, access.tenant.id));

  const allMemberIds = memberships.map((m) => m.memberId);
  const availableMemberIds = allMemberIds.filter((id) => !existingMemberIds.has(id));

  const availableMembersRaw = availableMemberIds.length > 0
    ? await db
        .select({
          id:           members.id,
          name:         members.name,
          memberNumber: members.memberNumber,
          contactId:    members.contactId,
        })
        .from(members)
        .where(inArray(members.id, availableMemberIds))
        .orderBy(members.name)
    : [];

  // Fetch email dari contacts untuk setiap member yang punya contactId
  const contactIds = availableMembersRaw
    .map((m) => m.contactId)
    .filter(Boolean) as string[];

  const contactEmailMap = new Map<string, string | null>();
  if (contactIds.length > 0) {
    const contactRows = await db
      .select({ id: contacts.id, email: contacts.email })
      .from(contacts)
      .where(inArray(contacts.id, contactIds));
    for (const c of contactRows) contactEmailMap.set(c.id, c.email);
  }

  const availableMembers = availableMembersRaw.map((m) => ({
    id:           m.id,
    name:         m.name,
    memberNumber: m.memberNumber,
    email:        m.contactId ? (contactEmailMap.get(m.contactId) ?? null) : null,
  }));

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Pengguna Dashboard</h2>
        <p className="text-sm text-muted-foreground">
          Kelola siapa yang punya akses ke dashboard organisasi ini.
        </p>
      </div>

      <UsersManageClient
        slug={slug}
        currentUserId={access.tenantUser.id}
        users={userRows}
        invites={invites}
        availableMembers={availableMembers}
        customRoles={customRoles}
        appUrl={appUrl}
      />
    </div>
  );
}
