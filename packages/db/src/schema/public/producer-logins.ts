import { pgTable, uuid, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { user } from "./auth";

// ─── Status "produsen" pada akun (Portal Produsen) ───────────────────────────────────────────────
// Produsen = STATUS pada akun anggota, BUKAN role di tenant_{slug}.users — sengaja: getTenantAccess()
// untuk akun ini tetap null sehingga seluruh rute admin yang ada otomatis menolak (fail-closed).
// Doc: docs/arsitektur-portal-produsen.md § 3.
//
//  - UNIQUE(user_id): satu akun hanya bisa jadi produsen di SATU tenant. Harus di tabel public — tabel
//    tenant terpisah per schema sehingga aturan lintas-tenant tidak bisa ditegakkan di sana.
//  - UNIQUE(tenant_id, producer_id): satu produsen = satu akun (produsen anggota = satu pemilik).
//  - producer_id merujuk tenant_{slug}.producers.id — FK lintas-schema tidak bisa dibuat; baris ini
//    DIHAPUS oleh aplikasi saat produsen dihapus (deleteProducerAction), dan portal memeriksa
//    keberadaan + is_active produsen pada setiap request.
export const producerLogins = pgTable("producer_logins", {
  id:         uuid("id").primaryKey().defaultRandom(),
  userId:     text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  tenantId:   uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  producerId: uuid("producer_id").notNull(),
  grantedBy:  uuid("granted_by"),                 // tenant_{slug}.users.id admin pemberi akses (jejak audit)
  grantedAt:  timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userUniq:     uniqueIndex("producer_logins_user_uniq").on(t.userId),
  producerUniq: uniqueIndex("producer_logins_producer_uniq").on(t.tenantId, t.producerId),
  tenantIdx:    index("producer_logins_tenant_idx").on(t.tenantId),
}));

export type ProducerLogin    = typeof producerLogins.$inferSelect;
export type NewProducerLogin = typeof producerLogins.$inferInsert;
