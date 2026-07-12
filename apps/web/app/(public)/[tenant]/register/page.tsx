import { redirect }      from "next/navigation";
import { headers }       from "next/headers";
import { auth }          from "@/lib/auth";
import { db, tenants }   from "@jalajogja/db";
import { eq }            from "drizzle-orm";
import { RegisterForm }  from "./register-form";
import { resolveOrgLabels } from "@/lib/tenant-org-label";

type Params = Promise<{ tenant: string }>;

export default async function RegisterPage({ params }: { params: Params }) {
  const { tenant: slug } = await params;

  // Jika sudah login → langsung ke akun
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user) {
    redirect(`/${slug}/akun`);
  }

  const [tenant] = await db
    .select({
      name:           tenants.name,
      tenantType:     tenants.tenantType,
      marhalahYear:   tenants.marhalahYear,
      marhalahPeriod: tenants.marhalahPeriod,
    })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);

  const orgLabels = resolveOrgLabels({
    name:           tenant?.name ?? "IKPM Gontor",
    tenantType:     (tenant?.tenantType as "cabang" | "marhalah" | "forum") ?? "cabang",
    marhalahYear:   tenant?.marhalahYear ?? null,
    marhalahPeriod: (tenant?.marhalahPeriod as "awal" | "akhir" | null) ?? null,
  });

  return <RegisterForm slug={slug} orgLabels={orgLabels} />;
}
