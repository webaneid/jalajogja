import { NextResponse } from "next/server";
import { createTenantDb, getSettings } from "@jalajogja/db";
import { isActiveTenant } from "@/lib/tenant-active";
import { resolveBaseUrl } from "@/lib/resolve-base-url";
import { resolveIconSourcePath } from "@/lib/tenant-icon.server";

// Web App Manifest per tenant (Android "Tambahkan ke layar utama"/PWA) — docs/arsitektur-favicon.md § 3.4.
// Di custom domain, middleware me-rewrite /manifest.webmanifest → /{slug}/manifest.webmanifest.
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const { tenant: slug } = await params;
  if (!(await isActiveTenant(slug))) return new NextResponse("Not Found", { status: 404 });

  const baseUrl = await resolveBaseUrl(slug);
  const client  = createTenantDb(slug);
  const [general, display, iconPath] = await Promise.all([
    getSettings(client, "general"),
    getSettings(client, "display"),
    resolveIconSourcePath(slug),
  ]);

  const name     = (general.site_name as string | undefined)?.trim() || slug;
  const tagline  = (general.tagline as string | undefined)?.trim();
  const primary  = display.primary_color as string | undefined;
  const startUrl = `${baseUrl}/`;

  const icons = iconPath
    ? [
        { src: `${baseUrl}/tenant-icon/192`, sizes: "192x192", type: "image/png", purpose: "any" },
        { src: `${baseUrl}/tenant-icon/512`, sizes: "512x512", type: "image/png", purpose: "any" },
      ]
    : [
        { src: "/icon.svg", type: "image/svg+xml", sizes: "any" },
        { src: "/apple-icon.png", type: "image/png", sizes: "180x180" },
      ];

  const manifest = {
    name,
    short_name: name.length > 12 ? name.slice(0, 12).trim() : name,
    ...(tagline ? { description: tagline } : {}),
    start_url: startUrl,
    scope: startUrl,
    display: "standalone",
    background_color: "#ffffff",
    theme_color: primary && COLOR_RE.test(primary) ? primary : "#2563eb",
    icons,
  };

  return new NextResponse(JSON.stringify(manifest), {
    headers: {
      "Content-Type":  "application/manifest+json",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
