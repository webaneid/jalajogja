"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil, Trash2, X, Check, BookUser } from "lucide-react";
import {
  createLetterContactAction,
  updateLetterContactAction,
  deleteLetterContactAction,
} from "@/app/(dashboard)/[tenant]/letters/actions";

type Contact = {
  id:           string;
  name:         string;
  title:        string | null;
  organization: string | null;
  address:      string | null;
  email:        string | null;
  phone:        string | null;
};

type Props = {
  slug:            string;
  initialContacts: Contact[];
};

const EMPTY = {
  name: "", title: "", organization: "", address: "", email: "", phone: "",
};

export function LetterContactManageClient({ slug, initialContacts }: Props) {
  const [contacts,  setContacts]  = useState<Contact[]>(initialContacts);
  const [showForm,  setShowForm]  = useState(false);
  const [editId,    setEditId]    = useState<string | null>(null);
  const [form,      setForm]      = useState(EMPTY);
  const [error,     setError]     = useState("");
  const [pending,   startTransition] = useTransition();

  function openNew() {
    setEditId(null);
    setForm(EMPTY);
    setError("");
    setShowForm(true);
  }

  function openEdit(c: Contact) {
    setEditId(c.id);
    setForm({
      name:         c.name,
      title:        c.title        ?? "",
      organization: c.organization ?? "",
      address:      c.address      ?? "",
      email:        c.email        ?? "",
      phone:        c.phone        ?? "",
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

  function handleSave() {
    if (!form.name.trim()) { setError("Nama wajib diisi."); return; }
    setError("");

    startTransition(async () => {
      const data = {
        name:         form.name.trim(),
        title:        form.title.trim()        || null,
        organization: form.organization.trim() || null,
        address:      form.address.trim()      || null,
        email:        form.email.trim()        || null,
        phone:        form.phone.trim()        || null,
      };

      if (editId) {
        const res = await updateLetterContactAction(slug, editId, data);
        if (res.success) {
          setContacts((prev) =>
            prev.map((c) => c.id === editId ? { ...c, ...data } : c)
          );
          closeForm();
        } else {
          setError(res.error);
        }
      } else {
        const res = await createLetterContactAction(slug, data);
        if (res.success) {
          setContacts((prev) => [
            ...prev,
            { id: res.contactId, ...data },
          ]);
          closeForm();
        } else {
          setError(res.error);
        }
      }
    });
  }

  function handleDelete(id: string, name: string) {
    if (!confirm(`Hapus kontak "${name}"?`)) return;
    setError("");

    startTransition(async () => {
      const res = await deleteLetterContactAction(slug, id);
      if (res.success) {
        setContacts((prev) => prev.filter((c) => c.id !== id));
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Tombol tambah */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Tambah Kontak
        </button>
      </div>

      {/* Form tambah/edit */}
      {showForm && (
        <div className="rounded-lg border border-border bg-muted/10 p-4 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-medium">{editId ? "Edit Kontak" : "Kontak Baru"}</p>
            <button type="button" onClick={closeForm} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Nama *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Nama lengkap / instansi"
                className="mt-0.5 w-full rounded border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Jabatan</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Direktur, Kepala Dinas, dll"
                className="mt-0.5 w-full rounded border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Instansi / Organisasi</label>
              <input
                type="text"
                value={form.organization}
                onChange={(e) => setForm((f) => ({ ...f, organization: e.target.value }))}
                placeholder="Nama instansi"
                className="mt-0.5 w-full rounded border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Telepon</label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="0274-xxxxxx"
                className="mt-0.5 w-full rounded border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="email@contoh.com"
                className="mt-0.5 w-full rounded border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Alamat</label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="Jl. Contoh No. 1, Kota"
                className="mt-0.5 w-full rounded border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex gap-2 justify-end pt-1">
            <button
              type="button"
              onClick={closeForm}
              className="rounded border border-border px-3 py-1.5 text-sm hover:bg-muted/40"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              <Check className="h-3.5 w-3.5" />
              {editId ? "Simpan Perubahan" : "Tambah Kontak"}
            </button>
          </div>
        </div>
      )}

      {error && !showForm && <p className="text-sm text-destructive">{error}</p>}

      {/* Daftar kontak */}
      {contacts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-12 text-center">
          <BookUser className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">Belum ada kontak tersimpan.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Tambah kontak untuk digunakan sebagai penerima surat keluar atau surat massal.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
          {contacts.map((c) => (
            <div key={c.id} className="flex items-center gap-4 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{c.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {[c.title, c.organization].filter(Boolean).join(", ") || "—"}
                </p>
                {(c.phone || c.email) && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {[c.phone, c.email].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
              {c.address && (
                <p className="text-xs text-muted-foreground max-w-[200px] truncate hidden sm:block">
                  {c.address}
                </p>
              )}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => openEdit(c)}
                  className="text-muted-foreground hover:text-foreground"
                  title="Edit kontak"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(c.id, c.name)}
                  disabled={pending}
                  className="text-muted-foreground hover:text-destructive disabled:opacity-40"
                  title="Hapus kontak"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
