"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  updateLetterAction,
  getNextLetterNumberAction,
} from "@/app/(dashboard)/[tenant]/letters/actions";

type LetterType = { id: string; name: string; code: string | null; defaultCategory: string };
type Template   = { id: string; name: string; type: string; subject: string | null; body: string | null };
type Officer    = { id: string; name: string; position: string; divisionCode: string | null };

type DefaultValues = {
  letterNumber:    string;
  typeId:          string;
  templateId:      string;
  issuerOfficerId: string;
  subject:         string;
  body:            string;
  sender:          string;
  recipient:       string;
  letterDate:      string;
  status:          "draft" | "sent" | "received" | "archived";
  paperSize:       "A4" | "F4" | "Letter";
  mergeFields:     Record<string, string>;
  attachmentUrls:  string[];
};

type Props = {
  slug:          string;
  letterId:      string;
  type:          "outgoing" | "internal";
  letterTypes:   LetterType[];
  templates:     Template[];
  officers:      Officer[];
  defaultValues: DefaultValues;
};

export function LetterForm({ slug, letterId, type, letterTypes, templates, officers, defaultValues }: Props) {
  const router  = useRouter();
  const [form, setForm] = useState(defaultValues);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [generatingNum, setGeneratingNum] = useState(false);

  function set(field: keyof DefaultValues, value: unknown) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleSelectTemplate(templateId: string) {
    set("templateId", templateId);
    if (!templateId) return;
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) return;
    // Terapkan subject + body dari template jika belum diisi
    if (tpl.subject && !form.subject.trim()) {
      set("subject", tpl.subject);
    }
    if (tpl.body && !form.body.trim()) {
      set("body", tpl.body);
    }
  }

  async function handleGenerateNumber() {
    setGeneratingNum(true);
    setError("");
    const selectedType   = letterTypes.find((t) => t.id === form.typeId);
    const selectedOfficer = officers.find((o) => o.id === form.issuerOfficerId);
    const res = await getNextLetterNumberAction(slug, type, {
      typeCode:   selectedType?.code ?? null,
      issuerCode: selectedOfficer?.divisionCode ?? null,
      letterDate: form.letterDate || null,
    });
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
        typeId:          form.typeId          || null,
        templateId:      form.templateId      || null,
        issuerOfficerId: form.issuerOfficerId || null,
        status,
      });
      if (res.success) {
        set("status", status);
      } else {
        setError(res.error);
      }
    });
  }

  const isSent    = form.status === "sent";
  const fieldCls  = "w-full mt-0.5 rounded border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring";

  // Filter templates sesuai type surat
  const relevantTemplates = templates.filter((t) => t.type === type);

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
              placeholder="mis. 001/UD/IKPMJogja/IV/2026"
              className={`flex-1 rounded border border-input bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring`}
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
          <p className="text-xs text-muted-foreground mt-1">
            Pilih <strong>Jenis Surat</strong> dan <strong>Yang Mengeluarkan</strong> sebelum generate nomor.
          </p>
        </div>

        {/* Perihal */}
        <div>
          <label className="text-xs text-muted-foreground">Perihal <span className="text-destructive">*</span></label>
          <input
            type="text"
            value={form.subject}
            onChange={(e) => set("subject", e.target.value)}
            placeholder="Perihal surat"
            className={fieldCls}
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
              className={fieldCls}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Kepada</label>
            <input
              type="text"
              value={form.recipient}
              onChange={(e) => set("recipient", e.target.value)}
              placeholder="Nama penerima / instansi"
              className={fieldCls}
            />
          </div>
        </div>

        {/* Body */}
        <div>
          <label className="text-xs text-muted-foreground">Isi Surat</label>
          <textarea
            rows={14}
            value={form.body}
            onChange={(e) => set("body", e.target.value)}
            placeholder="Tulis isi surat di sini..."
            className={`${fieldCls} resize-y`}
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      {/* Sidebar */}
      <div className="space-y-4">
        <div className="rounded-lg border border-border p-4 space-y-3">
          {/* Status badge */}
          <div>
            <p className="text-xs text-muted-foreground mb-1">Status</p>
            <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium
              ${form.status === "draft"    ? "bg-zinc-100 text-zinc-600"     : ""}
              ${form.status === "sent"     ? "bg-blue-100 text-blue-700"     : ""}
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
              className={fieldCls}
            />
          </div>

          {/* Jenis surat */}
          {letterTypes.length > 0 && (
            <div>
              <label className="text-xs text-muted-foreground">Jenis Surat</label>
              <select
                value={form.typeId}
                onChange={(e) => set("typeId", e.target.value)}
                className={fieldCls}
              >
                <option value="">— Pilih jenis —</option>
                {letterTypes.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Yang Mengeluarkan (untuk generate {issuer_code} di nomor surat) */}
          {officers.length > 0 && (
            <div>
              <label className="text-xs text-muted-foreground">Yang Mengeluarkan</label>
              <select
                value={form.issuerOfficerId}
                onChange={(e) => set("issuerOfficerId", e.target.value)}
                className={fieldCls}
              >
                <option value="">— Pilih pengurus —</option>
                {officers.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} — {o.position}{o.divisionCode ? ` (${o.divisionCode})` : ""}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                Kode divisi digunakan sebagai <code className="font-mono">{"{issuer_code}"}</code> di format nomor.
              </p>
            </div>
          )}

          {/* Template */}
          {relevantTemplates.length > 0 && (
            <div>
              <label className="text-xs text-muted-foreground">Template Isi Surat</label>
              <select
                value={form.templateId}
                onChange={(e) => handleSelectTemplate(e.target.value)}
                className={fieldCls}
              >
                <option value="">— Tanpa template —</option>
                {relevantTemplates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                Memilih template akan mengisi perihal dan isi surat jika masih kosong.
              </p>
            </div>
          )}
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
