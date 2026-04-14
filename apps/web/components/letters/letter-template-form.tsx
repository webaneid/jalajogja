"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  createLetterTemplateAction,
  updateLetterTemplateAction,
} from "@/app/(dashboard)/[tenant]/letters/actions";
import { TiptapEditor } from "@/components/editor/tiptap-editor";

// ── Variabel merge fields yang tersedia di template surat ──────────────────

const MERGE_VARS = [
  {
    group: "Organisasi",
    vars: [
      { v: "{{org.name}}",    desc: "Nama organisasi" },
      { v: "{{org.address}}", desc: "Alamat organisasi" },
      { v: "{{org.phone}}",   desc: "Telepon organisasi" },
    ],
  },
  {
    group: "Surat",
    vars: [
      { v: "{{letter.number}}",  desc: "Nomor surat" },
      { v: "{{letter.date}}",    desc: "Tanggal surat" },
      { v: "{{letter.subject}}", desc: "Perihal surat" },
    ],
  },
  {
    group: "Penerima",
    vars: [
      { v: "{{recipient.name}}",         desc: "Nama penerima" },
      { v: "{{recipient.title}}",        desc: "Gelar/jabatan penerima" },
      { v: "{{recipient.organization}}", desc: "Instansi penerima" },
      { v: "{{recipient.address}}",      desc: "Alamat penerima" },
    ],
  },
  {
    group: "Penandatangan",
    vars: [
      { v: "{{signer.name}}",     desc: "Nama penandatangan" },
      { v: "{{signer.position}}", desc: "Jabatan penandatangan" },
      { v: "{{signer.division}}", desc: "Divisi penandatangan" },
      { v: "{{signer.qr}}",       desc: "QR verifikasi tanda tangan" },
    ],
  },
  {
    group: "Tanggal",
    vars: [
      { v: "{{today}}",       desc: "Tanggal hari ini (DD/MM/YYYY)" },
      { v: "{{today.roman}}", desc: "Bulan Romawi: I–XII" },
      { v: "{{today.year}}",  desc: "Tahun 4 digit: 2026" },
      { v: "{{today.id}}",    desc: "Format Indonesia: 1 Januari 2026" },
    ],
  },
];

// ── Types ──────────────────────────────────────────────────────────────────

type DefaultValues = {
  name:     string;
  type:     "outgoing" | "internal";
  subject:  string;
  body:     string;
  isActive: boolean;
};

type Props = {
  slug:           string;
  templateId?:    string;
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

// ── Component ──────────────────────────────────────────────────────────────

export function LetterTemplateForm({ slug, templateId, defaultValues }: Props) {
  const router = useRouter();

  const [name,     setName]     = useState(defaultValues?.name     ?? "");
  const [type,     setType]     = useState<"outgoing" | "internal">(defaultValues?.type ?? "outgoing");
  const [subject,  setSubject]  = useState(defaultValues?.subject  ?? "");
  const [body,     setBody]     = useState(defaultValues?.body     ?? "");
  const [isActive, setIsActive] = useState(defaultValues?.isActive ?? true);
  const [varsOpen, setVarsOpen] = useState(false);
  const [error,    setError]    = useState("");
  const [pending,  startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Nama template wajib diisi."); return; }
    setError("");

    startTransition(async () => {
      const data = {
        name:     name.trim(),
        type,
        subject:  subject.trim() || null,
        body:     body.trim() || null,
        isActive,
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
    <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">

      {/* Nama */}
      <div>
        <label className="text-xs text-muted-foreground">
          Nama Template <span className="text-destructive">*</span>
        </label>
        <input
          autoFocus
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="mis. Surat Undangan Rapat"
          className={fieldCls}
        />
      </div>

      {/* Jenis Surat */}
      <div>
        <label className="text-xs text-muted-foreground">Jenis Surat</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as "outgoing" | "internal")}
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
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Perihal default yang akan diisi otomatis"
          className={fieldCls}
        />
      </div>

      {/* Isi Surat — TiptapEditor */}
      <div>
        <label className="text-xs text-muted-foreground block mb-1">Isi Surat (opsional)</label>
        <div className="rounded-md border border-input overflow-hidden">
          <TiptapEditor
            slug={slug}
            content={body || null}
            onChange={(json, _html) => setBody(json)}
            placeholder="Tulis isi template surat... Gunakan {{recipient.name}}, {{letter.date}}, dll"
            editable={true}
          />
        </div>
      </div>

      {/* Panel variabel merge fields — collapsible */}
      <div className="rounded-lg border border-border overflow-hidden">
        <button
          type="button"
          onClick={() => setVarsOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium hover:bg-muted/30 transition-colors"
        >
          <span>Variabel yang bisa digunakan di isi surat</span>
          {varsOpen
            ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
            : <ChevronDown className="h-4 w-4 text-muted-foreground" />
          }
        </button>

        {varsOpen && (
          <div className="px-4 pb-4 pt-1 bg-muted/10 border-t border-border space-y-4">
            {MERGE_VARS.map((group) => (
              <div key={group.group}>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  {group.group}
                </p>
                <div className="space-y-1">
                  {group.vars.map((item) => (
                    <div key={item.v} className="flex items-baseline gap-3 text-xs">
                      <code className="font-mono text-primary shrink-0 w-52">{item.v}</code>
                      <span className="text-muted-foreground">{item.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Toggle aktif */}
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
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
