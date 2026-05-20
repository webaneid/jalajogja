"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { WilayahSelect, type WilayahValue } from "@/components/ui/wilayah-select";
import { SocialMediaInput, type SocialMediaValue, SOCIAL_MEDIA_EMPTY } from "@/components/ui/social-media-input";
import { saveContactSettingsAction } from "@/app/(dashboard)/app/[tenant]/settings/actions";

// ─── Types ────────────────────────────────────────────────────────────────────

type AddressDefault = {
  provinceId?: number;
  regencyId?:  number;
  districtId?: number;
  villageId?:  number;
  detail:      string;
  postalCode:  string;
};

type DefaultValues = {
  contactEmail:    string;
  contactPhone:    string;
  contactWhatsapp: string;
  address:         AddressDefault;
  socials:         Partial<SocialMediaValue> & Record<string, string>;
};

// ─── Sub-komponen ─────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4">
      <legend className="w-full border-b pb-1.5 text-sm font-semibold text-foreground">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

// ─── Form ─────────────────────────────────────────────────────────────────────

export function ContactSettingsForm({
  slug,
  defaultValues,
}: {
  slug: string;
  defaultValues: DefaultValues;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  const [contactEmail,    setContactEmail]    = React.useState(defaultValues.contactEmail    ?? "");
  const [contactPhone,    setContactPhone]    = React.useState(defaultValues.contactPhone    ?? "");
  const [contactWhatsapp, setContactWhatsapp] = React.useState(defaultValues.contactWhatsapp ?? "");

  const [wilayah, setWilayah] = React.useState<WilayahValue>({
    provinceId: defaultValues.address.provinceId,
    regencyId:  defaultValues.address.regencyId,
    districtId: defaultValues.address.districtId,
    villageId:  defaultValues.address.villageId,
  });
  const [addressDetail,    setAddressDetail]    = React.useState(defaultValues.address.detail);
  const [addressPostalCode, setAddressPostalCode] = React.useState(defaultValues.address.postalCode);

  const [socials, setSocials] = React.useState<SocialMediaValue>({
    ...SOCIAL_MEDIA_EMPTY,
    instagram: defaultValues.socials.instagram ?? "",
    facebook:  defaultValues.socials.facebook  ?? "",
    linkedin:  defaultValues.socials.linkedin  ?? "",
    twitter:   defaultValues.socials.twitter   ?? "",
    youtube:   defaultValues.socials.youtube   ?? "",
    tiktok:    defaultValues.socials.tiktok    ?? "",
    website:   defaultValues.socials.website   ?? "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const result = await saveContactSettingsAction(slug, {
        contactEmail,
        contactPhone,
        contactWhatsapp,
        contactAddress: {
          provinceId: wilayah.provinceId,
          regencyId:  wilayah.regencyId,
          districtId: wilayah.districtId,
          villageId:  wilayah.villageId,
          detail:     addressDetail,
          postalCode: addressPostalCode,
        },
        socials: socials as unknown as Record<string, string>,
      });
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Kontak & sosial media disimpan.");
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">

      {/* ── KONTAK ── */}
      <Section title="Kontak Organisasi">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="contactEmail">Email</Label>
            <Input
              id="contactEmail"
              type="email"
              value={contactEmail}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setContactEmail(e.target.value)}
              placeholder="ikpm@email.com"
              disabled={pending}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="contactPhone">Telepon</Label>
              <Input
                id="contactPhone"
                type="tel"
                value={contactPhone}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setContactPhone(e.target.value)}
                placeholder="(0274) 123456"
                inputMode="tel"
                disabled={pending}
              />
              <p className="text-xs text-muted-foreground">Nomor kantor, bisa format lokal.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactWhatsapp">WhatsApp</Label>
              <Input
                id="contactWhatsapp"
                type="tel"
                value={contactWhatsapp}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setContactWhatsapp(e.target.value)}
                placeholder="6285210626455"
                inputMode="numeric"
                disabled={pending}
              />
              <p className="text-xs text-muted-foreground">Format internasional tanpa +. Misal: 628521...</p>
            </div>
          </div>
        </div>
      </Section>

      {/* ── ALAMAT ── */}
      <Section title="Alamat Organisasi">
        <WilayahSelect
          onChange={setWilayah}
          defaultValue={wilayah}
          disabled={pending}
        />
        <div className="space-y-2">
          <Label htmlFor="addressDetail">Detail Alamat</Label>
          <textarea
            id="addressDetail"
            value={addressDetail}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setAddressDetail(e.target.value)}
            placeholder="Nama jalan, nomor, RT/RW, gedung, lantai, dll."
            rows={3}
            disabled={pending}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
          />
        </div>
        <div className="max-w-[180px] space-y-2">
          <Label htmlFor="postalCode">Kode Pos</Label>
          <Input
            id="postalCode"
            value={addressPostalCode}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAddressPostalCode(e.target.value)}
            placeholder="55283"
            maxLength={10}
            inputMode="numeric"
            disabled={pending}
          />
        </div>
      </Section>

      {/* ── SOSIAL MEDIA ── */}
      <Section title="Sosial Media">
        <SocialMediaInput value={socials} onChange={setSocials} disabled={pending} />
      </Section>

      <Button type="submit" disabled={pending}>
        {pending ? "Menyimpan..." : "Simpan"}
      </Button>
    </form>
  );
}
