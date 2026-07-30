"use client";

import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { ECOSYSTEM_TAG_SUGGESTIONS } from "@/lib/ecosystem-tags";

// Kontrol filter "Cari berdasarkan yang ditawarkan/dibutuhkan" — dipakai bersama oleh 3
// direktori publik (Usaha/Profesional/Pesantren, Fase 2 ekosistem). Reuse suggestion dari
// lib/ecosystem-tags.ts yang sama dengan form self-service (Fase 1) — satu sumber kebenaran.
// Lihat docs/arsitektur-ekosistem.md § 6 Fase 2.

const TAG_OPTIONS: ComboboxOption[] = [
  { value: "", label: "Semua Tag" },
  ...ECOSYSTEM_TAG_SUGGESTIONS.map(t => ({ value: t, label: t })),
];

type Props = {
  currentTag?: string;
  currentArah?: string;
  onApply: (tag: string | undefined, arah: string | undefined) => void;
};

export function EcosystemTagFilter({ currentTag, currentArah, onApply }: Props) {
  const arah = currentArah === "membutuhkan" ? "membutuhkan" : "menawarkan";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <div className="flex rounded-full border border-border overflow-hidden text-xs shrink-0">
        <button
          type="button"
          onClick={() => onApply(currentTag, "menawarkan")}
          className={`px-2.5 py-1.5 transition-colors ${
            arah === "menawarkan" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted/40"
          }`}
        >
          Menawarkan
        </button>
        <button
          type="button"
          onClick={() => onApply(currentTag, "membutuhkan")}
          className={`px-2.5 py-1.5 transition-colors ${
            arah === "membutuhkan" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted/40"
          }`}
        >
          Membutuhkan
        </button>
      </div>
      <Combobox
        options={TAG_OPTIONS}
        value={currentTag ?? ""}
        onValueChange={v => onApply((v as string) || undefined, arah)}
        placeholder="Cari tag ekosistem..."
        className="h-8 text-xs rounded-full px-3 w-56"
        clearable
      />
    </div>
  );
}
