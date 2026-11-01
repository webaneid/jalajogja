"use client";

// Kelola daftar ASAL KIRIM (gudang / pabrik / toko) — SATU komponen untuk Portal Produsen → Profil (produsen kelola asalnya sendiri) dan
// admin Toko → Asal Kirim (toko + atas nama produsen). Aksi simpan diberikan pemanggil (server action terikat otorisasi masing-masing).
// Doc: docs/arsitektur-alamat.md § 20.
import { useState, useTransition } from "react";
import { MapPin, Plus, Pencil, Trash2, Star } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AddressFields, EMPTY_ADDRESS, type AddressFieldsValue } from "@/components/address/address-fields";
import { MAX_ORIGINS_PER_OWNER, type OriginDTO } from "@/lib/shipping-origins";

export type OriginActions = {
  save: (input: { id?: string; label: string; detail: string; destinationId: number; isDefault: boolean }) => Promise<{ success: true; origins: OriginDTO[] } | { success: false; error: string }>;
  remove: (id: string) => Promise<{ success: true; origins: OriginDTO[] } | { success: false; error: string }>;
  makeDefault: (id: string) => Promise<{ success: true; origins: OriginDTO[] } | { success: false; error: string }>;
};

type Editing = { id?: string; form: AddressFieldsValue } | null;
const toForm = (o: OriginDTO): AddressFieldsValue => ({
  ...EMPTY_ADDRESS, label: o.label, destinationId: o.destination.id, destinationLabel: o.destination.label, detail: o.detail, isDefault: o.isDefault,
});

export function OriginManager({ initial, actions, emptyHint }: { initial: OriginDTO[]; actions: OriginActions; emptyHint?: string }) {
  const [origins, setOrigins] = useState(initial);
  const [editing, setEditing] = useState<Editing>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const apply = (r: { success: true; origins: OriginDTO[] } | { success: false; error: string }, after?: () => void) => {
    if (!r.success) { setError(r.error); return; }
    setError(""); setOrigins(r.origins); after?.();
  };
  const submit = () => {
    if (!editing) return;
    if (!editing.form.destinationId) { setError("Pilih lokasi dari daftar pencarian."); return; }
    const f = editing.form;
    start(async () => apply(await actions.save({ id: editing.id, label: f.label, detail: f.detail, destinationId: f.destinationId!, isDefault: f.isDefault }), () => setEditing(null)));
  };
  const lockDefault = origins.length === 0 || (!!editing?.id && origins.find((o) => o.id === editing.id)?.isDefault === true);

  return (
    <div className="space-y-3">
      {error && !editing && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {origins.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          <MapPin className="mx-auto mb-1 h-5 w-5" />
          {emptyHint ?? "Belum ada asal kirim."}
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {origins.map((o) => (
            <li key={o.id} className="rounded-lg border border-border bg-card p-4 space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">{o.label}</p>
                {o.isDefault && <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Utama</span>}
              </div>
              <p className="text-sm text-muted-foreground">{o.detail}</p>
              <p className="text-xs text-muted-foreground">{o.destination.label}</p>
              <div className="flex flex-wrap gap-2 pt-1">
                <button type="button" onClick={() => { setError(""); setEditing({ id: o.id, form: toForm(o) }); }}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"><Pencil className="h-3.5 w-3.5" /> Ubah</button>
                {!o.isDefault && (
                  <button type="button" disabled={pending} onClick={() => start(async () => apply(await actions.makeDefault(o.id)))}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"><Star className="h-3.5 w-3.5" /> Jadikan utama</button>
                )}
                <button type="button" disabled={pending}
                  onClick={() => { if (window.confirm(`Hapus asal kirim "${o.label}"?`)) start(async () => apply(await actions.remove(o.id))); }}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /> Hapus</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <button type="button" disabled={origins.length >= MAX_ORIGINS_PER_OWNER}
        onClick={() => { setError(""); setEditing({ form: { ...EMPTY_ADDRESS, isDefault: origins.length === 0 } }); }}
        className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50">
        <Plus className="h-4 w-4" /> Tambah Asal Kirim
      </button>

      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Ubah Asal Kirim" : "Tambah Asal Kirim"}</DialogTitle>
            <DialogDescription>Lokasi dipakai menghitung ongkos kirim. Pembeli hanya melihat kota dan provinsi; alamat lengkap hanya untuk label pengiriman.</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <AddressFields variant="origin" value={editing.form} onChange={(form) => setEditing({ ...editing, form })} lockDefault={lockDefault} />
              {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setEditing(null)} className="h-9 rounded-md border border-border px-3 text-sm">Batal</button>
                <button type="button" onClick={submit} disabled={pending}
                  className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">{pending ? "Menyimpan…" : "Simpan"}</button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
