import { createTenantDb } from "@jalajogja/db";
import { getSettings } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { LetterConfigClient } from "@/components/letters/letter-config-client";
import type { LetterConfig } from "@/app/(dashboard)/[tenant]/letters/actions";
import { DEFAULT_LETTER_CONFIG } from "@/lib/letter-number";

const DEFAULT_CONFIG: LetterConfig = {
  header_image_url: null,
  footer_image_url: null,
  paper_size:      "A4",
  body_font:       "Times New Roman",
  margin_top:      20,
  margin_right:    20,
  margin_bottom:   20,
  margin_left:     25,
  number_format:   DEFAULT_LETTER_CONFIG.number_format,
  org_code:        DEFAULT_LETTER_CONFIG.org_code,
  number_padding:  DEFAULT_LETTER_CONFIG.number_padding,
};

export default async function LetterPengaturanPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/login");

  const tenantClient = createTenantDb(slug);
  const generalSettings = await getSettings(tenantClient, "general");
  const raw = (generalSettings["letter_config"] as Partial<LetterConfig> | undefined) ?? {};

  const config: LetterConfig = {
    header_image_url: raw.header_image_url ?? null,
    footer_image_url: raw.footer_image_url ?? null,
    paper_size:      raw.paper_size      ?? DEFAULT_CONFIG.paper_size,
    body_font:       raw.body_font       ?? DEFAULT_CONFIG.body_font,
    margin_top:      raw.margin_top      ?? DEFAULT_CONFIG.margin_top,
    margin_right:    raw.margin_right    ?? DEFAULT_CONFIG.margin_right,
    margin_bottom:   raw.margin_bottom   ?? DEFAULT_CONFIG.margin_bottom,
    margin_left:     raw.margin_left     ?? DEFAULT_CONFIG.margin_left,
    number_format:   raw.number_format   ?? DEFAULT_CONFIG.number_format,
    org_code:        raw.org_code        ?? DEFAULT_CONFIG.org_code,
    number_padding:  raw.number_padding  ?? DEFAULT_CONFIG.number_padding,
  };

  const isAdmin = ["owner", "admin"].includes(access.tenantUser.role);

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold">Pengaturan Surat</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Kop surat, format nomor, dan tampilan PDF
        </p>
      </div>

      <LetterConfigClient
        slug={slug}
        initialConfig={config}
        isAdmin={isAdmin}
      />
    </div>
  );
}
