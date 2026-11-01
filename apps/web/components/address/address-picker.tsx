"use client";

// Pemilih alamat kirim tersimpan untuk checkout: kartu alamat (utama terpilih otomatis), tambah, ubah, tautan "Kelola alamat",
// opsi "Ketik alamat lain". TIDAK menyimpan apa pun sendiri — penyimpanan lewat AddressFormDialog (server action, pemilik dari sesi).
// Doc: docs/arsitektur-alamat.md § 18.
import { useState } from "react";
import { MapPin, Pencil, Plus } from "lucide-react";
import { AddressFormDialog, addressToForm, newAddressDraft, type AddressEditing } from "@/components/address/address-form-dialog";
import { displayPhone } from "@/lib/phone";
import { MAX_ADDRESSES_PER_OWNER, type AddressDTO } from "@/lib/address-book";

export function AddressPicker({ slug, addresses, selectedId, manual, onChange, onManual, prefill }: {
  slug: string;
  addresses: AddressDTO[];
  selectedId: string | null;
  /** true = pembeli memilih mengetik alamat sekali pakai (form manual di bawah menggantikan kartu) */
  manual: boolean;
  /** Daftar berubah (tambah/ubah) dan/atau pilihan berubah */
  onChange: (addresses: AddressDTO[], selectedId: string | null) => void;
  onManual: (manual: boolean) => void;
  /** Nilai awal penerima untuk alamat baru (dari data pembeli di langkah 1) */
  prefill?: { name?: string; phone?: string };
}) {
  const [editing, setEditing] = useState<AddressEditing>(null);
  const editingIsDefault = !!editing?.id && addresses.find((x) => x.id === editing.id)?.isDefault === true;

  return (
    <div className="space-y-3">
      {!manual && (
        <>
          {addresses.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              <MapPin className="mx-auto mb-1 h-5 w-5" />
              Belum ada alamat tersimpan. Tambahkan alamat — tersimpan untuk belanja berikutnya.
            </div>
          ) : (
            <ul className="space-y-2">
              {addresses.map((a) => {
                const on = a.id === selectedId;
                return (
                  <li key={a.id}>
                    <label className={`flex cursor-pointer gap-3 rounded-md border p-3 text-sm ${on ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}>
                      <input type="radio" name="saved-address" className="mt-1" checked={on} onChange={() => onChange(addresses, a.id)} />
                      <span className="min-w-0 flex-1 space-y-0.5">
                        <span className="flex items-center gap-2">
                          <span className="font-semibold">{a.label}</span>
                          {a.isDefault && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">Utama</span>}
                        </span>
                        <span className="block">{a.recipientName} · {displayPhone(a.phone)}</span>
                        <span className="block text-muted-foreground">{a.detail}</span>
                        <span className="block text-xs text-muted-foreground">{a.destination.label}</span>
                      </span>
                      <button type="button" aria-label={`Ubah alamat ${a.label}`}
                        onClick={(e) => { e.preventDefault(); setEditing({ id: a.id, form: addressToForm(a) }); }}
                        className="h-fit rounded-md border border-border p-1.5 text-muted-foreground hover:bg-muted">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <button type="button" disabled={addresses.length >= MAX_ADDRESSES_PER_OWNER}
              onClick={() => setEditing(newAddressDraft({ isFirst: addresses.length === 0, recipientName: prefill?.name, phone: prefill?.phone }))}
              className="inline-flex items-center gap-1 text-primary hover:underline disabled:opacity-50">
              <Plus className="h-4 w-4" /> Tambah alamat baru
            </button>
            <a href={`/${slug}/akun/alamat`} className="text-muted-foreground hover:text-foreground hover:underline">Kelola alamat</a>
          </div>
        </>
      )}
      <button type="button" onClick={() => onManual(!manual)} className="text-xs text-muted-foreground hover:text-foreground hover:underline">
        {manual ? "← Pilih dari alamat tersimpan" : "Ketik alamat lain (sekali pakai)"}
      </button>

      <AddressFormDialog slug={slug} editing={editing} onClose={() => setEditing(null)}
        isOnlyOrDefault={addresses.length === 0 || editingIsDefault}
        onSaved={(list, savedId) => { setEditing(null); onChange(list, savedId ?? selectedId); }} />
    </div>
  );
}
