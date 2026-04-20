"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Eye, EyeOff, ShieldCheck } from "lucide-react";
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
import {
  createOfficerWithAccountAction,
  updateOfficerAction,
  deleteOfficerAction,
  toggleOfficerActiveAction,
  type OfficerData,
} from "@/app/(dashboard)/[tenant]/pengurus/actions";

export type MemberOption = {
  id:           string;
  name:         string;
  memberNumber: string | null;
  email:        string | null; // dari contacts
};

export type DivisionOption = {
  id:   string;
  name: string;
  code: string | null;
};

export type CustomRoleOption = {
  id:   string;
  name: string;
};

const SYSTEM_ROLES = [
  { value: "ketua",       label: "Ketua" },
  { value: "sekretaris",  label: "Sekretaris" },
  { value: "bendahara",   label: "Bendahara" },
  { value: "custom",      label: "Role Kustom..." },
] as const;

type Props = {
  slug:         string;
  officerId?:   string;
  members:      MemberOption[];
  divisions:    DivisionOption[];
  customRoles:  CustomRoleOption[];
  defaultValues?: Partial<OfficerData & { memberName?: string }>;
};

const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring";

export function OfficerForm({ slug, officerId, members, divisions, customRoles, defaultValues }: Props) {
  const router  = useRouter();
  const isEdit  = !!officerId;

  // ── Officer fields ──────────────────────────────────────────────────────
  const [memberOpen,   setMemberOpen]   = useState(false);
  const [divisionOpen, setDivisionOpen] = useState(false);

  const [memberId,    setMemberId]    = useState(defaultValues?.memberId    ?? "");
  const [memberName,  setMemberName]  = useState(defaultValues?.memberName  ?? "");
  const [memberEmail, setMemberEmail] = useState<string | null>(null);
  const [divisionId,  setDivisionId]  = useState(defaultValues?.divisionId  ?? "");
  const [position,    setPosition]    = useState(defaultValues?.position    ?? "");
  const [periodStart, setPeriodStart] = useState(defaultValues?.periodStart ?? "");
  const [periodEnd,   setPeriodEnd]   = useState(defaultValues?.periodEnd   ?? "");
  const [isActive,    setIsActive]    = useState(defaultValues?.isActive    ?? true);
  const [canSign,     setCanSign]     = useState(defaultValues?.canSign     ?? false);
  const [sortOrder,   setSortOrder]   = useState(String(defaultValues?.sortOrder ?? 0));

  // ── Aktivasi akun ───────────────────────────────────────────────────────
  const [activate,       setActivate]       = useState(false);
  const [roleOpen,       setRoleOpen]        = useState(false);
  const [customRoleOpen, setCustomRoleOpen]  = useState(false);
  const [activationRole, setActivationRole]  = useState<string>("");
  const [customRoleId,   setCustomRoleId]    = useState("");
  const [password,       setPassword]        = useState("");
  const [showPassword,   setShowPassword]    = useState(false);

  const [error,   setError]   = useState("");
  const [pending, startTransition] = useTransition();

  const selectedDivision   = divisions.find((d) => d.id === divisionId);
  const selectedRole       = SYSTEM_ROLES.find((r) => r.value === activationRole);
  const selectedCustomRole = customRoles.find((r) => r.id === customRoleId);

  function handleMemberSelect(m: MemberOption) {
    setMemberId(m.id);
    setMemberName(m.name);
    setMemberEmail(m.email ?? null);
    setMemberOpen(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!memberId)        { setError("Pilih anggota terlebih dahulu."); return; }
    if (!position.trim()) { setError("Jabatan wajib diisi."); return; }
    if (!periodStart)     { setError("Tanggal mulai wajib diisi."); return; }

    if (activate && !isEdit) {
      if (!activationRole)   { setError("Pilih role dashboard."); return; }
      if (activationRole === "custom" && !customRoleId) { setError("Pilih role kustom."); return; }
      if (password.length < 8) { setError("Password minimal 8 karakter."); return; }
      if (!memberEmail)        { setError("Anggota ini tidak memiliki email. Tambahkan email di profil anggota terlebih dahulu."); return; }
    }

    const officerData: OfficerData = {
      memberId,
      divisionId:  divisionId || null,
      position:    position.trim(),
      periodStart,
      periodEnd:   periodEnd || null,
      isActive,
      canSign,
      sortOrder:   parseInt(sortOrder) || 0,
      userId:      null,
    };

    startTransition(async () => {
      if (isEdit) {
        const res = await updateOfficerAction(slug, officerId!, officerData);
        if (res.success) router.push(`/${slug}/pengurus`);
        else setError(res.error);
        return;
      }

      // Mode buat baru — pakai action combined
      const res = await createOfficerWithAccountAction(slug, {
        ...officerData,
        activate,
        activationEmail:        activate ? memberEmail! : undefined,
        activationPassword:     activate ? password     : undefined,
        activationRole:         activate ? (activationRole as "ketua" | "sekretaris" | "bendahara" | "custom") : undefined,
        activationCustomRoleId: activate && activationRole === "custom" ? customRoleId : undefined,
        activationName:         activate ? memberName : undefined,
      });

      if (res.success) router.push(`/${slug}/pengurus`);
      else setError(res.error);
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
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">

      {/* ── Data Pengurus ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Kolom kiri */}
        <div className="space-y-4">
          {/* Pilih anggota */}
          <div>
            <label className="block text-xs text-muted-foreground mb-1">
              Anggota <span className="text-destructive">*</span>
            </label>
            {isEdit ? (
              <div className={`${inputCls} bg-muted/30 text-muted-foreground`}>
                {memberName} <span className="text-xs">(tidak dapat diubah)</span>
              </div>
            ) : (
              <Popover open={memberOpen} onOpenChange={setMemberOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={`${inputCls} flex items-center justify-between hover:bg-muted/20`}
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
                            onSelect={() => handleMemberSelect(m)}
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
              className={inputCls}
            />
          </div>

          {/* Divisi */}
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Divisi / Bidang</label>
            <Popover open={divisionOpen} onOpenChange={setDivisionOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={`${inputCls} flex items-center justify-between hover:bg-muted/20`}
                >
                  <span className={divisionId ? "text-foreground" : "text-muted-foreground"}>
                    {selectedDivision
                      ? `${selectedDivision.name}${selectedDivision.code ? ` (${selectedDivision.code})` : ""}`
                      : "Tanpa divisi"}
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
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Akhir Jabatan</label>
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className={inputCls}
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
              className={inputCls}
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
      </div>

      {/* ── Aktivasi Akun Dashboard (hanya mode baru) ── */}
      {!isEdit && (
        <div className="rounded-xl border border-border bg-muted/30 p-5 space-y-4">
          {/* Toggle header */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={activate}
              onChange={(e) => setActivate(e.target.checked)}
              className="h-4 w-4 rounded border-input accent-primary"
            />
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" />
              <div>
                <p className="text-sm font-semibold">Aktifkan Akses Dashboard</p>
                <p className="text-xs text-muted-foreground">
                  Pengurus langsung bisa login ke dashboard dengan role yang ditentukan.
                </p>
              </div>
            </div>
          </label>

          {activate && (
            <div className="space-y-4 pt-1 border-t">
              {/* Email — read-only dari profil anggota */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  Email Login <span className="text-destructive">*</span>
                </label>
                {memberEmail ? (
                  <div className={`${inputCls} bg-muted/50 text-muted-foreground cursor-not-allowed`}>
                    {memberEmail}
                    <span className="ml-2 text-xs">(dari profil anggota)</span>
                  </div>
                ) : memberId ? (
                  <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                    Anggota ini belum memiliki email. Tambahkan email di profil anggota terlebih dahulu.
                  </div>
                ) : (
                  <div className={`${inputCls} bg-muted/30 text-muted-foreground`}>
                    Pilih anggota dulu untuk melihat email
                  </div>
                )}
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  Password <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimal 8 karakter"
                    className={`${inputCls} pr-10`}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Pengurus bisa ubah password sendiri setelah login pertama.
                </p>
              </div>

              {/* Role dashboard */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">
                    Role Dashboard <span className="text-destructive">*</span>
                  </label>
                  <Popover open={roleOpen} onOpenChange={setRoleOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className={`${inputCls} flex items-center justify-between hover:bg-muted/20`}
                      >
                        <span className={activationRole ? "text-foreground" : "text-muted-foreground"}>
                          {selectedRole?.label ?? "Pilih role..."}
                        </span>
                        <ChevronsUpDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-48 p-0" align="start">
                      <div className="py-1">
                        {SYSTEM_ROLES.map((r) => (
                          <button
                            key={r.value}
                            type="button"
                            onClick={() => { setActivationRole(r.value); setRoleOpen(false); if (r.value !== "custom") setCustomRoleId(""); }}
                            className={`flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-accent ${activationRole === r.value ? "bg-accent" : ""}`}
                          >
                            <Check className={`size-4 ${activationRole === r.value ? "opacity-100" : "opacity-0"}`} />
                            {r.label}
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Custom role — muncul jika pilih "custom" */}
                {activationRole === "custom" && (
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">
                      Role Kustom <span className="text-destructive">*</span>
                    </label>
                    {customRoles.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic pt-2">
                        Belum ada role kustom. Buat di Pengaturan → Role.
                      </p>
                    ) : (
                      <Popover open={customRoleOpen} onOpenChange={setCustomRoleOpen}>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className={`${inputCls} flex items-center justify-between hover:bg-muted/20`}
                          >
                            <span className={customRoleId ? "text-foreground" : "text-muted-foreground"}>
                              {selectedCustomRole?.name ?? "Pilih role kustom..."}
                            </span>
                            <ChevronsUpDown className="h-4 w-4 text-muted-foreground shrink-0" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Cari role..." />
                            <CommandList>
                              <CommandEmpty>Tidak ditemukan.</CommandEmpty>
                              <CommandGroup>
                                {customRoles.map((r) => (
                                  <CommandItem
                                    key={r.id}
                                    value={r.name}
                                    onSelect={() => { setCustomRoleId(r.id); setCustomRoleOpen(false); }}
                                  >
                                    <Check className={`mr-2 h-4 w-4 ${customRoleId === r.id ? "opacity-100" : "opacity-0"}`} />
                                    {r.name}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error + Actions */}
      <div className="space-y-3">
        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {pending
              ? "Menyimpan..."
              : isEdit
                ? "Simpan Perubahan"
                : activate ? "Tambah Pengurus & Aktifkan Akun" : "Tambah Pengurus"}
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
