// POST /api/events/[id]/certificate/[regId]?slug={slug}
// Generate sertifikat kehadiran event via Playwright → upload MinIO → update certificate_url

import { NextRequest, NextResponse } from "next/server";
import { createTenantDb, db, getSettings, tenants } from "@jalajogja/db";
import { eq } from "drizzle-orm";
import { chromium } from "playwright";
import { getTenantAccess } from "@/lib/tenant";
import { uploadFile, publicUrl, buildPath, ensureBucket } from "@/lib/minio";

// ─── HTML Builder sertifikat ──────────────────────────────────────────────────

function buildCertificateHtml({
  orgName,
  orgLogo,
  eventTitle,
  eventDate,
  eventLocation,
  attendeeName,
  ticketName,
  registrationNumber,
}: {
  orgName:            string;
  orgLogo:            string | null;
  eventTitle:         string;
  eventDate:          string;
  eventLocation:      string;
  attendeeName:       string;
  ticketName:         string;
  registrationNumber: string;
}): string {
  const logoHtml = orgLogo
    ? `<img src="${orgLogo}" alt="${orgName}" style="height:60px; object-fit:contain; display:block; margin:0 auto 12px;" />`
    : "";

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8" />
<style>
  @page { size: A4 landscape; margin: 0; }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: "Georgia", serif;
    background: #fff;
    color: #1a1a2e;
    width: 297mm;
    height: 210mm;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .cert {
    width: 100%;
    height: 100%;
    border: 8px solid #1a1a2e;
    outline: 2px solid #1a1a2e;
    outline-offset: -14px;
    padding: 36px 56px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    position: relative;
    background: #fffef9;
  }

  .corner {
    position: absolute;
    width: 40px;
    height: 40px;
    border-color: #c8a84b;
    border-style: solid;
  }
  .corner-tl { top: 16px; left: 16px; border-width: 3px 0 0 3px; }
  .corner-tr { top: 16px; right: 16px; border-width: 3px 3px 0 0; }
  .corner-bl { bottom: 16px; left: 16px; border-width: 0 0 3px 3px; }
  .corner-br { bottom: 16px; right: 16px; border-width: 0 3px 3px 0; }

  .org-name {
    font-size: 14px;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: #555;
    margin-bottom: 4px;
  }

  .cert-title {
    font-size: 40px;
    font-weight: bold;
    letter-spacing: 4px;
    text-transform: uppercase;
    color: #c8a84b;
    margin: 8px 0;
    line-height: 1.1;
  }

  .cert-subtitle {
    font-size: 13px;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: #888;
    margin-bottom: 20px;
  }

  .divider {
    width: 120px;
    height: 2px;
    background: #c8a84b;
    margin: 0 auto 20px;
  }

  .presented-to {
    font-size: 14px;
    color: #666;
    margin-bottom: 6px;
    font-style: italic;
  }

  .attendee-name {
    font-size: 34px;
    font-weight: bold;
    color: #1a1a2e;
    margin-bottom: 6px;
    line-height: 1.2;
  }

  .ticket-label {
    font-size: 12px;
    color: #888;
    letter-spacing: 1px;
    margin-bottom: 20px;
  }

  .event-info {
    font-size: 13px;
    color: #444;
    line-height: 1.8;
    margin-bottom: 20px;
  }

  .event-title-cert {
    font-size: 16px;
    font-weight: bold;
    color: #1a1a2e;
  }

  .reg-number {
    font-size: 10px;
    color: #aaa;
    font-family: monospace;
    letter-spacing: 1px;
    margin-top: 12px;
  }
</style>
</head>
<body>
<div class="cert">
  <div class="corner corner-tl"></div>
  <div class="corner corner-tr"></div>
  <div class="corner corner-bl"></div>
  <div class="corner corner-br"></div>

  ${logoHtml}
  <p class="org-name">${orgName}</p>
  <h1 class="cert-title">Sertifikat</h1>
  <p class="cert-subtitle">Kehadiran</p>
  <div class="divider"></div>

  <p class="presented-to">Diberikan kepada</p>
  <p class="attendee-name">${attendeeName}</p>
  ${ticketName ? `<p class="ticket-label">${ticketName}</p>` : ""}

  <div class="event-info">
    atas kehadiran dan partisipasi dalam<br />
    <span class="event-title-cert">${eventTitle}</span><br />
    ${eventDate}${eventLocation ? ` &mdash; ${eventLocation}` : ""}
  </div>

  <p class="reg-number">No. ${registrationNumber}</p>
</div>
</body>
</html>`;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; regId: string }> }
) {
  const { id: eventId, regId: registrationId } = await params;
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");

  if (!slug) {
    return NextResponse.json({ error: "slug diperlukan" }, { status: 400 });
  }

  const access = await getTenantAccess(slug);
  if (!access) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantClient             = createTenantDb(slug);
  const { db: tenantDb, schema } = tenantClient;

  // Fetch registrasi + tiket + event sekaligus
  const [reg] = await tenantDb
    .select()
    .from(schema.eventRegistrations)
    .where(eq(schema.eventRegistrations.id, registrationId))
    .limit(1);

  if (!reg) {
    return NextResponse.json({ error: "Registrasi tidak ditemukan" }, { status: 404 });
  }

  if (reg.status !== "attended") {
    return NextResponse.json({ error: "Sertifikat hanya bisa dibuat untuk peserta yang sudah hadir (check-in)" }, { status: 400 });
  }

  const [event] = await tenantDb
    .select({ id: schema.events.id, title: schema.events.title, startsAt: schema.events.startsAt, location: schema.events.location })
    .from(schema.events)
    .where(eq(schema.events.id, eventId))
    .limit(1);

  if (!event) {
    return NextResponse.json({ error: "Event tidak ditemukan" }, { status: 404 });
  }

  const [ticket] = reg.ticketId
    ? await tenantDb
        .select({ name: schema.eventTickets.name })
        .from(schema.eventTickets)
        .where(eq(schema.eventTickets.id, reg.ticketId))
        .limit(1)
    : [];

  // Fetch org info
  const [tenantRow] = await db
    .select({ name: tenants.name })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);

  const generalSettings = await getSettings(tenantClient, "general");
  const orgName   = (generalSettings["site_name"] as string | undefined) ?? tenantRow?.name ?? "";
  const orgLogo   = (generalSettings["logo_url"]  as string | undefined) ?? null;

  // Format tanggal event
  const eventDate = event.startsAt
    ? new Intl.DateTimeFormat("id-ID", {
        day: "numeric", month: "long", year: "numeric",
      }).format(new Date(event.startsAt))
    : "";

  const html = buildCertificateHtml({
    orgName,
    orgLogo,
    eventTitle:         event.title,
    eventDate,
    eventLocation:      event.location ?? "",
    attendeeName:       reg.attendeeName,
    ticketName:         ticket?.name ?? "",
    registrationNumber: reg.registrationNumber,
  });

  // Playwright → PDF
  let pdfBuffer: Buffer;
  let browser;
  try {
    browser = await chromium.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    const rawPdf = await page.pdf({
      width:  "297mm",
      height: "210mm",
      printBackground: true,
    });
    pdfBuffer = Buffer.from(rawPdf);
  } finally {
    await browser?.close();
  }

  // Upload ke MinIO
  await ensureBucket(slug);
  const safeName = reg.attendeeName.replace(/[^a-zA-Z0-9-_]/g, "_").substring(0, 30);
  const filename = `sertifikat_${safeName}_${Date.now()}.pdf`;
  const path     = buildPath("events", filename);

  await uploadFile(slug, path, pdfBuffer, "application/pdf");
  const certUrl = publicUrl(slug, path);

  // Update certificate_url di DB
  await tenantDb
    .update(schema.eventRegistrations)
    .set({ certificateUrl: certUrl, certificateSentAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.eventRegistrations.id, registrationId));

  return NextResponse.json({ success: true, certificateUrl: certUrl }, { status: 200 });
}
