import { createHash } from "crypto";
import { sql }        from "drizzle-orm";
import type { TenantDb } from "@jalajogja/db";

export type ContentType = "post" | "page" | "event" | "product" | "campaign";

const CONTENT_TABLE: Record<ContentType, string> = {
  post:     "posts",
  page:     "pages",
  event:    "events",
  product:  "products",
  campaign: "campaigns",
};

const VIEW_WINDOW_MINUTES = 5;

export function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex");
}

/**
 * Catat satu kunjungan. Return true jika view dihitung, false jika dalam window.
 * Fire-and-forget friendly — tidak throw, error ditelan dengan log.
 */
export async function recordView(
  tenantClient: TenantDb,
  opts: {
    slug:   string;
    type:   ContentType;
    id:     string;
    ipHash: string;
  },
): Promise<boolean> {
  const { db } = tenantClient;
  const { slug, type, id, ipHash } = opts;

  const s         = `tenant_${slug}`;
  const sessTable = sql.raw(`"${s}".content_view_sessions`);
  const contTable = sql.raw(`"${s}".${CONTENT_TABLE[type]}`);
  const interval  = sql.raw(`INTERVAL '${VIEW_WINDOW_MINUTES} minutes'`);

  try {
    const result = await db.execute(sql`
      INSERT INTO ${sessTable} (content_type, content_id, ip_hash, viewed_at)
      VALUES (${type}, ${id}::uuid, ${ipHash}, NOW())
      ON CONFLICT (content_type, content_id, ip_hash) DO UPDATE
        SET viewed_at = NOW()
        WHERE ${sessTable}.viewed_at < NOW() - ${interval}
    `);

    // postgres.js driver pakai .count (bukan .rowCount seperti node-postgres)
    const counted = ((result as unknown as { count: number }).count ?? 0) > 0;

    if (counted) {
      await db.execute(sql`
        UPDATE ${contTable}
        SET view_count = view_count + 1
        WHERE id = ${id}::uuid
      `);
    }

    return counted;
  } catch (err) {
    console.error("[view-counter] error:", err);
    return false;
  }
}
