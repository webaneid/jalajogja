import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db, tenants } from "@jalajogja/db";
import { isOwnHost } from "@/lib/is-own-host";
import Link from "next/link";
import { LayoutDashboard, Factory } from "lucide-react";
import { getCurrentSession } from "@/lib/tenant";
import { listUserContexts } from "@/lib/user-contexts.server";
import { SignOutButton } from "../no-tenant-access/sign-out-button";

// Pemilih tujuan setelah login untuk akun yang punya LEBIH DARI SATU "pintu" (mis. pengurus di tenant A dan produsen
// di tenant B). Sengaja di luar path /app/* (sama alasannya dengan /no-tenant-access — middleware mengalihkan /app/login
// yang sudah login balik ke /dashboard-redirect). Doc: docs/arsitektur-portal-produsen.md § 16.
export default async function PilihTujuanPage({
  searchParams,
}: {
  searchParams: Promise<{ ditolak?: string }>;
}) {
  const session = await getCurrentSession();
  if (!session?.user) redirect("/app/login");

  const { ditolak: rawDitolak } = await searchParams;
  // Hanya tampilkan bila berbentuk slug (teks sembarang dari URL tidak boleh tampil di halaman tepercaya ini)
  const ditolak = rawDitolak && /^[a-z0-9-]{3,20}$/.test(rawDitolak) ? rawDitolak : null;
  const contexts = await listUserContexts();
  if (contexts.length === 0) redirect("/no-tenant-access");
  if (contexts.length === 1 && !ditolak) redirect(contexts[0].href);

  // Di custom domain (mis. forbis.id) hanya /app/{slug-pemilik-domain}/* yang dilayani di host itu; tujuan di tenant LAIN
  // dibuat absolut ke jalakarta.com (middleware akan melempar ke sana juga, tapi tautan absolut lebih jelas). Sesi login
  // per-host terpisah, jadi di sana Anda mungkin diminta login lagi.
  const hdrs = await headers();
  const host = (hdrs.get("x-forwarded-host") ?? hdrs.get("host") ?? "").split(":")[0];
  let ownSlug: string | null = null;
  if (!isOwnHost(host)) {
    const [t] = await db.select({ slug: tenants.slug }).from(tenants).where(eq(tenants.customDomain, host.replace(/^www\./, ""))).limit(1);
    ownSlug = t?.slug ?? null;
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://jalakarta.com";
  const hrefFor = (c: { slug: string; href: string }) => (isOwnHost(host) || c.slug === ownSlug ? c.href : new URL(c.href, appUrl).toString());

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 shadow-sm space-y-5">
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold">Pilih Tujuan</h1>
          <p className="text-sm text-muted-foreground">
            Akun <span className="font-medium text-foreground">{session.user.email}</span> bisa masuk ke beberapa tempat.
          </p>
        </div>
        {ditolak && (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Akun ini tidak punya akses di <b>{ditolak}</b>. Pilih tujuan lain di bawah.
          </p>
        )}
        <ul className="space-y-2">
          {contexts.map((c) => (
            <li key={`${c.kind}:${c.slug}`}>
              <Link href={hrefFor(c)} className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted transition-colors">
                {c.kind === "pengurus" ? <LayoutDashboard className="h-5 w-5 text-muted-foreground" /> : <Factory className="h-5 w-5 text-muted-foreground" />}
                <span className="min-w-0">
                  <span className="block truncate font-medium">{c.name}</span>
                  <span className="block text-xs text-muted-foreground">{c.kind === "pengurus" ? "Dashboard Pengurus" : "Portal Produsen"}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="text-center"><SignOutButton /></div>
      </div>
    </div>
  );
}
