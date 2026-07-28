"use client";

import { useState, useTransition } from "react";
import { Combobox } from "@/components/ui/combobox";

type PermalinkOption = { id: string; label: string; example: string };

type Props = {
  current:  string;
  options:  PermalinkOption[];
  onSave:   (structure: string) => Promise<{ success: boolean; error?: string }>;
};

export function PermalinkStructureForm({ current, options, onSave }: Props) {
  const [value, setValue]   = useState(current);
  const [isPending, start]  = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const selected = options.find(o => o.id === value) ?? options[0];

  function handleSave() {
    setMessage(null);
    start(async () => {
      const res = await onSave(value);
      setMessage(
        res.success
          ? { type: "success", text: "Struktur URL berhasil disimpan." }
          : { type: "error", text: res.error ?? "Gagal menyimpan." },
      );
    });
  }

  return (
    <div className="space-y-3">
      <Combobox
        value={value}
        onValueChange={setValue}
        options={options.map(o => ({ value: o.id, label: o.label }))}
        placeholder="Pilih struktur URL..."
      />

      {selected && (
        <p className="text-xs text-muted-foreground">
          Contoh URL: <code className="bg-muted px-1.5 py-0.5 rounded">{selected.example}</code>
        </p>
      )}

      {message && (
        <p className={`text-xs ${message.type === "success" ? "text-emerald-600" : "text-destructive"}`}>
          {message.text}
        </p>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={isPending || value === current}
        className="text-sm px-3 py-1.5 rounded-md bg-primary text-primary-foreground disabled:opacity-50"
      >
        {isPending ? "Menyimpan..." : "Simpan"}
      </button>
    </div>
  );
}
