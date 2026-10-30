// Shell Portal Produsen — pintu terpisah dari dashboard pengurus (grup rute (producer), BUKAN (dashboard)).
// Produsen = status pada akun (public.producer_logins), bukan baris tenant.users. Doc: docs/arsitektur-portal-produsen.md.
// Guard di sini hanya untuk shell — SETIAP page tetap memanggil getProducerAccess sendiri (layout, page, dan
// generateMetadata dirender paralel; guard layout tidak melindungi page). Portal TIDAK punya Server Action.
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { Package } from "lucide-react";
import { getCurrentSession } from "@/lib/tenant";
import { getProducerAccess } from "@/lib/producer-access.server";
import { UserMenu } from "@/components/dashboard/user-menu";

export const metadata: Metadata = { title: "Portal Produsen", robots: { index: false, follow: false } };

export default async function ProducerPortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;

  const session = await getCurrentSession();
  if (!session?.user) redirect(`/app/login?redirect=/app/${slug}/portal-produsen`);

  const access = await getProducerAccess(slug);
  // Bukan /dashboard-redirect: halaman itu bisa mengarahkan balik ke sini → loop. /no-tenant-access aman (di luar /app/*).
  if (!access) redirect("/no-tenant-access");

  const base = `/app/${slug}/portal-produsen`;
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{access.tenant.name}</p>
            <p className="truncate text-xs text-muted-foreground">Portal Produsen · {access.producer.displayName}</p>
          </div>
          <UserMenu name={session.user.name} email={session.user.email} role="Produsen" />
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 px-4 pb-2">
          <Link href={`${base}/produk`} className="inline-flex items-center gap-2 rounded-md bg-muted px-3 py-1.5 text-sm font-medium">
            <Package className="h-4 w-4" /> Produk
          </Link>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl p-4 md:p-6">{children}</main>
    </div>
  );
}
