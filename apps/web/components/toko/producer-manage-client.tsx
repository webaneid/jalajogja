"use client";
// Daftar + tambah/ubah produsen (ADMIN-ONLY). Doc: docs/arsitektur-produsen.md.
import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { PhoneInput } from "@/components/ui/phone-input";
import { WilayahSelect, type WilayahValue } from "@/components/ui/wilayah-select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import type { ProducerSourceKind } from "@/lib/producer-resolve";
import { ProducerCard } from "@/components/toko/producer-card";
import type { ProducerView } from "@/lib/producer.server";
import {
  createMemberProducerAction, createCustomProducerAction, updateProducerAction,
  toggleProducerActiveAction, deleteProducerAction, type CustomProducerInput,
} from "@/app/(dashboard)/app/[tenant]/toko/produsen/actions";

export type ProducerItem = {
  view: ProducerView;
  productCount: number;
  edit: { name: string; whatsapp: string; addressDetail: string; provinceId?: number; regencyId?: number; districtId?: number; villageId?: number; postalCode: string; notes: string };
};

const SOURCE_OPTIONS: ComboboxOption[] = [
  { value: "usaha", label: "Usaha anggota" },
  { value: "pesantren", label: "Pesantren milik anggota" },
  { value: "profesional", label: "Profesional anggota" },
];

// ─── Form custom (tambah + ubah) ──────────────────────────────────────────────────────────────────
function CustomForm({ slug, initial, onSubmit, pending, error }: {
  slug: string; initial?: ProducerItem["edit"]; pending: boolean; error: string;
  onSubmit: (input: CustomProducerInput) => void;
}) {
  const [name, setName]   = useState(initial?.name ?? "");
  const [wa, setWa]       = useState(initial?.whatsapp ?? "");
  const [detail, setDetail] = useState(initial?.addressDetail ?? "");
  const [wil, setWil]     = useState<WilayahValue>({ provinceId: initial?.provinceId, regencyId: initial?.regencyId, districtId: initial?.districtId, villageId: initial?.villageId });
  const [postal, setPostal] = useState(initial?.postalCode ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  return (
    <div className="space-y-3">
      <div><Label>Nama produsen <span className="text-destructive">*</span></Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama usaha / produsen" /></div>
      <PhoneInput label="WhatsApp" optional value={wa} onChange={setWa} />
      <div className="space-y-1.5"><Label>Alamat</Label>
        <WilayahSelect tenantSlug={slug} defaultValue={wil} onChange={setWil} />
        <Input value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="Jalan, nomor, RT/RW, gedung…" />
        <Input value={postal} onChange={(e) => setPostal(e.target.value)} placeholder="Kode pos (opsional)" className="max-w-40" />
      </div>
      <div><Label>Catatan</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <DialogFooter>
        <Button disabled={pending} onClick={() => onSubmit({ name, whatsapp: wa, addressDetail: detail, provinceId: wil.provinceId, regencyId: wil.regencyId, districtId: wil.districtId, villageId: wil.villageId, postalCode: postal, notes })}>
          {pending ? "Menyimpan…" : "Simpan"}
        </Button>
      </DialogFooter>
    </div>
  );
}

// ─── Halaman ──────────────────────────────────────────────────────────────────────────────────────
export function ProducerManageClient({ slug, internal, internalProductCount, items }: {
  slug: string; internal: ProducerView; internalProductCount: number; items: ProducerItem[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<ProducerItem | null>(null);

  // Tambah dari anggota
  const [sourceType, setSourceType] = useState<ProducerSourceKind>("usaha");
  const [options, setOptions] = useState<ComboboxOption[]>([]);
  const [sourceId, setSourceId] = useState("");
  const [memberNotes, setMemberNotes] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);

  function search(q: string, type: ProducerSourceKind = sourceType) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const mine = ++seq.current;
      try {
        const res = await fetch(`/api/ref/producer-sources?slug=${encodeURIComponent(slug)}&type=${type}&q=${encodeURIComponent(q)}`);
        const data = await res.json() as { items?: { id: string; name: string; ownerName: string; hasContact: boolean }[] };
        if (mine !== seq.current) return; // respons lama
        setOptions((data.items ?? []).map((i) => ({ value: i.id, label: `${i.name} — pemilik: ${i.ownerName}${i.hasContact ? "" : " (belum ada kontak)"}` })));
      } catch { /* diam — daftar kosong */ }
    }, 250);
  }

  function resetAdd() { setSourceId(""); setOptions([]); setMemberNotes(""); setError(""); }
  function openAdd() { resetAdd(); setAddOpen(true); search("", "usaha"); setSourceType("usaha"); }

  function run(fn: () => Promise<{ success: boolean; error?: string }>, after?: () => void) {
    setError("");
    start(async () => {
      const res = await fn();
      if (!res.success) { setError(res.error ?? "Gagal."); return; }
      after?.();
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <ProducerCard v={internal} productCount={internalProductCount} />
      <p className="text-xs text-muted-foreground -mt-2">
        Produk yang tidak diberi produsen khusus otomatis memakai produsen <b>internal</b> di atas (tenant sendiri).
      </p>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Produsen lain ({items.length})</h2>
        <Button size="sm" onClick={openAdd}><Plus className="h-4 w-4 mr-1" /> Tambah Produsen</Button>
      </div>

      {items.length === 0 && <p className="text-sm text-muted-foreground">Belum ada produsen anggota atau custom.</p>}
      {items.map((it) => (
        <ProducerCard key={it.view.id} v={it.view} productCount={it.productCount} actions={
          <div className="flex gap-2 pt-1 flex-wrap">
            <Button size="sm" variant="outline" onClick={() => { setError(""); setEditing(it); }}>Ubah</Button>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => toggleProducerActiveAction(slug, it.view.id as string))}>
              {it.view.isActive ? "Nonaktifkan" : "Aktifkan"}
            </Button>
            <Button size="sm" variant="outline" disabled={pending || it.productCount > 0}
              title={it.productCount > 0 ? "Dipakai produk — nonaktifkan saja" : undefined}
              onClick={() => { if (window.confirm(`Hapus produsen "${it.view.name}"?`)) run(() => deleteProducerAction(slug, it.view.id as string)); }}>
              Hapus
            </Button>
          </div>
        } />
      ))}
      {error && !addOpen && !editing && <p className="text-sm text-destructive">{error}</p>}

      {/* Tambah */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tambah Produsen</DialogTitle>
            <DialogDescription>Pilih dari anggota tenant ini, atau isi manual jika produsennya bukan anggota.</DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="anggota">
            <TabsList><TabsTrigger value="anggota">Dari Anggota</TabsTrigger><TabsTrigger value="custom">Custom</TabsTrigger></TabsList>
            <TabsContent value="anggota" className="space-y-3 pt-3">
              <div><Label>Jenis</Label>
                <Combobox options={SOURCE_OPTIONS} value={sourceType} onValueChange={(v) => { const t = (v || "usaha") as ProducerSourceKind; setSourceType(t); setSourceId(""); setOptions([]); search("", t); }} />
              </div>
              <div><Label>Pilih</Label>
                <Combobox options={options} value={sourceId} onValueChange={setSourceId} onSearchChange={(q) => search(q)} placeholder="Cari nama / pemilik…" emptyText="Tidak ditemukan di anggota tenant ini." />
              </div>
              <div><Label>Catatan</Label><Textarea value={memberNotes} onChange={(e) => setMemberNotes(e.target.value)} rows={2} /></div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <DialogFooter>
                <Button disabled={pending || !sourceId} onClick={() => run(() => createMemberProducerAction(slug, { sourceType, sourceId, notes: memberNotes }), () => setAddOpen(false))}>
                  {pending ? "Menyimpan…" : "Simpan"}
                </Button>
              </DialogFooter>
            </TabsContent>
            <TabsContent value="custom" className="pt-3">
              <CustomForm slug={slug} pending={pending} error={error}
                onSubmit={(input) => run(() => createCustomProducerAction(slug, input), () => setAddOpen(false))} />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Ubah */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {editing && (
            <>
              <DialogHeader>
                <DialogTitle>Ubah Produsen</DialogTitle>
                <DialogDescription>
                  {editing.view.kind === "member" ? "Produsen anggota: hanya catatan yang bisa diubah (data lain mengikuti profil anggota). Untuk ganti sumber, buat produsen baru." : "Produsen custom."}
                </DialogDescription>
              </DialogHeader>
              {editing.view.kind === "member" ? (
                <MemberNotesForm initial={editing.edit.notes} pending={pending} error={error}
                  onSubmit={(notes) => run(() => updateProducerAction(slug, editing.view.id as string, { name: editing.view.name, notes }), () => setEditing(null))} />
              ) : (
                <CustomForm slug={slug} initial={editing.edit} pending={pending} error={error}
                  onSubmit={(input) => run(() => updateProducerAction(slug, editing.view.id as string, input), () => setEditing(null))} />
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MemberNotesForm({ initial, onSubmit, pending, error }: { initial: string; pending: boolean; error: string; onSubmit: (notes: string) => void }) {
  const [notes, setNotes] = useState(initial);
  return (
    <div className="space-y-3">
      <div><Label>Catatan</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} /></div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <DialogFooter><Button disabled={pending} onClick={() => onSubmit(notes)}>{pending ? "Menyimpan…" : "Simpan"}</Button></DialogFooter>
    </div>
  );
}
