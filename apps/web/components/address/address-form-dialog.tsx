"use client";

// Dialog tambah/ubah alamat kirim — SATU komponen untuk halaman Alamat Kirim (/akun/alamat) DAN checkout. Menyimpan lewat
// server action buku alamat (pemilik dari sesi). Doc: docs/arsitektur-alamat.md § 16, § 18.
import { useState, useTransition } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AddressFields, EMPTY_ADDRESS, type AddressFieldsValue } from "@/components/address/address-fields";
import { saveAddressAction } from "@/app/(public)/[tenant]/akun/alamat/actions";
import type { AddressDTO } from "@/lib/address-book";

export const addressToForm = (a: AddressDTO): AddressFieldsValue => ({
  label: a.label, recipientName: a.recipientName, phone: a.phone, destinationId: a.destination.id,
  destinationLabel: a.destination.label, detail: a.detail, isDefault: a.isDefault,
});

export type AddressEditing = { id?: string; form: AddressFieldsValue } | null;

/** Nilai awal untuk "tambah alamat baru". */
export const newAddressDraft = (opts: { isFirst: boolean; recipientName?: string; phone?: string }): AddressEditing => ({
  form: { ...EMPTY_ADDRESS, isDefault: opts.isFirst, recipientName: opts.recipientName ?? "", phone: opts.phone ?? "" },
});

export function AddressFormDialog({ slug, editing, onClose, onSaved, isOnlyOrDefault }: {
  slug: string;
  editing: AddressEditing;
  onClose: () => void;
  /** Dipanggil dengan daftar terbaru + id alamat yang baru disimpan. */
  onSaved: (addresses: AddressDTO[], savedId: string | null) => void;
  /** true = alamat ini satu-satunya / sudah utama (kotak "alamat utama" dikunci) */
  isOnlyOrDefault: boolean;
}) {
  const [form, setForm] = useState<AddressFieldsValue | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  // Reset state lokal tiap dialog dibuka dengan target baru
  const [lastKey, setLastKey] = useState<string | null>(null);
  const key = editing ? (editing.id ?? "new") : null;
  if (key !== lastKey) { setLastKey(key); setForm(editing ? editing.form : null); setError(""); }

  const submit = () => {
    if (!editing || !form) return;
    if (!form.destinationId) { setError("Pilih lokasi dari daftar pencarian."); return; }
    start(async () => {
      const r = await saveAddressAction(slug, { ...form, id: editing.id });
      if (!r.success) { setError(r.error); return; }
      onSaved(r.addresses, r.savedId ?? null);
    });
  };

  return (
    <Dialog open={!!editing} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing?.id ? "Ubah Alamat" : "Tambah Alamat"}</DialogTitle>
          <DialogDescription>Alamat ini hanya bisa dilihat oleh Anda; penjual hanya menerima salinannya saat Anda memesan.</DialogDescription>
        </DialogHeader>
        {editing && form && (
          <div className="space-y-4">
            <AddressFields value={form} onChange={setForm} lockDefault={isOnlyOrDefault} />
            {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="h-9 rounded-md border border-border px-3 text-sm">Batal</button>
              <button type="button" onClick={submit} disabled={pending}
                className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">
                {pending ? "Menyimpan…" : "Simpan"}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
