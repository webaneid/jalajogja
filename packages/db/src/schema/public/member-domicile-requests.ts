import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { members } from "./members";
import { tenants } from "./tenants";

// Workflow pindah cabang — diproses oleh admin cabang tujuan
//
// Flow:
//   1. Anggota submit request (status = pending)
//   2. Admin to_tenant review → approve atau reject
//   3. Jika approved:
//      - members.domicile_tenant_id diupdate ke to_tenant_id
//      - status diset "approved", resolvedAt diisi
//
// onDelete: "restrict" di tenant FK — tenant tidak bisa dihapus
// jika masih ada request pending (harus diselesaikan dulu)
export const memberDomicileRequests = pgTable("member_domicile_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  memberId: uuid("member_id").notNull()
    .references(() => members.id, { onDelete: "cascade" }),
  fromTenantId: uuid("from_tenant_id").notNull()
    .references(() => tenants.id, { onDelete: "restrict" }),
  toTenantId: uuid("to_tenant_id").notNull()
    .references(() => tenants.id, { onDelete: "restrict" }),

  status: text("status", {
    enum: ["pending", "approved", "rejected"],
  }).notNull().default("pending"),

  note: text("note"),             // Alasan pindah — diisi oleh anggota
  adminNote: text("admin_note"),  // Catatan admin saat approve/reject

  // Better Auth user ID (text/nanoid, bukan UUID)
  // Tidak dibuat FK constraint untuk hindari coupling ke auth schema
  // Validasi dilakukan di application layer
  resolvedBy: text("resolved_by"),

  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt:  timestamp("resolved_at", { withTimezone: true }),
}, (t) => ({
  memberIdIdx: index("idx_domicile_requests_member_id").on(t.memberId),
  statusIdx:   index("idx_domicile_requests_status").on(t.status),
  toTenantIdx: index("idx_domicile_requests_to_tenant_id").on(t.toTenantId),
}));

export type MemberDomicileRequest = typeof memberDomicileRequests.$inferSelect;
export type NewMemberDomicileRequest = typeof memberDomicileRequests.$inferInsert;
