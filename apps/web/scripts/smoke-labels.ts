// Alat dev: uji buildLabelData + PDF terhadap DB lokal. bun run scripts/smoke-labels.ts <slug> <folder>
import { createTenantDb, db, tenants } from "@jalajogja/db";
import { eq } from "drizzle-orm";
import { writeFileSync } from "node:fs";
import { buildLabelData } from "../lib/shipping-label/build.server";
import { renderLabelsPdf } from "../lib/shipping-label/pdf.server";

const [slug, out] = process.argv.slice(2);
const [t] = await db.select().from(tenants).where(eq(tenants.slug, slug)).limit(1);
if (!t) { console.log("tenant tidak ada"); process.exit(1); }
const tc = createTenantDb(slug);
const { db: tdb, schema } = tc;
const lines = await tdb.select({ invoiceId: schema.invoiceShippingLines.invoiceId, status: schema.invoiceShippingLines.status, method: schema.invoiceShippingLines.deliveryMethod })
  .from(schema.invoiceShippingLines).where(eq(schema.invoiceShippingLines.sellerType, "tenant")).limit(50);
const paid = await tdb.select({ id: schema.invoices.id }).from(schema.invoices).where(eq(schema.invoices.status, "paid")).limit(200);
const paidSet = new Set(paid.map((p) => p.id));
const ids = lines.filter((l) => paidSet.has(l.invoiceId) && l.method === "courier").map((l) => l.invoiceId).slice(0, 4);
console.log("kandidat:", ids.length);
if (ids.length === 0) process.exit(0);
const r = await buildLabelData(tc, { id: t.id, name: t.name, tenantType: t.tenantType, slug }, ids, { kind: "admin" });
if (!r.ok) { console.log("GAGAL:", r.error); process.exit(0); }
console.log(JSON.stringify(r.labels[0], (k, v) => (typeof v === "string" && v.startsWith("data:") ? "[data-uri]" : v), 2));
writeFileSync(`${out}/smoke-a4-4.pdf`, await renderLabelsPdf(r.labels, "a4-4"));
console.log("PDF ok");
process.exit(0);
