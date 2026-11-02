// Halaman Syarat & Ketentuan Produsen di portal — satu-satunya halaman yang terbuka sebelum syarat ditandatangani.
// Memakai getProducerAccessUngated (bukan getProducerPageAccess, yang akan mengalihkan ke sini → loop).
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { createTenantDb } from "@jalajogja/db";
import { getProducerAccessUngated } from "@/lib/producer-access.server";
import { getActiveProducerTerm, renderProducerTermHtml } from "@/lib/producer-terms.server";
import { generateQrDataUrl, buildVerifyUrl } from "@/lib/qr-code";
import { ProducerTermSign } from "@/components/producer/producer-term-sign";

export default async function ProducerTermsPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const access = await getProducerAccessUngated(slug);
  if (!access) redirect("/no-tenant-access");

  const tenantClient = createTenantDb(access.tenant.slug);
  const active = await getActiveProducerTerm(tenantClient);

  if (!active) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Belum ada syarat &amp; ketentuan produsen yang berlaku.
      </div>
    );
  }

  const { db: tdb, schema } = tenantClient;
  const [acc] = await tdb.select({ signedAt: schema.producerTermAcceptances.signedAt, hash: schema.producerTermAcceptances.verificationHash })
    .from(schema.producerTermAcceptances)
    .where(and(eq(schema.producerTermAcceptances.termId, active.id), eq(schema.producerTermAcceptances.producerId, access.producer.id)))
    .limit(1);

  const verifyUrl = acc ? buildVerifyUrl(access.tenant.slug, acc.hash) : null;
  const qrDataUrl = verifyUrl ? await generateQrDataUrl(verifyUrl) : null;

  return (
    <div className="mx-auto max-w-2xl">
      <ProducerTermSign
        slug={access.tenant.slug}
        termId={active.id}
        version={active.version}
        title={active.title}
        publishedAt={active.publishedAt.toISOString()}
        html={renderProducerTermHtml(active.body, access.tenant.slug)}
        producerName={access.producer.displayName}
        signed={acc ? { signedAt: acc.signedAt.toISOString(), hash: acc.hash, verifyUrl: verifyUrl!, qrDataUrl: qrDataUrl! } : null}
      />
    </div>
  );
}
