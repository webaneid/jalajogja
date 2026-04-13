"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { createOfficerAction, updateOfficerAction, deleteOfficerAction, toggleOfficerActiveAction, type OfficerData } from "@/app/(dashboard)/[tenant]/pengurus/actions";

export type MemberOption = {
  id:           string;
  name:         string;
  memberNumber: string | null;
};

export type DivisionOption = {
  id:   string;
  name: string;
  code: string | null;
};

type Props = {
  slug:      string;
  officerId?: string;        // jika ada = mode edit
  members:   MemberOption[];
  divisions: DivisionOption[];
  defaultValues?: Partial<OfficerData & { memberName?: string }>;
};

export function OfficerForm({ slug, officerId, members, divisions, defaultValues }: Props) {
  const router  = useRouter();
  const isEdit  = !!officerId;

  const [memberOpen,   setMemberOpen]   = useState(false);
  const [divisionOpen, setDivisionOpen] = useState(false);

  const [memberId,    setMemberId]    = useState(defaultValues?.memberId    ?? "");
  const [memberName,  setMemberName]  = useState(defaultValues?.memberName  ?? "");
  const [divisionId,  setDivisionId]  = useState(defaultValues?.divisionId  ?? "");
  const [position,    setPosition]    = useState(defaultValues?.position    ?? "");
  const [periodStart, setPeriodStart] = useState(defaultValues?.periodStart ?? "");
  const [periodEnd,   setPeriodEnd]   = useState(defaultValues?.periodEnd   ?? "");
  const [isActive,    setIsActive]    = useState(defaultValues?.isActive    ?? true);
  const [canSign,     setCanSign]     = useState(defaultValues?.canSign     ?? false);
  const [sortOrder,   setSortOrder]   = useState(String(defaultValues?.sortOrder ?? 0));
  const [error,       setError]       = useState("");
  const [pending, startTransition]    = useTransition();

  const selectedDivision = divisions.find((d) => d.id === divisionId);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!memberId)        { setError("Pilih anggota terlebih dahulu."); return; }
    if (!position.trim()) { setError("Jabatan wajib diisi."); return; }
    if (!periodStart)     { setError("Tanggal mulai wajib diisi."); return; }

    const data: OfficerData = {
      memberId,
      divisionId:  divisionId  || null,
      position:    position.trim(),
      periodStart,
      periodEnd:   periodEnd   || null,
      isActive,
      canSign,
      sortOrder:   parseInt(sortOrder) || 0,
      userId:      null,
    };

    startTransition(async () => {
      const res = isEdit
        ? await updateOfficerAction(slug, officerId!, data)
        : await createOfficerAction(slug, data);

      if (res.success) {
        router.push(`/${slug}/pengurus`);
      } else {
        setError(res.error);
      }
    });
  }

  function handleDelete() {
    if (!confirm("Hapus pengurus ini? Jika sudah pernah menandatangani surat, gunakan 'Non-aktifkan' saja.")) return;
    startTransition(async () => {
      const res = await deleteOfficerAction(slug, officerId!);
      if (res.success) router.push(`/${slug}/pengurus`);
      else setError(res.error);
    });
  }

  function handleToggleActive() {
    startTransition(async () => {
      const res = await toggleOfficerActiveAction(slug, officerId!);
      if (res.success) setIsActive(res.data.isActive);
      else setError(res.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 lg:grid-cols-2 max-w-3xl">
      {/* Kolom kiri */}
      <div className="space-y-4">
        {/* Pilih anggota — Combobox */}
        <div>
          <label className="block text-xs text-muted-foreground mb-1">
            Anggota <span className="text-destructive">*</span>
          </label>
          {isEdit ? (
            <div className="w-full rounded-md border border-input bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              {memberName} <span className="text-xs">(tidak dapat diubah)</span>
            </div>
          ) : (
            <Popover open={memberOpen} onOpenChange={setMemberOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="w-full flex items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-muted/20 focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <span className={memberId ? "text-foreground" : "text-muted-foreground"}>
                    {memberId ? memberName : "Pilih anggota..."}
                  </span>
                  <ChevronsUpDown className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0" align="start">
                <Command>
                  <CommandInput placeholder="Cari nama anggota..." />
                  <CommandList>
                    <CommandEmpty>Anggota tidak ditemukan.</CommandEmpty>
                    <CommandGroup>
                      {members.map((m) => (
                        <CommandItem
                          key={m.id}
                          value={m.name}
                          onSelect={() => {
                            setMemberId(m.id);
                            setMemberName(m.name);
                            setMemberOpen(false);
                          }}
                        >
                          <Check className={`mr-2 h-4 w-4 ${memberId === m.id ? "opacity-100" : "opacity-0"}`} />
                          <div>
                            <p>{m.name}</p>
                            {m.memberNumber && <p className="text-xs text-muted-foreground font-mono">#{m.memberNumber}</p>}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          )}
        </div>

        {/* Jabatan */}
        <div>
          <label className="block text-xs text-muted-foreground mb-1">
            Jabatan <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            placeholder="mis. Ketua Umum, Sekretaris, Bendahara"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {/* Divisi — Combobox */}
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Divisi / Bidang</label>
          <Popover open={divisionOpen} onOpenChange={setDivisionOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="w-full flex items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-muted/20 focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <span className={divisionId ? "text-foreground" : "text-muted-foreground"}>
                  {selectedDivision ? `${selectedDivision.name}${selectedDivision.code ? ` (${selectedDivision.code})` : ""}` : "Tanpa divisi"}
                </span>
                <ChevronsUpDown className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0" align="start">
              <Command>
                <CommandInput placeholder="Cari divisi..." />
                <CommandList>
                  <CommandGroup>
                    <CommandItem value="none" onSelect={() => { setDivisionId(""); setDivisionOpen(false); }}>
                      <Check className={`mr-2 h-4 w-4 ${!divisionId ? "opacity-100" : "opacity-0"}`} />
                      Tanpa divisi
                    </CommandItem>
                    {divisions.map((d) => (
                      <CommandItem
                        key={d.id}
                        value={d.name}
                        onSelect={() => { setDivisionId(d.id); setDivisionOpen(false); }}
                      >
                        <Check className={`mr-2 h-4 w-4 ${divisionId === d.id ? "opacity-100" : "opacity-0"}`} />
                        {d.name} {d.code && <span className="ml-1 font-mono text-xs text-muted-foreground">({d.code})</span>}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Kolom kanan */}
      <div className="space-y-4">
        {/* Periode */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">
              Mulai Jabatan <span className="text-destructive">*</span>
            </label>
            <input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Akhir Jabatan</label>
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              placeholder="Kosong = masih aktif"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>

        {/* Sort order */}
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Urutan Tampil</label>
          <input
            type="number"
            min="0"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {/* Toggle options */}
        <div className="space-y-3 rounded-lg border border-border p-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-input accent-primary"
            />
            <div>
              <p className="text-sm font-medium">Aktif</p>
              <p className="text-xs text-muted-foreground">Tampil di daftar pengurus aktif</p>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={canSign}
              onChange={(e) => setCanSign(e.target.checked)}
              className="h-4 w-4 rounded border-input accent-primary"
            />
            <div>
              <p className="text-sm font-medium">Dapat Menandatangani Surat</p>
              <p className="text-xs text-muted-foreground">Muncul di pilihan penandatangan surat keluar</p>
            </div>
          </label>
        </div>
      </div>

      {/* Error + Actions */}
      <div className="lg:col-span-2 space-y-3">
        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {pending ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : "Tambah Pengurus"}
          </button>

          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted/40"
          >
            Batal
          </button>

          {isEdit && (
            <>
              <button
                type="button"
                onClick={handleToggleActive}
                disabled={pending}
                className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted/40 disabled:opacity-60 ml-auto"
              >
                {isActive ? "Non-aktifkan" : "Aktifkan"}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={pending}
                className="text-sm text-destructive hover:underline disabled:opacity-60"
              >
                Hapus
              </button>
            </>
          )}
        </div>
      </div>
    </form>
  );
}
