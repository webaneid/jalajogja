"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createIncomingLetterAction } from "@/app/(dashboard)/[tenant]/letters/actions";

type LetterType = { id: string; name: string; code: string | null };

type Props = {
  slug:        string;
  letterTypes: LetterType[];
};

const EMPTY = {
  typeId:       "",
  letterNumber: "",
  subject:      "",
  body:         "",
  sender:       "",
  recipient:    "",
  letterDate:   new Date().toISOString().split("T")[0],
};

export function IncomingLetterForm({ slug, letterTypes }: Props) {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function set(field: keyof typeof EMPTY, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.subject.trim()) { setError("Perihal surat wajib diisi."); return; }
    if (!form.sender.trim())  { setError("Pengirim wajib diisi."); return; }
    if (!form.letterDate)     { setError("Tanggal surat wajib diisi."); return; }
    setError("");

    startTransition(async () => {
      const res = await createIncomingLetterAction(slug, {
        typeId:       form.typeId  || null,
        letterNumber: form.letterNumber || null,
        subject:      form.subject.trim(),
        body:         form.body   || null,
        sender:       form.sender.trim(),
        recipient:    form.recipient.trim() || "",
        letterDate:   form.letterDate,
        status:       "received",
      });

      if (res.success) {
        router.push(`/${slug}/letters/masuk`);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
      {/* Jenis surat */}
      {letterTypes.length > 0 && (
        <div>
          <label className="text-xs text-muted-foreground">Jenis Surat</label>
          <select
            value={form.typeId}
            onChange={(e) => set("typeId", e.target.value)}
            className="w-full mt-0.5 rounded border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">— Pilih jenis —</option>
            {letterTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Nomor surat dari pengirim */}
      <div>
        <label className="text-xs text-muted-foreground">Nomor Surat (dari pengirim)</label>
        <input
          type="text"
          value={form.letterNumber}
          onChange={(e) => set("letterNumber", e.target.value)}
          placeholder="Nomor surat asli dari pengirim"
          className="w-full mt-0.5 rounded border border-input bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* Perihal */}
      <div>
        <label className="text-xs text-muted-foreground">Perihal <span className="text-destructive">*</span></label>
        <input
          autoFocus
          type="text"
          value={form.subject}
          onChange={(e) => set("subject", e.target.value)}
          placeholder="Perihal surat"
          className="w-full mt-0.5 rounded border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* Pengirim & Tanggal */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">Pengirim <span className="text-destructive">*</span></label>
          <input
            type="text"
            value={form.sender}
            onChange={(e) => set("sender", e.target.value)}
            placeholder="Nama pengirim / instansi"
            className="w-full mt-0.5 rounded border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Tanggal Surat <span className="text-destructive">*</span></label>
          <input
            type="date"
            value={form.letterDate}
            onChange={(e) => set("letterDate", e.target.value)}
            className="w-full mt-0.5 rounded border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      {/* Kepada */}
      <div>
        <label className="text-xs text-muted-foreground">Kepada</label>
        <input
          type="text"
          value={form.recipient}
          onChange={(e) => set("recipient", e.target.value)}
          placeholder="Penerima (opsional)"
          className="w-full mt-0.5 rounded border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* Body */}
      <div>
        <label className="text-xs text-muted-foreground">Isi / Ringkasan</label>
        <textarea
          rows={6}
          value={form.body}
          onChange={(e) => set("body", e.target.value)}
          placeholder="Ringkasan isi surat (opsional)"
          className="w-full mt-0.5 rounded border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-y"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {pending ? "Menyimpan..." : "Catat Surat Masuk"}
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
