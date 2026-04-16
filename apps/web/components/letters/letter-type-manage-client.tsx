"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil, Trash2, X, Check } from "lucide-react";
import {
  createLetterTypeAction,
  updateLetterTypeAction,
  deleteLetterTypeAction,
} from "@/app/(dashboard)/[tenant]/letters/actions";

type LetterType = {
  id:              string;
  name:            string;
  code:            string | null;
  description:     string | null; // tidak dipakai, tapi diterima dari server
  defaultCategory: string;
  isActive:        boolean;
  sortOrder:       number;
  identitasLayout: "layout1" | "layout2" | "layout3";
  showLampiran:    boolean;
  dateFormat:      "masehi" | "masehi_hijri" | null;
};

type Props = {
  slug:         string;
  initialTypes: LetterType[];
};

const EMPTY = {
  name: "", code: "", defaultCategory: "UMUM", isActive: true, sortOrder: "0",
  identitasLayout: "layout1" as "layout1" | "layout2" | "layout3",
  showLampiran: true,
  dateFormat: null as "masehi" | "masehi_hijri" | null,
};

export function LetterTypeManageClient({ slug, initialTypes }: Props) {
  const [types,    setTypes]    = useState<LetterType[]>(initialTypes);
  const [showForm, setShowForm] = useState(false);
  const [editId,   setEditId]   = useState<string | null>(null);
  const [form,     setForm]     = useState(EMPTY);
  const [error,    setError]    = useState("");
  const [pending,  startTransition] = useTransition();

  function openNew() {
    setEditId(null);
    setForm(EMPTY);
    setError("");
    setShowForm(true);
  }

  function openEdit(t: LetterType) {
    setEditId(t.id);
    setForm({
      name:            t.name,
      code:            t.code ?? "",
      defaultCategory: t.defaultCategory,
      isActive:        t.isActive,
      sortOrder:       String(t.sortOrder),
      identitasLayout: t.identitasLayout,
      showLampiran:    t.showLampiran,
      dateFormat:      t.dateFormat,
    });
    setError("");
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditId(null);
    setForm(EMPTY);
    setError("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Nama jenis surat wajib diisi."); return; }
    setError("");

    const data = {
      name:            form.name.trim(),
      code:            form.code.trim() || null,
      defaultCategory: form.defaultCategory.trim() || "UMUM",
      isActive:        form.isActive,
      sortOrder:       parseInt(form.sortOrder) || 0,
      identitasLayout: form.identitasLayout,
      // Layout 3 selalu showLampiran=false
      showLampiran:    form.identitasLayout === "layout3" ? false : form.showLampiran,
      dateFormat:      form.dateFormat,
    };

    startTransition(async () => {
      if (editId) {
        const res = await updateLetterTypeAction(slug, editId, data);
        if (res.success) {
          setTypes((prev) => prev.map((t) => t.id === editId ? { ...t, ...data } : t));
          closeForm();
        } else {
          setError(res.error);
        }
      } else {
        const res = await createLetterTypeAction(slug, data);
        if (res.success) {
          setTypes((prev) => [...prev, {
            id: res.typeId, ...data,
            description: null,
            dateFormat: data.dateFormat ?? null,
          }]);
          closeForm();
        } else {
          setError(res.error);
        }
      }
    });
  }

  function handleDelete(typeId: string) {
    if (!confirm("Hapus jenis surat ini?")) return;
    setError("");

    startTransition(async () => {
      const res = await deleteLetterTypeAction(slug, typeId);
      if (res.success) {
        setTypes((prev) => prev.filter((t) => t.id !== typeId));
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      {!showForm && (
        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Tambah Jenis Surat
        </button>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-muted/10 p-4 space-y-3">
          <p className="text-sm font-medium">{editId ? "Edit Jenis Surat" : "Jenis Surat Baru"}</p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Nama <span className="text-destructive">*</span></label>
              <input
                autoFocus
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="mis. Surat Keputusan"
                className="w-full mt-0.5 rounded border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Kode</label>
              <input
                type="text"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="mis. SK"
                className="w-full mt-0.5 rounded border border-input bg-background px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Kategori Nomor Default</label>
              <input
                type="text"
                value={form.defaultCategory}
                onChange={(e) => setForm((f) => ({ ...f, defaultCategory: e.target.value.toUpperCase() }))}
                placeholder="UMUM"
                className="w-full mt-0.5 rounded border border-input bg-background px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Urutan</label>
              <input
                type="number"
                min="0"
                value={form.sortOrder}
                onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
                className="w-full mt-0.5 rounded border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              className="h-4 w-4 rounded accent-primary"
            />
            Aktif
          </label>

          {/* ── Format Identitas Surat ── */}
          <div className="rounded-md border border-border p-3 space-y-3">
            <p className="text-xs font-medium text-muted-foreground">Format Identitas Surat</p>

            {/* Layout */}
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Layout</p>
              <div className="space-y-1.5">
                {(["layout1", "layout2", "layout3"] as const).map((val) => (
                  <label key={val} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="identitasLayout"
                      value={val}
                      checked={form.identitasLayout === val}
                      onChange={() => setForm((f) => ({
                        ...f,
                        identitasLayout: val,
                        // Layout 3: paksa showLampiran=false
                        showLampiran: val === "layout3" ? false : f.showLampiran,
                        // Layout 3: format tanggal tidak relevan (tanggal di bawah TTD)
                      }))}
                      className="accent-primary"
                    />
                    <span>
                      {val === "layout1" && "Layout 1 — Identitas kiri, tanggal kanan (klasik)"}
                      {val === "layout2" && "Layout 2 — Tanggal pojok kanan atas, identitas di bawah"}
                      {val === "layout3" && "Layout 3 — Terpusat: SE, SK, Pengumuman"}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Format tanggal — hanya untuk Layout 1 & 2 */}
            {form.identitasLayout !== "layout3" && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Format Tanggal</p>
                <div className="space-y-1.5">
                  {([
                    { val: null,          label: "Default (ikut pengaturan global)" },
                    { val: "masehi",      label: "Masehi — Yogyakarta, 16 April 2026" },
                    { val: "masehi_hijri", label: "Masehi + Hijriah — dua baris" },
                  ] as const).map(({ val, label }) => (
                    <label key={String(val)} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        name="dateFormat"
                        checked={form.dateFormat === val}
                        onChange={() => setForm((f) => ({ ...f, dateFormat: val }))}
                        className="accent-primary"
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Tampilkan Lampiran — hanya untuk Layout 1 & 2 */}
            {form.identitasLayout !== "layout3" && (
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.showLampiran}
                  onChange={(e) => setForm((f) => ({ ...f, showLampiran: e.target.checked }))}
                  className="h-4 w-4 rounded accent-primary"
                />
                Tampilkan baris Lampiran
              </label>
            )}
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              <Check className="h-3.5 w-3.5" />
              {pending ? "Menyimpan..." : "Simpan"}
            </button>
            <button
              type="button"
              onClick={closeForm}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted/40"
            >
              <X className="h-3.5 w-3.5" />
              Batal
            </button>
          </div>
        </form>
      )}

      {error && !showForm && <p className="text-sm text-destructive">{error}</p>}

      {types.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
          Belum ada jenis surat
        </div>
      ) : (
        <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
          {types
            .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
            .map((t) => (
              <div key={t.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/20">
                <div className="flex items-center gap-3 min-w-0">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{t.name}</p>
                      {t.code && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground">
                          {t.code}
                        </span>
                      )}
                      {!t.isActive && (
                        <span className="rounded-full bg-zinc-100 text-zinc-500 px-2 py-0.5 text-xs">Non-aktif</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Kategori: {t.defaultCategory}
                      {" · "}
                      {t.identitasLayout === "layout1" ? "L1" : t.identitasLayout === "layout2" ? "L2" : "L3"}
                      {t.identitasLayout !== "layout3" && !t.showLampiran && " · tanpa lampiran"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-4">
                  <button
                    type="button"
                    onClick={() => openEdit(t)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(t.id)}
                    disabled={pending}
                    className="text-muted-foreground hover:text-destructive disabled:opacity-40"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
