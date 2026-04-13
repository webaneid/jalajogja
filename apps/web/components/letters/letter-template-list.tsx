"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Pencil, Trash2, Star, FileText } from "lucide-react";
import { deleteLetterTemplateAction } from "@/app/(dashboard)/[tenant]/letters/actions";

type Template = {
  id:        string;
  name:      string;
  paperSize: string;
  bodyFont:  string;
  isDefault: boolean;
  createdAt: Date;
};

type Props = {
  slug:      string;
  templates: Template[];
};

export function LetterTemplateList({ slug, templates: initial }: Props) {
  const [templates, setTemplates] = useState<Template[]>(initial);
  const [error, setError]         = useState("");
  const [pending, startTransition] = useTransition();

  function handleDelete(templateId: string) {
    const t = templates.find((x) => x.id === templateId);
    if (!confirm(`Hapus template "${t?.name}"?`)) return;
    setError("");

    startTransition(async () => {
      const res = await deleteLetterTemplateAction(slug, templateId);
      if (res.success) {
        setTemplates((prev) => prev.filter((x) => x.id !== templateId));
      } else {
        setError(res.error);
      }
    });
  }

  if (templates.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border py-10 text-center">
        <FileText className="h-8 w-8 mx-auto text-muted-foreground/50 mb-3" />
        <p className="text-sm text-muted-foreground">Belum ada template kop surat</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
        {templates.map((t) => (
          <div key={t.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/20">
            <div className="flex items-center gap-3 min-w-0">
              {t.isDefault && <Star className="h-4 w-4 text-yellow-500 shrink-0" />}
              <div>
                <p className="text-sm font-medium">{t.name}</p>
                <p className="text-xs text-muted-foreground">
                  {t.paperSize} · {t.bodyFont}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-4">
              <Link
                href={`/${slug}/letters/template/${t.id}/edit`}
                className="text-muted-foreground hover:text-foreground"
              >
                <Pencil className="h-4 w-4" />
              </Link>
              <button
                type="button"
                onClick={() => handleDelete(t.id)}
                disabled={pending || t.isDefault}
                title={t.isDefault ? "Template default tidak bisa dihapus" : undefined}
                className="text-muted-foreground hover:text-destructive disabled:opacity-40"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
