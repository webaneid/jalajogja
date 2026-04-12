import { redirect } from "next/navigation";
import { getTenantAccess } from "@/lib/tenant";
import { createTenantDb, getSettings } from "@jalajogja/db";
import { ContactSettingsForm } from "@/components/settings/contact-settings-form";

export default async function ContactSettingsPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;

  const access = await getTenantAccess(slug);
  if (!access) redirect("/dashboard-redirect");

  const tenantDb = createTenantDb(slug);
  const settings = await getSettings(tenantDb, "contact");

  type AddressValue = {
    provinceId?: number;
    regencyId?: number;
    districtId?: number;
    villageId?: number;
    detail?: string;
    postalCode?: string;
  };

  type SocialsValue = Record<string, string>;

  const address = (settings.contact_address as AddressValue) ?? {};
  const socials = (settings.socials as SocialsValue) ?? {};

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Kontak & Sosial Media</h2>
        <p className="text-sm text-muted-foreground">
          Informasi kontak dan akun sosial media organisasi.
        </p>
      </div>

      <ContactSettingsForm
        slug={slug}
        defaultValues={{
          contactEmail: (settings.contact_email as string) ?? "",
          contactPhone: (settings.contact_phone as string) ?? "",
          address: {
            provinceId: address.provinceId,
            regencyId:  address.regencyId,
            districtId: address.districtId,
            villageId:  address.villageId,
            detail:     address.detail ?? "",
            postalCode: address.postalCode ?? "",
          },
          socials: {
            instagram: socials.instagram ?? "",
            facebook:  socials.facebook  ?? "",
            linkedin:  socials.linkedin  ?? "",
            twitter:   socials.twitter   ?? "",
            youtube:   socials.youtube   ?? "",
            tiktok:    socials.tiktok    ?? "",
            website:   socials.website   ?? "",
          },
        }}
      />
    </div>
  );
}
