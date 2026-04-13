"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  updateLetterAction,
  updateLetterStatusAction,
  getNextLetterNumberAction,
} from "@/app/(dashboard)/[tenant]/letters/actions";

type LetterType = { id: string; name: string; code: string | null; defaultCategory: string };
type Template   = { id: string; name: string; isDefault: boolean };
type Signer     = { id: string; memberId: string; position: string; divisionId: string | null };

type DefaultValues = {
  letterNumber:   string;
  typeId:         string;
  templateId:     string;
  subject:        string;
  body:           string;
  sender:         string;
  recipient:      string;
  letterDate:     string;
  status:         "draft" | "sent" | "received" | "archived";
  paperSize:      "A4" | "F4" | "Letter";
  mergeFields:    Record<string, string>;
  attachmentUrls: string[];
};

type Props = {
  slug:         string;
  letterId:     string;
  type:         "outgoing" | "internal";
  letterTypes:  LetterType[];
  templates:    Template[];
  signers:      Signer[];
  defaultValues: DefaultValues;
};

export function LetterForm({ slug, letterId, type, letterTypes, templates, signers, defaultValues }: Props) {
  const router  = useRouter();
  const [form, setForm] = useState(defaultValues);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [generatingNum, setGeneratingNum] = useState(false);

  function set(field: keyof DefaultValues, value: unknown) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleGenerateNumber() {
    if (!form.typeId && letterTypes.length === 0) {
      setError("Pilih jenis surat terlebih dahulu untuk generate nomor.");
      return;
    }
    setGeneratingNum(true);
    setError("");
    const selectedType = letterTypes.find((t) => t.id === form.typeId);
    const category = selectedType?.defaultCategory ?? "UMUM";
    const res = await getNextLetterNumberAction(slug, type, category);
    setGeneratingNum(false);
    if (res.success) {
      set("letterNumber", res.number);
    } else {
      setError(res.error);
    }
  }

  function handleSave(newStatus?: "draft" | "sent" | "archived") {
    setError("");
    if (!form.subject.trim()) { setError("Perihal surat wajib diisi."); return; }
    if (!form.letterDate)     { setError("Tanggal surat wajib diisi."); return; }

    startTransition(async () => {
      const status = newStatus ?? form.status;
      const res = await updateLetterAction(slug, letterId, {
        ...form,
        typeId:     form.typeId     || null,
        templateId: form.templateId || null,
        status,
      });
      if (res.success) {
        set("status", status);
      } else {
        setError(res.error);
      }
    });
  }

  const isSent = form.status === "sent";
  const listPath = `/${slug}/letters/${type === "outgoing" ? "keluar" : "nota"}`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
      {/* Main */}
      <div className="space-y-4">
        {/* Nomor surat */}
        <div>
          <label className="text-xs text-muted-foreground">Nomor Surat</label>
          <div className="flex gap-2 mt-0.5">
            <input
              type="text"
              value={form.letterNumber}
              onChange={(e) => set("letterNumber", e.target.value)}
              placeholder="mis. 001/IKPM/IV/2025"
              className="flex-1 rounded border border-input bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <button
              type="button"
              onClick={handleGenerateNumber}
              disabled={generatingNum}
              className="rounded border border-border px-3 py-2 text-sm hover:bg-muted/40 disabled:opacity-60 whitespace-nowrap"
            >
              {generatingNum ? "..." : "Generate"}
            </button>
          </div>
        </div>

        {/* Perihal */}
        <div>
          <label className="text-xs text-muted-foreground">Perihal <span className="text-destructive">*</span></label>
          <input
            type="text"
            value={form.subject}
            onChange={(e) => set("subject", e.target.value)}
            placeholder="Perihal surat"
            className="w-full mt-0.5 rounded border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {/* Pengirim & Penerima */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Pengirim</label>
            <input
              type="text"
              value={form.sender}
              onChange={(e) => set("sender", e.target.value)}
              placeholder="Nama pengirim / jabatan"
              className="w-full mt-0.5 rounded border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Kepada</label>
            <input
              type="text"
              value={form.recipient}
              onChange={(e) => set("recipient", e.target.value)}
              placeholder="Nama penerima / instansi"
              className="w-full mt-0.5 rounded border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>

        {/* Body */}
        <div>
          <label className="text-xs text-muted-foreground">Isi Surat</label>
          <textarea
            rows={12}
            value={form.body}
            onChange={(e) => set("body", e.target.value)}
            placeholder="Tulis isi surat di sini..."
            className="w-full mt-0.5 rounded border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-y"
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      {/* Sidebar */}
      <div className="space-y-4">
        {/* Status badge */}
        <div className="rounded-lg border border-border p-4 space-y-3">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Status</p>
            <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium
              ${form.status === "draft"    ? "bg-zinc-100 text-zinc-600"   : ""}
              ${form.status === "sent"     ? "bg-blue-100 text-blue-700"   : ""}
              ${form.status === "archived" ? "bg-yellow-100 text-yellow-700" : ""}
            `}>
              {form.status === "draft" ? "Draft" : form.status === "sent" ? "Terkirim" : "Diarsipkan"}
            </span>
          </div>

          {/* Tanggal */}
          <div>
            <label className="text-xs text-muted-foreground">Tanggal Surat <span className="text-destructive">*</span></label>
            <input
              type="date"
              value={form.letterDate}
              onChange={(e) => set("letterDate", e.target.value)}
              className="w-full mt-0.5 rounded border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

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

          {/* Template */}
          {templates.length > 0 && (
            <div>
              <label className="text-xs text-muted-foreground">Template</label>
              <select
                value={form.templateId}
                onChange={(e) => set("templateId", e.target.value)}
                className="w-full mt-0.5 rounded border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">— Tanpa template —</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}{t.isDefault ? " (default)" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Ukuran kertas */}
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
        </div>

        {/* Action buttons */}
        <div className="space-y-2">
          {form.status === "draft" && (
            <>
              <button
                type="button"
                onClick={() => handleSave("draft")}
                disabled={pending}
                className="w-full rounded-md border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted/40 disabled:opacity-60"
              >
                {pending ? "Menyimpan..." : "Simpan Draft"}
              </button>
              <button
                type="button"
                onClick={() => handleSave("sent")}
                disabled={pending}
                className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {pending ? "Memproses..." : "Kirim Surat"}
              </button>
            </>
          )}
          {form.status === "sent" && (
            <>
              <button
                type="button"
                onClick={() => handleSave("sent")}
                disabled={pending}
                className="w-full rounded-md border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted/40 disabled:opacity-60"
              >
                {pending ? "Menyimpan..." : "Simpan Perubahan"}
              </button>
              <button
                type="button"
                onClick={() => handleSave("draft")}
                disabled={pending}
                className="w-full rounded-md border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted/40 disabled:opacity-60"
              >
                {pending ? "Memproses..." : "Jadikan Draft"}
              </button>
            </>
          )}
          {form.status === "archived" && (
            <>
              <button
                type="button"
                onClick={() => handleSave("archived")}
                disabled={pending}
                className="w-full rounded-md border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted/40 disabled:opacity-60"
              >
                {pending ? "Menyimpan..." : "Simpan Perubahan"}
              </button>
              <button
                type="button"
                onClick={() => handleSave("sent")}
                disabled={pending}
                className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {pending ? "Memproses..." : "Aktifkan Kembali"}
              </button>
            </>
          )}

          {/* Arsipkan — tersedia untuk draft & sent */}
          {form.status !== "archived" && (
            <button
              type="button"
              onClick={() => handleSave("archived")}
              disabled={pending}
              className="w-full rounded-md border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted/40 disabled:opacity-60"
            >
              Arsipkan
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
