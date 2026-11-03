"use client";

// Syarat & Ketentuan Produsen — sisi pengurus. Editor = <TiptapEditor> standar project (sama dengan Post/Produk/Event).
// Versi terbit tidak bisa diedit; "Buat versi baru" menyalin isi lalu menjadi draf. Terbit → semua produsen tanda tangan ulang.
// Doc: docs/arsitektur-portal-produsen.md § 28.
import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Clock, FileText } from "lucide-react";
import { findUnfilledPlaceholders } from "@/lib/producer-terms";
import { TiptapEditor } from "@/components/editor/tiptap-editor";
import { Input } from "@/components/ui/input";
import {
  saveProducerTermDraftAction, discardProducerTermDraftAction, publishProducerTermAction,
} from "./producer-terms-actions";

export type TermActive = { version: number; title: string; publishedAt: string; html: string };
export type TermDraft  = { id: string; title: string; body: string };
export type TermSigner = { producerId: string; name: string; signedAt: string | null };

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function ProducerTermsForm({ slug, active, activeBody, draft, signers, canEdit }: {
  slug: string; active: TermActive | null; activeBody: string | null; draft: TermDraft | null; signers: TermSigner[]; canEdit: boolean;
}) {
  // editing: null = tidak sedang menulis; objek = isi di editor (draf tersimpan atau salinan baru)
  const [editing, setEditing] = useState<{ key: number; title: string; body: string } | null>(
    draft ? { key: 0, title: draft.title, body: draft.body } : null,
  );
  const [confirmPublish, setConfirmPublish] = useState(false);
  // Penanda sisa penyusunan ({{...}}, [PERLU VERIFIKASI HUKUM]) — memblokir tombol Terbitkan (server juga menolak).
  const leftovers = useMemo(() => (editing ? findUnfilledPlaceholders(editing.body) : []), [editing]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, start] = useTransition();

  const signedCount = signers.filter((s) => s.signedAt).length;

  const startNew = () => {
    setError(""); setNotice("");
    setEditing({
      key: Date.now(),
      title: active?.title ?? "Syarat & Ketentuan Produsen",
      body: activeBody ?? "",
    });
  };

  const save = () => {
    if (!editing) return;
    setError(""); setNotice("");
    start(async () => {
      const res = await saveProducerTermDraftAction(slug, { title: editing.title, body: editing.body });
      if (!res.success) setError(res.error); else setNotice("Draf tersimpan.");
    });
  };

  const discard = () => {
    setError(""); setNotice("");
    if (!draft) { setEditing(null); return; }
    start(async () => {
      const res = await discardProducerTermDraftAction(slug, draft.id);
      if (!res.success) setError(res.error); else { setEditing(null); setConfirmPublish(false); }
    });
  };

  const publish = () => {
    if (!editing) return;
    setError(""); setNotice("");
    start(async () => {
      // Simpan dulu isi editor terbaru, baru terbitkan draf yang sama
      const saved = await saveProducerTermDraftAction(slug, { title: editing.title, body: editing.body });
      if (!saved.success) { setError(saved.error); return; }
      const res = await publishProducerTermAction(slug, saved.data.id);
      if (!res.success) { setError(res.error); return; }
      setEditing(null); setConfirmPublish(false);
      setNotice(`Versi ${res.data.version} diterbitkan. Semua produsen perlu menandatangani ulang.`);
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-sm font-semibold">Syarat &amp; Ketentuan Produsen</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Wajib disetujui produsen dengan tanda tangan digital sebelum bisa memakai Portal Produsen. Setiap kali syarat diterbitkan
          ulang (versi baru), <strong>semua produsen harus menandatangani ulang</strong>. Versi yang sudah terbit tidak bisa diedit.
        </p>
      </div>

      {/* Versi berlaku */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-2">
        {active ? (
          <>
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-primary" />
              <span className="font-medium">Versi {active.version} — {active.title}</span>
            </div>
            <p className="text-xs text-muted-foreground">Berlaku sejak {fmt(active.publishedAt)}</p>
            <details className="rounded-md border border-border">
              <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium">Lihat isi versi berlaku</summary>
              <div
                className="prose prose-sm max-w-none border-t border-border px-3 py-3 [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
                dangerouslySetInnerHTML={{ __html: active.html }}
              />
            </details>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Belum ada syarat yang terbit. Selama belum terbit, produsen tidak dikunci.
          </p>
        )}
      </div>

      {/* Editor draf */}
      {canEdit && (editing ? (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {draft ? "Draf" : "Draf baru (belum tersimpan)"}
          </p>
          <Input
            value={editing.title}
            onChange={(e) => setEditing({ ...editing, title: e.target.value })}
            maxLength={200}
            placeholder="Judul syarat & ketentuan"
          />
          <TiptapEditor
            key={editing.key}
            slug={slug}
            content={editing.body || null}
            onChange={(json) => setEditing((cur) => (cur ? { ...cur, body: json } : cur))}
            placeholder="Tulis syarat & ketentuan untuk produsen di sini..."
          />

          {leftovers.length > 0 && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
              <p className="flex items-center gap-1.5 font-semibold"><AlertTriangle className="h-4 w-4" /> {leftovers.length} penanda belum diisi — belum bisa diterbitkan</p>
              <p className="mt-1">Isi nilainya dan hapus catatan penyusun. Isi versi terbit tidak bisa diubah, dan produsen akan membaca teks ini apa adanya.</p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {leftovers.slice(0, 12).map((p) => <li key={p} className="rounded bg-white/70 px-1.5 py-0.5 font-mono text-[11px]">{p}</li>)}
                {leftovers.length > 12 && <li className="px-1 py-0.5">+{leftovers.length - 12} lainnya</li>}
              </ul>
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}
          {notice && <p className="text-xs text-green-700">{notice}</p>}

          {confirmPublish && leftovers.length === 0 ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 space-y-2 text-sm">
              <p>
                Menerbitkan akan <strong>mengunci {signers.length} produsen</strong> sampai mereka menandatangani versi baru ini.
                Lanjutkan?
              </p>
              <div className="flex gap-2">
                <button type="button" disabled={pending} onClick={publish}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50">
                  {pending ? "Menerbitkan..." : "Ya, Terbitkan"}
                </button>
                <button type="button" disabled={pending} onClick={() => setConfirmPublish(false)}
                  className="rounded-md border border-border px-3 py-1.5 text-xs">Batal</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={pending} onClick={save}
                className="rounded-md border border-border px-3 py-1.5 text-xs font-medium disabled:opacity-50">
                {pending ? "Menyimpan..." : "Simpan Draf"}
              </button>
              <button type="button" disabled={pending || leftovers.length > 0} onClick={() => { setError(""); setConfirmPublish(true); }}
                title={leftovers.length > 0 ? "Masih ada penanda yang belum diisi" : undefined}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50">
                Terbitkan
              </button>
              <button type="button" disabled={pending} onClick={discard}
                className="rounded-md px-3 py-1.5 text-xs text-destructive disabled:opacity-50">
                {draft ? "Buang Draf" : "Batal"}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <button type="button" onClick={startNew}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
            {active ? "Buat Versi Baru" : "Tulis Syarat & Ketentuan"}
          </button>
          {notice && <p className="text-xs text-green-700">{notice}</p>}
        </div>
      ))}

      {/* Status tanda tangan versi berlaku */}
      {active && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Tanda tangan versi {active.version} — {signedCount} dari {signers.length} produsen
          </p>
          {signers.length === 0 ? (
            <p className="text-xs text-muted-foreground">Belum ada produsen yang diberi akses login portal.</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border bg-card text-sm">
              {signers.map((s) => (
                <li key={s.producerId} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="truncate">{s.name}</span>
                  {s.signedAt ? (
                    <span className="flex shrink-0 items-center gap-1 text-xs text-green-700">
                      <CheckCircle2 className="h-3.5 w-3.5" /> {fmt(s.signedAt)}
                    </span>
                  ) : (
                    <span className="flex shrink-0 items-center gap-1 text-xs text-amber-700">
                      <Clock className="h-3.5 w-3.5" /> Belum
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
