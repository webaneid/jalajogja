import { pgSchema, uuid, text, timestamp } from "drizzle-orm/pg-core";

export const INVITE_ROLES = ["ketua", "sekretaris", "bendahara", "custom"] as const;
export type InviteRole = typeof INVITE_ROLES[number];

export const INVITE_DELIVERY_METHODS = ["email", "manual"] as const;
export type InviteDeliveryMethod = typeof INVITE_DELIVERY_METHODS[number];

export function createTenantInvitesTable(s: ReturnType<typeof pgSchema>) {
  return s.table("tenant_invites", {
    id:             uuid("id").primaryKey().defaultRandom(),
    // Email tujuan — dari public.contacts, atau diisi manual
    // Nullable: invite tetap bisa dibuat walau member tidak punya email (delivery_method='manual')
    email:          text("email"),
    // Wajib untuk pengurus — pengurus harus berasal dari public.members
    memberId:       uuid("member_id"),              // FK public.members via DDL
    // Role yang akan diberikan setelah accept
    role:           text("role", { enum: INVITE_ROLES }).notNull(),
    customRoleId:   uuid("custom_role_id"),         // FK custom_roles via DDL — wajib jika role='custom'
    // Token unik untuk URL invite: /{tenant}/invite?token=<uuid>
    token:          text("token").notNull().unique(),
    // 'email' = kirim otomatis (butuh SMTP), 'manual' = admin copy-paste link
    deliveryMethod: text("delivery_method", { enum: INVITE_DELIVERY_METHODS })
                      .notNull().default("manual"),
    expiresAt:      timestamp("expires_at", { withTimezone: true }).notNull(),
    // null = belum diterima; diisi saat accept — tidak dihapus (audit trail)
    acceptedAt:     timestamp("accepted_at", { withTimezone: true }),
    createdBy:      uuid("created_by"),             // FK tenant.users via DDL
    createdAt:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  });
}

export type TenantInvitesTable = ReturnType<typeof createTenantInvitesTable>;
