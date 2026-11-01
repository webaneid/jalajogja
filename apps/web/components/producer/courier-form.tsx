"use client";

// Pilihan kurir produsen (§ 25) — SATU komponen untuk Profil produsen dan dialog admin. Doc: docs/arsitektur-portal-produsen.md § 25.6.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RAJAONGKIR_COURIER_OPTIONS } from "@/lib/rajaongkir-couriers";
import { Button } from "@/components/ui/button";

type Result = { success: boolean; error?: string };

export function CourierForm({ initial, onSave, onDone }: {
  /** null = belum diatur (ikut pengaturan admin) */
  initial: string[] | null;
  onSave: (couriers: string[] | null) => Promise<Result>;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(initial ?? []);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const toggle = (code: string) =>
    setSelected((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));

  const submit = (value: string[] | null) => {
    setMsg(null);
    start(async () => {
      const r = await onSave(value);
      if (!r.success) { setMsg({ ok: false, text: r.error ?? "Gagal menyimpan." }); return; }
      if (value === null) setSelected([]);
      setMsg({ ok: true, text: value === null ? "Kembali mengikuti pengaturan admin." : "Kurir tersimpan." });
      router.refresh();
      onDone?.();
    });
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {RAJAONGKIR_COURIER_OPTIONS.map((c) => (
          <label key={c.value} className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-sm">
            <input type="checkbox" checked={selected.includes(c.value)} onChange={() => toggle(c.value)} />
            {c.label}
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={pending || selected.length === 0} onClick={() => submit(selected)}>
          {pending ? "Menyimpan…" : "Simpan Kurir"}
        </Button>
        <Button size="sm" variant="outline" disabled={pending || initial === null} onClick={() => submit(null)}>
          Ikuti pengaturan admin
        </Button>
        {msg && <span className={`text-xs ${msg.ok ? "text-green-700" : "text-destructive"}`}>{msg.text}</span>}
      </div>
    </div>
  );
}
