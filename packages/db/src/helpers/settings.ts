import { eq, and } from "drizzle-orm";
import type { TenantDb } from "../tenant-client";
import type { SettingGroup } from "../schema/tenant/settings";

// ─── Settings Helper ──────────────────────────────────────────────────────────
// Wrapper tipis untuk read/write ke tenant_{slug}.settings
// Semua value disimpan sebagai JSONB — helper ini handle serialize/deserialize

// Ambil semua settings dalam satu group → { key: value, ... }
export async function getSettings(
  { db, schema }: TenantDb,
  group: SettingGroup
): Promise<Record<string, unknown>> {
  const rows = await db
    .select({ key: schema.settings.key, value: schema.settings.value })
    .from(schema.settings)
    .where(eq(schema.settings.group, group));

  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

// Ambil satu setting berdasarkan key + group
export async function getSetting<T = unknown>(
  { db, schema }: TenantDb,
  key: string,
  group: SettingGroup
): Promise<T | null> {
  const [row] = await db
    .select({ value: schema.settings.value })
    .from(schema.settings)
    .where(
      and(
        eq(schema.settings.key, key),
        eq(schema.settings.group, group)
      )
    )
    .limit(1);

  return row ? (row.value as T) : null;
}

// Insert atau update satu setting (upsert by key + group)
export async function upsertSetting(
  { db, schema }: TenantDb,
  key: string,
  group: SettingGroup,
  value: unknown
): Promise<void> {
  await db
    .insert(schema.settings)
    .values({ key, group, value })
    .onConflictDoUpdate({
      target: [schema.settings.key, schema.settings.group],
      set: {
        value,
        updatedAt: new Date(),
      },
    });
}

// Upsert banyak key sekaligus dalam satu group (untuk save form satu section)
export async function upsertSettings(
  tenantDb: TenantDb,
  group: SettingGroup,
  entries: Record<string, unknown>
): Promise<void> {
  await Promise.all(
    Object.entries(entries).map(([key, value]) =>
      upsertSetting(tenantDb, key, group, value)
    )
  );
}
