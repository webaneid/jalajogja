import { redirect } from "next/navigation";
import { headers }  from "next/headers";
import { auth }     from "@/lib/auth";
import { db, members, createTenantDb } from "@jalajogja/db";
import { eq, and }  from "drizzle-orm";
import { resolveBaseUrl } from "@/lib/resolve-base-url";
import { MitraSettingsForm } from "./mitra-settings-form";

type Params = Promise<{ tenant: string }>;

export default async function MitraPengaturanPage({ params }: { params: Params }) {
  const { tenant: slug } = await params;

  const hdrs    = await headers();
  const baseUrl = await resolveBaseUrl(slug);
  const session = await auth.api.getSession({ headers: hdrs });
  if (!session?.user) redirect(`${baseUrl}/login?redirect=${baseUrl}/akun/mitra/pengaturan`);

  const member = await db.query.members.findFirst({
    where: eq(members.betterAuthUserId, session.user.id),
    columns: { id: true },
  });
  if (!member) redirect(`${baseUrl}/akun/mitra`);

  const { db: tdb, schema } = createTenantDb(slug);
  const [mitra] = await tdb
    .select({
      codEnabled:         schema.mitras.codEnabled,
      pickupEnabled:      schema.mitras.pickupEnabled,
      pickupLocationName: schema.mitras.pickupLocationName,
      pickupAddress:      schema.mitras.pickupAddress,
      pickupMapsUrl:      schema.mitras.pickupMapsUrl,
    })
    .from(schema.mitras)
    .where(and(eq(schema.mitras.memberId, member.id), eq(schema.mitras.status, "active")))
    .limit(1);

  if (!mitra) redirect(`${baseUrl}/akun/mitra`);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Pengaturan Toko Saya</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Atur opsi Bayar di Tempat (COD) dan Ambil Sendiri untuk produk Anda.
        </p>
      </div>
      <MitraSettingsForm
        slug={slug}
        initialSettings={{
          codEnabled:         mitra.codEnabled,
          pickupEnabled:      mitra.pickupEnabled,
          pickupLocationName: mitra.pickupLocationName ?? "",
          pickupAddress:      mitra.pickupAddress ?? "",
          pickupMapsUrl:      mitra.pickupMapsUrl ?? "",
        }}
      />
    </div>
  );
}
