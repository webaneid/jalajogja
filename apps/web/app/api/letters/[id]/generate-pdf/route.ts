// POST /api/letters/[id]/generate-pdf?slug={slug}
// Generate PDF surat via Playwright → upload MinIO → update letters.pdf_url

import { NextRequest, NextResponse } from "next/server";
import { createTenantDb, db, getSettings, members, tenants } from "@jalajogja/db";
import { refRegencies } from "@jalajogja/db";
import { eq, inArray } from "drizzle-orm"; // inArray masih dipakai untuk officer/member lookups
import { chromium } from "playwright";
import { getTenantAccess } from "@/lib/tenant";
import { buildLetterHtml, paperFormat } from "@/lib/letter-html";
import { uploadFile, publicUrl, buildPath, ensureBucket } from "@/lib/minio";

// Default styling untuk PDF jika letter_config belum diatur
const DEFAULT_LETTER_CONFIG_FULL = {
  body_font:     "Times New Roman",
  margin_top:    20,
  margin_right:  20,
  margin_bottom: 20,
  margin_left:   25,
};

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

  // Fetch letter_config dari settings (kop surat, margin, font)
  // URL gambar header/footer disimpan langsung di config (tidak perlu lookup media table)
  const generalSettingsRaw = await getSettings(tenantClient, "general");
  const rawLetterConfig = (generalSettingsRaw["letter_config"] as {
    header_image_url?: string | null;
    footer_image_url?: string | null;
    paper_size?:       string;
    body_font?:        string;
    margin_top?:       number;
    margin_right?:     number;
    margin_bottom?:    number;
    margin_left?:      number;
    letter_city?:      string | null;
  } | undefined) ?? {};

  const template = {
    bodyFont:       rawLetterConfig.body_font      ?? DEFAULT_LETTER_CONFIG_FULL.body_font,
    marginTop:      rawLetterConfig.margin_top     ?? DEFAULT_LETTER_CONFIG_FULL.margin_top,
    marginRight:    rawLetterConfig.margin_right   ?? DEFAULT_LETTER_CONFIG_FULL.margin_right,
    marginBottom:   rawLetterConfig.margin_bottom  ?? DEFAULT_LETTER_CONFIG_FULL.margin_bottom,
    marginLeft:     rawLetterConfig.margin_left    ?? DEFAULT_LETTER_CONFIG_FULL.margin_left,
    headerImageUrl: rawLetterConfig.header_image_url ?? null,
    footerImageUrl: rawLetterConfig.footer_image_url ?? null,
    paperSize: ((rawLetterConfig.paper_size ?? letter.paperSize ?? "A4")) as "A4" | "F4" | "Letter",
  };

  // Fetch settings org (nama, alamat, telepon, email) + contact settings
  const [orgSettings, tenantRow] = await Promise.all([
    getSettings(tenantClient, "contact"),
    db.select({ name: tenants.name }).from(tenants).where(eq(tenants.slug, slug)).limit(1)
      .then((r) => r[0]),
  ]);

  const orgName    = (generalSettingsRaw["site_name"] as string | undefined) ?? tenantRow?.name ?? "";
  const orgAddress = (orgSettings["contact_address"] as { detail?: string } | undefined)?.detail ?? "";
  const orgPhone   = (orgSettings["contact_phone"] as string | undefined) ?? "";
  const orgEmail   = (orgSettings["contact_email"] as string | undefined) ?? "";

  // Ambil kota untuk format tanggal surat
  // Prioritas: letter_config.letter_city (override) → kota dari settings kontak (fallback)
  let orgCity = rawLetterConfig.letter_city?.trim() ?? "";
  if (!orgCity) {
    const contactAddress = orgSettings["contact_address"] as {
      detail?: string; regencyId?: number;
    } | undefined;
    if (contactAddress?.regencyId) {
      const [regRow] = await db
        .select({ name: refRegencies.name, type: refRegencies.type })
        .from(refRegencies)
        .where(eq(refRegencies.id, contactAddress.regencyId))
        .limit(1);
      if (regRow) {
        // Hilangkan prefix "Kabupaten " atau "Kota " sesuai type
        const prefix = regRow.type === "kota" ? /^Kota\s+/i : /^Kabupaten\s+/i;
        orgCity = regRow.name.replace(prefix, "").trim();
      }
    }
  }

  // Fetch letterType untuk identitas layout + format tanggal + nama jenis surat
  const letterTypeData = letter.typeId
    ? await tenantDb
        .select({
          name:            tenantClient.schema.letterTypes.name,
          identitasLayout: tenantClient.schema.letterTypes.identitasLayout,
          showLampiran:    tenantClient.schema.letterTypes.showLampiran,
          dateFormat:      tenantClient.schema.letterTypes.dateFormat,
        })
        .from(tenantClient.schema.letterTypes)
        .where(eq(tenantClient.schema.letterTypes.id, letter.typeId))
        .limit(1)
        .then((r) => r[0] ?? null)
    : null;

  // Letter config — format tanggal global + hijri offset
  const rawLetterConfigFull = generalSettingsRaw["letter_config"] as {
    date_format?:  string;
    hijri_offset?: number;
  } | undefined ?? {};

  // dateFormat: per jenis surat > global default > fallback "masehi"
  const globalDateFormat = (rawLetterConfigFull.date_format ?? "masehi") as "masehi" | "masehi_hijri";
  const dateFormat = (letterTypeData?.dateFormat as "masehi" | "masehi_hijri" | null) ?? globalDateFormat;
  const hijriOffset = Number(rawLetterConfigFull.hijri_offset ?? 0);

  const identitasLayout = (letterTypeData?.identitasLayout ?? "layout1") as "layout1" | "layout2" | "layout3";
  const showLampiran    = letterTypeData?.showLampiran ?? true;
  const letterTypeName  = letterTypeData?.name ?? "";

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

    // Hanya render slot yang sudah TTD (signedAt + verificationHash tidak null)
    signers = rawSigs
      .filter((s) => s.signedAt !== null && s.verificationHash !== null)
      .map((s) => {
        const off = officers.find((o) => o.id === s.officerId);
        return {
          name:             off ? (memberMap.get(off.memberId) ?? "—") : "—",
          position:         off?.position ?? "—",
          division:         off?.divisionId ? (divisionMap.get(off.divisionId) ?? null) : null,
          role:             s.role,
          signedAt:         s.signedAt as Date,
          verificationHash: s.verificationHash as string,
          slug,
        };
      });
  }

  // Ekstrak data penerima dari mergeFields (disimpan saat user pilih kontak di form)
  const mf = (letter.mergeFields as Record<string, string> | null) ?? {};

  // Build HTML
  const html = await buildLetterHtml({
    letterNumber:    letter.letterNumber ?? null,
    letterDate:      letter.letterDate,
    subject:         letter.subject,
    sender:          letter.sender,
    recipient:       letter.recipient,
    recipientData: {
      title:        mf.recipient_title        ?? "",
      organization: mf.recipient_organization ?? "",
      address:      mf.recipient_address      ?? "",
      phone:        mf.recipient_phone        ?? "",
      email:        mf.recipient_email        ?? "",
    },
    body:            letter.body,
    template,
    signers,
    orgName,
    orgAddress,
    orgPhone,
    orgEmail,
    // Identitas surat
    identitasLayout,
    dateFormat,
    attachmentLabel: (letter as { attachmentLabel?: string | null }).attachmentLabel ?? null,
    showLampiran,
    letterTypeName,
    orgCity,
    hijriOffset,
    // Layout TTD
    signatureLayout:   ((letter as { signatureLayout?: string }).signatureLayout ?? "double") as import("@/lib/letter-signature-layout").SignatureLayout,
    signatureShowDate: (letter as { signatureShowDate?: boolean }).signatureShowDate ?? true,
  });

  // Playwright → PDF
  let pdfBuffer: Buffer;
  let browser;
  try {
    browser = await chromium.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    const format = paperFormat(template.paperSize);
    // Margin dikontrol via CSS @page di HTML — jangan set margin di page.pdf() agar tidak dobel
    const rawPdf = await page.pdf({
      ...format,
      printBackground: true,
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
