"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { saveDisplaySettingsAction } from "@/app/(dashboard)/app/[tenant]/settings/actions";

const BODY_FONT_OPTIONS = [
  { value: "Inter",             label: "Inter (default)"   },
  { value: "Plus Jakarta Sans", label: "Plus Jakarta Sans" },
  { value: "Geist",             label: "Geist"             },
  { value: "DM Sans",           label: "DM Sans"           },
  { value: "Nunito",            label: "Nunito"            },
  { value: "Poppins",           label: "Poppins"           },
];

const HEADING_FONT_OPTIONS = [
  { value: "Inter",       label: "Inter (default)" },
  { value: "Poppins",     label: "Poppins"         },
  { value: "Philosopher", label: "Philosopher"      },
];

// Font yang perlu di-load dari Google Fonts untuk preview
const GOOGLE_FONTS = ["Poppins", "Philosopher", "Plus Jakarta Sans", "DM Sans", "Nunito", "Geist"];

function ColorField({
  id,
  label,
  description,
  value,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  description?: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-3">
        <input
          id={id}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="h-9 w-16 cursor-pointer rounded-md border border-input bg-background p-1 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          className="max-w-[120px] font-mono"
          disabled={disabled}
        />
        <span className="text-xs text-muted-foreground">Format hex: #rrggbb</span>
      </div>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      {/* Swatch preview */}
      <div
        className="h-5 w-32 rounded"
        style={{ backgroundColor: value }}
      />
    </div>
  );
}

export function DisplaySettingsForm({
  slug,
  defaultValues,
}: {
  slug: string;
  defaultValues: {
    primaryColor:   string;
    secondaryColor: string;
    font:           string;
    headingFont:    string;
    footerText:     string;
  };
}) {
  const router = useRouter();
  const [pending,        setPending]        = React.useState(false);
  const [primaryColor,   setPrimaryColor]   = React.useState(defaultValues.primaryColor);
  const [secondaryColor, setSecondaryColor] = React.useState(defaultValues.secondaryColor);
  const [font,           setFont]           = React.useState(defaultValues.font);
  const [headingFont,    setHeadingFont]    = React.useState(defaultValues.headingFont);
  const [footerText,     setFooterText]     = React.useState(defaultValues.footerText);

  // Load Google Fonts satu kali untuk preview di form ini
  React.useEffect(() => {
    const families = [
      "Poppins:wght@400;600;700",
      "Philosopher:ital,wght@0,400;0,700;1,400",
      "Plus+Jakarta+Sans:wght@400;600",
      "DM+Sans:wght@400;500",
      "Nunito:wght@400;600",
    ].join("&family=");
    const href = `https://fonts.googleapis.com/css2?family=${families}&display=swap`;
    if (document.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement("link");
    link.rel  = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const result = await saveDisplaySettingsAction(slug, {
        primaryColor, secondaryColor, font, headingFont, footerText,
      });
      if (result.error) toast.error(result.error);
      else { toast.success("Tampilan disimpan."); router.refresh(); }
    } finally { setPending(false); }
  }

  const isGoogleFont = (f: string) => GOOGLE_FONTS.includes(f);

  return (
    <form onSubmit={handleSubmit} className="space-y-8">

      {/* ── Warna ── */}
      <div className="space-y-5">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Warna</h3>
        <ColorField
          id="primaryColor"
          label="Warna Utama"
          description="Tombol, link, aksen utama di website publik."
          value={primaryColor}
          onChange={setPrimaryColor}
          disabled={pending}
        />
        <ColorField
          id="secondaryColor"
          label="Warna Sekunder"
          description="Aksen pendukung: badge, highlight, elemen latar."
          value={secondaryColor}
          onChange={setSecondaryColor}
          disabled={pending}
        />
      </div>

      {/* ── Font ── */}
      <div className="space-y-5">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Font</h3>

        {/* Body font */}
        <div className="space-y-2">
          <Label>Font Teks (Body)</Label>
          <div className="max-w-xs">
            <Combobox
              options={BODY_FONT_OPTIONS}
              value={font}
              onValueChange={setFont}
              placeholder="Pilih font..."
              disabled={pending}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Untuk paragraf, konten artikel, dan teks umum.
          </p>
          <p
            className="text-sm border border-border rounded px-3 py-2 max-w-xs bg-muted/30"
            style={{ fontFamily: isGoogleFont(font) ? `"${font}", sans-serif` : font }}
          >
            Contoh teks paragraf dengan font {font}.
          </p>
        </div>

        {/* Heading font */}
        <div className="space-y-2">
          <Label>Font Judul (Heading)</Label>
          <div className="max-w-xs">
            <Combobox
              options={HEADING_FONT_OPTIONS}
              value={headingFont}
              onValueChange={setHeadingFont}
              placeholder="Pilih font judul..."
              disabled={pending}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Untuk judul halaman, heading artikel, dan nama section.
          </p>
          <p
            className="text-xl font-bold border border-border rounded px-3 py-2 max-w-xs bg-muted/30"
            style={{ fontFamily: isGoogleFont(headingFont) ? `"${headingFont}", serif` : headingFont }}
          >
            Contoh Judul Halaman
          </p>
        </div>
      </div>

      {/* ── Footer text ── */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Footer</h3>
        <Label htmlFor="footerText">Teks Footer</Label>
        <textarea
          id="footerText"
          value={footerText}
          onChange={(e) => setFooterText(e.target.value)}
          placeholder={`© ${new Date().getFullYear()} Nama Organisasi. All rights reserved.`}
          rows={2}
          disabled={pending}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
        />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Menyimpan..." : "Simpan"}
      </Button>
    </form>
  );
}
