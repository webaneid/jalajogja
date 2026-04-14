// POST /api/letters/[id]/generate-pdf?slug={slug}
// Generate PDF surat via Playwright → upload MinIO → update letters.pdf_url

import { NextRequest, NextResponse } from "next/server";
import { createTenantDb, db, members, tenants } from "@jalajogja/db";
import { eq, inArray } from "drizzle-orm";
import { chromium } from "playwright";
import { getTenantAccess } from "@/lib/tenant";
import { buildLetterHtml, paperFormat } from "@/lib/letter-html";
import { uploadFile, publicUrl, buildPath, ensureBucket } from "@/lib/minio";
import { getSettings } from "@jalajogja/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: letterId } = await params;
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");

  if (!slug) {
    return NextResponse.json({ error: "slug diperlukan" }, { status: 400 });
  }

  // Auth check
  const access = await getTenantAccess(slug);
  if (!access) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantClient            = createTenantDb(slug);
  const { db: tenantDb, schema } = tenantClient;

  // Fetch surat
  const [letter] = await tenantDb
    .select()
    .from(schema.letters)
    .where(eq(schema.letters.id, letterId))
    .limit(1);

  if (!letter) {
    return NextResponse.json({ error: "Surat tidak ditemukan" }, { status: 404 });
  }

  // Fetch template kop surat (opsional)
  let template = {
    bodyFont:     "Times New Roman",
    marginTop:    20,
    marginRight:  20,
    marginBottom: 20,
    marginLeft:   25,
    headerImageUrl: null as string | null,
    footerImageUrl: null as string | null,
    paperSize: (letter.paperSize ?? "A4") as "A4" | "F4" | "Letter",
  };

  if (letter.templateId) {
    const [tmpl] = await tenantDb
      .select()
      .from(schema.letterTemplates)
      .where(eq(schema.letterTemplates.id, letter.templateId))
      .limit(1);

    if (tmpl) {
      // Fetch URL gambar header/footer dari tabel media
      const mediaIds = [tmpl.headerImageId, tmpl.footerImageId].filter((x): x is string => !!x);
      const mediaMap = new Map<string, string>();
      if (mediaIds.length > 0) {
        const mediaRows = await tenantDb
          .select({ id: schema.media.id, path: schema.media.path })
          .from(schema.media)
          .where(inArray(schema.media.id, mediaIds));
        mediaRows.forEach((m) => mediaMap.set(m.id, publicUrl(slug, m.path)));
      }

      template = {
        bodyFont:      tmpl.bodyFont,
        marginTop:     tmpl.marginTop,
        marginRight:   tmpl.marginRight,
        marginBottom:  tmpl.marginBottom,
        marginLeft:    tmpl.marginLeft,
        headerImageUrl: tmpl.headerImageId ? (mediaMap.get(tmpl.headerImageId) ?? null) : null,
        footerImageUrl: tmpl.footerImageId ? (mediaMap.get(tmpl.footerImageId) ?? null) : null,
        paperSize: (tmpl.paperSize ?? "A4") as "A4" | "F4" | "Letter",
      };
    }
  }

  // Fetch settings org (nama, alamat, telepon, email)
  const orgSettings     = await getSettings(tenantClient, "contact");
  const generalSettings = await getSettings(tenantClient, "general");

  // Ambil nama tenant dari public.tenants sebagai fallback
  const [tenantRow] = await db
    .select({ name: tenants.name })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);

  const orgName    = (generalSettings["site_name"] as string | undefined)    ?? tenantRow?.name ?? "";
  const orgAddress = (orgSettings["contact_address"] as { detail?: string } | undefined)?.detail ?? "";
  const orgPhone   = (orgSettings["contact_phone"] as string | undefined)    ?? "";
  const orgEmail   = (orgSettings["contact_email"] as string | undefined)    ?? "";

  // Fetch signatures + signer info
  const rawSigs = await tenantDb
    .select()
    .from(schema.letterSignatures)
    .where(eq(schema.letterSignatures.letterId, letterId));

  let signers: Array<{
    name: string; position: string; division: string | null;
    role: string; signedAt: Date; verificationHash: string; slug: string;
  }> = [];

  if (rawSigs.length > 0) {
    // Fetch officers
    const officerIds = rawSigs.map((s) => s.officerId);
    const officers = await tenantDb
      .select({
        id:         schema.officers.id,
        memberId:   schema.officers.memberId,
        position:   schema.officers.position,
        divisionId: schema.officers.divisionId,
      })
      .from(schema.officers)
      .where(inArray(schema.officers.id, officerIds));

    const memberIds = officers.map((o) => o.memberId);
    const memberRows = memberIds.length > 0
      ? await db.select({ id: members.id, name: members.name }).from(members).where(inArray(members.id, memberIds))
      : [];
    const memberMap = new Map(memberRows.map((m) => [m.id, m.name]));

    const divisionIds = officers.map((o) => o.divisionId).filter((x): x is string => !!x);
    const divisionRows = divisionIds.length > 0
      ? await tenantDb.select({ id: schema.divisions.id, name: schema.divisions.name })
          .from(schema.divisions).where(inArray(schema.divisions.id, divisionIds))
      : [];
    const divisionMap = new Map(divisionRows.map((d) => [d.id, d.name]));

    signers = rawSigs.map((s) => {
      const off = officers.find((o) => o.id === s.officerId);
      return {
        name:             off ? (memberMap.get(off.memberId) ?? "—") : "—",
        position:         off?.position ?? "—",
        division:         off?.divisionId ? (divisionMap.get(off.divisionId) ?? null) : null,
        role:             s.role,
        signedAt:         s.signedAt,
        verificationHash: s.verificationHash,
        slug,
      };
    });
  }

  // Build HTML
  const html = await buildLetterHtml({
    letterNumber: letter.letterNumber ?? null,
    letterDate:   letter.letterDate,
    subject:      letter.subject,
    sender:       letter.sender,
    recipient:    letter.recipient,
    body:         letter.body,
    template,
    signers,
    orgName,
    orgAddress,
    orgPhone,
    orgEmail,
  });

  // Playwright → PDF
  let pdfBuffer: Buffer;
  let browser;
  try {
    browser = await chromium.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    const format = paperFormat(template.paperSize);
    const rawPdf = await page.pdf({
      ...format,
      printBackground: true,
      margin: {
        top:    `${template.marginTop}mm`,
        right:  `${template.marginRight}mm`,
        bottom: `${template.marginBottom}mm`,
        left:   `${template.marginLeft}mm`,
      },
    });
    pdfBuffer = Buffer.from(rawPdf);
  } finally {
    await browser?.close();
  }

  // Upload ke MinIO
  await ensureBucket(slug);
  const safeSubject = letter.subject.replace(/[^a-zA-Z0-9-_]/g, "_").substring(0, 40);
  const filename    = `surat_${safeSubject}_${Date.now()}.pdf`;
  const path        = buildPath("letters", filename);

  await uploadFile(slug, path, pdfBuffer, "application/pdf");
  const pdfUrl = publicUrl(slug, path);

  // Update letters.pdf_url di DB
  await tenantDb
    .update(schema.letters)
    .set({ pdfUrl, pdfGeneratedAt: new Date() })
    .where(eq(schema.letters.id, letterId));

  // Kembalikan URL PDF
  return NextResponse.json({ success: true, pdfUrl }, { status: 200 });
}
