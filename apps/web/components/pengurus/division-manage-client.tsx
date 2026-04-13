"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil, Trash2, X, Check } from "lucide-react";
import {
  createDivisionAction,
  updateDivisionAction,
  deleteDivisionAction,
  type DivisionData,
} from "@/app/(dashboard)/[tenant]/pengurus/actions";

type Division = {
  id:          string;
  name:        string;
  code:        string | null;
  description: string | null;
  parentId:    string | null;
  sortOrder:   number;
  isActive:    boolean;
  officerCount: number;
};

type Props = {
  slug:               string;
  initialDivisions:   Division[];
};

const EMPTY_FORM = { name: "", code: "", description: "", parentId: "", sortOrder: "0", isActive: true };

export function DivisionManageClient({ slug, initialDivisions }: Props) {
  const [divisions, setDivisions] = useState<Division[]>(initialDivisions);
  const [showForm,  setShowForm]  = useState(false);
  const [editId,    setEditId]    = useState<string | null>(null);
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [error,     setError]     = useState("");
  const [pending, startTransition] = useTransition();

  function openNew() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setError("");
    setShowForm(true);
  }

  function openEdit(div: Division) {
    setEditId(div.id);
    setForm({
      name:        div.name,
      code:        div.code        ?? "",
      description: div.description ?? "",
      parentId:    div.parentId    ?? "",
      sortOrder:   String(div.sortOrder),
      isActive:    div.isActive,
    });
    setError("");
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditId(null);
    setForm(EMPTY_FORM);
    setError("");
  }

  function buildData(): DivisionData {
    return {
      name:        form.name.trim(),
      code:        form.code.trim()        || null,
      description: form.description.trim() || null,
      parentId:    form.parentId           || null,
      sortOrder:   parseInt(form.sortOrder) || 0,
      isActive:    form.isActive,
    };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Nama divisi wajib diisi."); return; }
    setError("");

    startTransition(async () => {
      const data = buildData();

      if (editId) {
        const res = await updateDivisionAction(slug, editId, data);
        if (res.success) {
          setDivisions((prev) =>
            prev.map((d) => d.id === editId ? { ...d, ...data } : d)
          );
          closeForm();
        } else {
          setError(res.error);
        }
      } else {
        const res = await createDivisionAction(slug, data);
        if (res.success) {
          setDivisions((prev) => [
            ...prev,
            { id: res.data.divisionId, ...data, officerCount: 0 },
          ]);
          closeForm();
        } else {
          setError(res.error);
        }
      }
    });
  }

  function handleDelete(divisionId: string) {
    const div = divisions.find((d) => d.id === divisionId);
    if (div && div.officerCount > 0) {
      setError(`Divisi "${div.name}" masih memiliki ${div.officerCount} pengurus.`);
      return;
    }
    if (!confirm("Hapus divisi ini?")) return;
    setError("");

    startTransition(async () => {
      const res = await deleteDivisionAction(slug, divisionId);
      if (res.success) {
        setDivisions((prev) => prev.filter((d) => d.id !== divisionId));
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
          Tambah Divisi
        </button>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-muted/10 p-4 space-y-3">
          <p className="text-sm font-medium">{editId ? "Edit Divisi" : "Divisi Baru"}</p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Nama <span className="text-destructive">*</span></label>
              <input
                autoFocus
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="mis. Bidang Kaderisasi"
                className="w-full mt-0.5 rounded border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Kode</label>
              <input
                type="text"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="mis. SEKR"
                className="w-full mt-0.5 rounded border border-input bg-background px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Deskripsi</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full mt-0.5 rounded border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
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
            <div className="flex items-end pb-1.5">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  className="h-4 w-4 rounded accent-primary"
                />
                Aktif
              </label>
            </div>
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

      {divisions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
          Belum ada divisi / bidang
        </div>
      ) : (
        <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
          {divisions
            .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
            .map((div) => (
              <div key={div.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/20">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{div.name}</p>
                      {div.code && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground shrink-0">
                          {div.code}
                        </span>
                      )}
                      {!div.isActive && (
                        <span className="rounded-full bg-zinc-100 text-zinc-500 px-2 py-0.5 text-xs shrink-0">
                          Non-aktif
                        </span>
                      )}
                    </div>
                    {div.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{div.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <span className="text-xs text-muted-foreground">{div.officerCount} pengurus</span>
                  <button
                    type="button"
                    onClick={() => openEdit(div)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(div.id)}
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
