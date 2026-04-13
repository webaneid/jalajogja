"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createLetterTemplateAction,
  updateLetterTemplateAction,
} from "@/app/(dashboard)/[tenant]/letters/actions";

type DefaultValues = {
  name:          string;
  paperSize:     "A4" | "F4" | "Letter";
  headerImageId: string | null;
  footerImageId: string | null;
  bodyFont:      string;
  marginTop:     number;
  marginRight:   number;
  marginBottom:  number;
  marginLeft:    number;
  isDefault:     boolean;
};

type Props = {
  slug:          string;
  templateId?:   string;
  defaultValues?: DefaultValues;
};

const EMPTY: DefaultValues = {
  name:          "",
  paperSize:     "A4",
  headerImageId: null,
  footerImageId: null,
  bodyFont:      "Times New Roman",
  marginTop:     20,
  marginRight:   20,
  marginBottom:  20,
  marginLeft:    25,
  isDefault:     false,
};

const FONTS = [
  "Times New Roman",
  "Arial",
  "Calibri",
  "Georgia",
  "Helvetica",
];

export function LetterTemplateForm({ slug, templateId, defaultValues }: Props) {
  const router  = useRouter();
  const [form, setForm] = useState<DefaultValues>(defaultValues ?? EMPTY);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function set<K extends keyof DefaultValues>(field: K, value: DefaultValues[K]) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Nama template wajib diisi."); return; }
    setError("");

    startTransition(async () => {
      const data = {
        name:          form.name.trim(),
        paperSize:     form.paperSize,
        headerImageId: form.headerImageId || null,
        footerImageId: form.footerImageId || null,
        bodyFont:      form.bodyFont,
        marginTop:     Number(form.marginTop),
        marginRight:   Number(form.marginRight),
        marginBottom:  Number(form.marginBottom),
        marginLeft:    Number(form.marginLeft),
        isDefault:     form.isDefault,
      };

      const res = templateId
        ? await updateLetterTemplateAction(slug, templateId, data)
        : await createLetterTemplateAction(slug, data);

      if (res.success) {
        router.push(`/${slug}/letters/template`);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-4">
      {/* Nama */}
      <div>
        <label className="text-xs text-muted-foreground">Nama Template <span className="text-destructive">*</span></label>
        <input
          autoFocus
          type="text"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="mis. Kop Resmi IKPM"
          className="w-full mt-0.5 rounded border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* Ukuran kertas & font */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">Ukuran Kertas</label>
          <select
            value={form.paperSize}
            onChange={(e) => set("paperSize", e.target.value as "A4" | "F4" | "Letter")}
            className="w-full mt-0.5 rounded border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="A4">A4</option>
            <option value="F4">F4 / Folio</option>
            <option value="Letter">Letter</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Font</label>
          <select
            value={form.bodyFont}
            onChange={(e) => set("bodyFont", e.target.value)}
            className="w-full mt-0.5 rounded border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {FONTS.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Margin — dalam mm */}
      <div>
        <label className="text-xs text-muted-foreground mb-1.5 block">Margin (mm)</label>
        <div className="grid grid-cols-4 gap-3">
          {(["marginTop", "marginRight", "marginBottom", "marginLeft"] as const).map((field) => (
            <div key={field}>
              <label className="text-xs text-muted-foreground">
                {field === "marginTop" ? "Atas" : field === "marginRight" ? "Kanan" : field === "marginBottom" ? "Bawah" : "Kiri"}
              </label>
              <input
                type="number"
                min="0"
                max="50"
                value={form[field]}
                onChange={(e) => set(field, Number(e.target.value))}
                className="w-full mt-0.5 rounded border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Default */}
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={form.isDefault}
          onChange={(e) => set("isDefault", e.target.checked)}
          className="h-4 w-4 rounded accent-primary"
        />
        Jadikan template default
      </label>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {pending ? "Menyimpan..." : templateId ? "Simpan Perubahan" : "Buat Template"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md border border-border px-6 py-2.5 text-sm font-medium hover:bg-muted/40"
        >
          Batal
        </button>
      </div>
    </form>
  );
}
