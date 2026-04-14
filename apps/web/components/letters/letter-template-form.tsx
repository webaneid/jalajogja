"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createLetterTemplateAction,
  updateLetterTemplateAction,
} from "@/app/(dashboard)/[tenant]/letters/actions";

type DefaultValues = {
  name:     string;
  type:     "outgoing" | "internal";
  subject:  string;
  body:     string;
  isActive: boolean;
};

type Props = {
  slug:          string;
  templateId?:   string;
  defaultValues?: DefaultValues;
};

const EMPTY: DefaultValues = {
  name:     "",
  type:     "outgoing",
  subject:  "",
  body:     "",
  isActive: true,
};

const fieldCls = "w-full mt-0.5 rounded border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring";

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
        name:     form.name.trim(),
        type:     form.type,
        subject:  form.subject.trim() || null,
        body:     form.body.trim() || null,
        isActive: form.isActive,
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
        <label className="text-xs text-muted-foreground">
          Nama Template <span className="text-destructive">*</span>
        </label>
        <input
          autoFocus
          type="text"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="mis. Surat Undangan Rapat"
          className={fieldCls}
        />
      </div>

      {/* Jenis Surat */}
      <div>
        <label className="text-xs text-muted-foreground">Jenis Surat</label>
        <select
          value={form.type}
          onChange={(e) => set("type", e.target.value as "outgoing" | "internal")}
          className={fieldCls}
        >
          <option value="outgoing">Surat Keluar</option>
          <option value="internal">Nota Dinas</option>
        </select>
        <p className="text-xs text-muted-foreground mt-1">
          Template akan tersedia saat membuat surat dengan jenis yang sesuai.
        </p>
      </div>

      {/* Perihal */}
      <div>
        <label className="text-xs text-muted-foreground">Perihal (opsional)</label>
        <input
          type="text"
          value={form.subject}
          onChange={(e) => set("subject", e.target.value)}
          placeholder="Perihal default yang akan diisi otomatis"
          className={fieldCls}
        />
      </div>

      {/* Isi Surat */}
      <div>
        <label className="text-xs text-muted-foreground">Isi Surat (opsional)</label>
        <textarea
          rows={10}
          value={form.body}
          onChange={(e) => set("body", e.target.value)}
          placeholder="Tulis isi surat template di sini. Gunakan {{nama_penerima}}, {{tanggal}}, dll untuk merge fields."
          className={`${fieldCls} resize-y font-mono text-xs`}
        />
        <p className="text-xs text-muted-foreground mt-1">
          Mendukung merge fields: <code className="font-mono">{"{{nama_penerima}}"}</code>, <code className="font-mono">{"{{tanggal}}"}</code>, <code className="font-mono">{"{{nomor_surat}}"}</code>, dll.
        </p>
      </div>

      {/* Aktif */}
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={form.isActive}
          onChange={(e) => set("isActive", e.target.checked)}
          className="h-4 w-4 rounded accent-primary"
        />
        Template aktif (tampil di pilihan saat buat surat)
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
