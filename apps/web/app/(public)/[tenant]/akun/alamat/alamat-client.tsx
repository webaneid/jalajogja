"use client";

import { useState, useTransition } from "react";
import { MapPin, Plus, Pencil, Trash2, Star } from "lucide-react";
import { AddressFormDialog, addressToForm, newAddressDraft, type AddressEditing } from "@/components/address/address-form-dialog";
import { displayPhone } from "@/lib/phone";
import { MAX_ADDRESSES_PER_OWNER, type AddressDTO } from "@/lib/address-book";
import { deleteAddressAction, setDefaultAddressAction } from "./actions";

export function AlamatClient({ slug, initial }: { slug: string; initial: AddressDTO[] }) {
  const [addresses, setAddresses] = useState(initial);
  const [editing, setEditing] = useState<AddressEditing>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const apply = (r: { success: true; addresses: AddressDTO[] } | { success: false; error: string }) => {
    if (!r.success) { setError(r.error); return; }
    setError(""); setAddresses(r.addresses);
  };
  const editingIsDefault = !!editing?.id && addresses.find((x) => x.id === editing.id)?.isDefault === true;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Alamat Kirim</h1>
          <p className="text-sm text-muted-foreground">
            Simpan alamat kirim sekali, pakai berkali-kali saat berbelanja di organisasi mana pun.
          </p>
        </div>
        <button type="button" disabled={addresses.length >= MAX_ADDRESSES_PER_OWNER}
          onClick={() => { setError(""); setEditing(newAddressDraft({ isFirst: addresses.length === 0 })); }}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50">
          <Plus className="h-4 w-4" /> Tambah Alamat
        </button>
      </div>

      {error && !editing && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {addresses.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          <MapPin className="mx-auto mb-2 h-6 w-6" />
          Belum ada alamat tersimpan. Tambahkan alamat pertama Anda.
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {addresses.map((a) => (
            <li key={a.id} className="rounded-lg border border-border bg-card p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">{a.label}</p>
                  <p className="text-sm">{a.recipientName} · {displayPhone(a.phone)}</p>
                </div>
                {a.isDefault && (
                  <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Utama</span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{a.detail}</p>
              <p className="text-xs text-muted-foreground">{a.destination.label}</p>
              <div className="flex flex-wrap gap-2 pt-1">
                <button type="button" onClick={() => { setError(""); setEditing({ id: a.id, form: addressToForm(a) }); }}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted">
                  <Pencil className="h-3.5 w-3.5" /> Ubah
                </button>
                {!a.isDefault && (
                  <button type="button" disabled={pending}
                    onClick={() => start(async () => apply(await setDefaultAddressAction(slug, a.id)))}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50">
                    <Star className="h-3.5 w-3.5" /> Jadikan utama
                  </button>
                )}
                <button type="button" disabled={pending}
                  onClick={() => { if (window.confirm(`Hapus alamat "${a.label}"?`)) start(async () => apply(await deleteAddressAction(slug, a.id))); }}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50">
                  <Trash2 className="h-3.5 w-3.5" /> Hapus
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AddressFormDialog slug={slug} editing={editing} onClose={() => setEditing(null)}
        isOnlyOrDefault={addresses.length === 0 || editingIsDefault}
        onSaved={(list) => { setAddresses(list); setError(""); setEditing(null); }} />
    </div>
  );
}
