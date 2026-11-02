// Pembacaan data Syarat & Ketentuan Produsen (server) — docs/arsitektur-portal-produsen.md § 28.
import "server-only";
import { createHash } from "crypto";
import sanitizeHtml from "sanitize-html";
import { desc, eq } from "drizzle-orm";
import { renderBody } from "@/lib/letter-render";
import { db as publicDb, createTenantDb, producerLogins } from "@jalajogja/db";
import { listProducerOptions } from "@/lib/producer.server";
import { pgErrorCode } from "@/lib/pg-error";

type TenantDb = ReturnType<typeof createTenantDb>;

export type ActiveTerm = { id: string; version: number; title: string; body: string; publishedAt: Date };

/** Versi aktif = terbit dengan nomor terbesar. null = belum ada syarat terbit (→ tidak ada penguncian). */
export async function getActiveProducerTerm(tenantClient: TenantDb): Promise<ActiveTerm | null> {
  const { db: tdb, schema } = tenantClient;
  const [row] = await tdb.select().from(schema.producerTerms)
    .where(eq(schema.producerTerms.status, "published"))
    .orderBy(desc(schema.producerTerms.version)).limit(1);
  if (!row || row.version == null || !row.publishedAt) return null;
  return { id: row.id, version: row.version, title: row.title, body: row.body, publishedAt: row.publishedAt };
}

export type TermSignerRow = { producerId: string; name: string; isActive: boolean; signedAt: Date | null };

/** Produsen yang punya login (yang bisa menandatangani) + status tanda tangan versi aktif. */
export async function listTermSigners(tenantId: string, tenantClient: TenantDb, activeTermId: string | null): Promise<TermSignerRow[]> {
  const logins = await publicDb.select({ producerId: producerLogins.producerId })
    .from(producerLogins).where(eq(producerLogins.tenantId, tenantId));
  if (logins.length === 0) return [];
  const ids = logins.map((l) => l.producerId);

  const { db: tdb, schema } = tenantClient;
  const [options, signed] = await Promise.all([
    listProducerOptions(tenantClient),
    activeTermId
      ? tdb.select({ producerId: schema.producerTermAcceptances.producerId, signedAt: schema.producerTermAcceptances.signedAt })
          .from(schema.producerTermAcceptances)
          .where(eq(schema.producerTermAcceptances.termId, activeTermId))
      : Promise.resolve([] as { producerId: string; signedAt: Date }[]),
  ]);
  const nameOf = new Map(options.map((o) => [o.id, o]));
  const signedMap = new Map(signed.map((s) => [s.producerId, s.signedAt]));

  return ids
    .filter((id) => nameOf.has(id))   // listProducerOptions hanya memuat produsen AKTIF
    .map((id) => ({ producerId: id, name: nameOf.get(id)!.name, isActive: true, signedAt: signedMap.get(id) ?? null }))
    .sort((a, b) => a.name.localeCompare(b.name, "id"));
}

export type TermAcceptanceProof = { title: string; version: number; signedAt: Date; producerName: string };

/** Bukti publik untuk halaman verifikasi QR. Hash harus 64 hex; tabel belum ada (42P01) → null. Hanya data minimal. */
export async function findProducerTermAcceptance(slug: string, hash: string): Promise<TermAcceptanceProof | null> {
  if (!/^[0-9a-f]{64}$/.test(hash)) return null;
  try {
    const tenantClient = createTenantDb(slug);
    const { db: tdb, schema } = tenantClient;
    const [row] = await tdb.select({
        title: schema.producerTerms.title, version: schema.producerTerms.version,
        signedAt: schema.producerTermAcceptances.signedAt, producerId: schema.producerTermAcceptances.producerId,
        body: schema.producerTerms.body, bodySha256: schema.producerTermAcceptances.bodySha256,
      })
      .from(schema.producerTermAcceptances)
      .innerJoin(schema.producerTerms, eq(schema.producerTerms.id, schema.producerTermAcceptances.termId))
      .where(eq(schema.producerTermAcceptances.verificationHash, hash)).limit(1);
    if (!row || row.version == null) return null;
    // Isi syarat harus masih persis yang ditandatangani; berubah (mis. lewat SQL langsung) → TIDAK dinyatakan valid
    if (createHash("sha256").update(row.body).digest("hex") !== row.bodySha256) return null;
    // listProducerOptions hanya memuat produsen aktif; nonaktif → nama generik (tanda tangan tetap valid)
    const [opt] = await listProducerOptions(tenantClient, { onlyId: row.producerId, alsoIncludeId: row.producerId });
    return { title: row.title, version: row.version, signedAt: row.signedAt, producerName: opt?.name ?? "Produsen" };
  } catch (e) {
    if (pgErrorCode(e) === "42P01") return null;
    throw e;
  }
}

// Render isi syarat ke HTML AMAN. renderBody (renderer bersama Post/Surat) menyisipkan beberapa atribut node tanpa escape
// (color, level, url blok) dan JSON bisa dikirim langsung ke Server Action tanpa lewat editor → hasilnya WAJIB disanitasi
// dengan daftar putih ketat (tanpa iframe/script/embed). Halaman ini dibuka produsen terkunci dan pengurus owner.
export function renderProducerTermHtml(body: string, slug: string): string {
  const html = renderBody(body, { tenantSlug: slug });
  return sanitizeHtml(html, {
    allowedTags: ["p", "br", "h1", "h2", "h3", "h4", "strong", "em", "u", "s", "code", "pre", "blockquote", "ul", "ol", "li",
      "a", "span", "mark", "hr", "table", "thead", "tbody", "tr", "th", "td", "img", "div"],
    allowedAttributes: {
      a: ["href", "target", "rel"], img: ["src", "alt", "width", "height"], "*": ["style"],
    },
    allowedSchemes: ["https", "mailto", "tel"],
    allowedSchemesByTag: { img: ["https"] },
    allowProtocolRelative: false,
    allowedStyles: {
      "*": {
        color: [/^#[0-9a-f]{3,8}$/i, /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*[\d.]+\s*)?\)$/i],
        "background-color": [/^#[0-9a-f]{3,8}$/i, /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*[\d.]+\s*)?\)$/i],
        "text-align": [/^(left|right|center|justify)$/],
      },
    },
    transformTags: { a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer" }) },
  });
}
