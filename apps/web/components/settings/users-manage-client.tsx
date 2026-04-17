"use client";

import { useState, useTransition } from "react";
import {
  UserPlus, Copy, Check, Trash2, Link2, Clock,
  ChevronDown, Shield, UserCheck, Eye, EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  createInviteAction,
  revokeInviteAction,
  removeUserAction,
  activateUserDirectAction,
} from "@/app/(dashboard)/[tenant]/settings/actions";
import { Input } from "@/components/ui/input";

// ─── Types ────────────────────────────────────────────────────────────────────

type UserRow = {
  id:             string;
  name:           string;
  email:          string | null;
  role:           string;
  customRoleName: string | null;
  memberId:       string | null;
  isCurrentUser:  boolean;
  createdAt:      string;
};

type InviteRow = {
  id:             string;
  memberName:     string;
  email:          string | null;
  role:           string;
  customRoleName: string | null;
  token:          string;
  expiresAt:      string;
  acceptedAt:     string | null;
  deliveryMethod: string;
};

type AvailableMember = {
  id:           string;
  name:         string;
  memberNumber: string | null;
  email:        string | null;
};

type CustomRole = {
  id:   string;
  name: string;
};

type Props = {
  slug:             string;
  currentUserId:    string;
  users:            UserRow[];
  invites:          InviteRow[];
  availableMembers: AvailableMember[];
  customRoles:      CustomRole[];
  appUrl:           string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  owner:      "Owner",
  ketua:      "Ketua",
  sekretaris: "Sekretaris",
  bendahara:  "Bendahara",
  custom:     "Kustom",
};

const ROLE_COLORS: Record<string, string> = {
  owner:      "bg-purple-100 text-purple-800",
  ketua:      "bg-blue-100 text-blue-800",
  sekretaris: "bg-green-100 text-green-800",
  bendahara:  "bg-orange-100 text-orange-800",
  custom:     "bg-gray-100 text-gray-800",
};

// ─── Main Component ───────────────────────────────────────────────────────────

export function UsersManageClient({
  slug,
  currentUserId,
  users: initialUsers,
  invites: initialInvites,
  availableMembers,
  customRoles,
  appUrl,
}: Props) {
  const [users, setUsers] = useState(initialUsers);
  const [invites, setInvites] = useState(initialInvites);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [newInviteLink, setNewInviteLink] = useState<string | null>(null);
  const [activatedName, setActivatedName] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function copyLink(link: string) {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function buildInviteLink(token: string) {
    return `${appUrl}/${slug}/invite?token=${token}`;
  }

  function inviteStatus(invite: InviteRow): "accepted" | "expired" | "pending" {
    if (invite.acceptedAt) return "accepted";
    if (new Date(invite.expiresAt) < new Date()) return "expired";
    return "pending";
  }

  function handleRevoke(inviteId: string) {
    startTransition(async () => {
      const res = await revokeInviteAction(slug, inviteId);
      if (res.success) {
        setInvites((prev) => prev.filter((i) => i.id !== inviteId));
      }
    });
  }

  function handleRemoveUser(userId: string) {
    if (!confirm("Hapus akses pengguna ini dari dashboard?")) return;
    startTransition(async () => {
      const res = await removeUserAction(slug, userId);
      if (res.success) {
        setUsers((prev) => prev.filter((u) => u.id !== userId));
      } else if (!res.success) {
        alert(res.error);
      }
    });
  }

  const pendingInvites  = invites.filter((i) => inviteStatus(i) === "pending");
  const resolvedInvites = invites.filter((i) => inviteStatus(i) !== "pending");

  return (
    <div className="space-y-8">
      {/* ── Pengguna Aktif ────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Pengguna Aktif ({users.length})</h3>
          <Button
            size="sm"
            variant="outline"
            onClick={() => { setNewInviteLink(null); setError(""); setShowInviteDialog(true); }}
            disabled={availableMembers.length === 0}
          >
            <UserPlus className="h-4 w-4 mr-1.5" />
            Undang Pengurus
          </Button>
        </div>

        <div className="rounded-lg border border-border divide-y divide-border">
          {users.map((u) => (
            <div key={u.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              {/* Avatar inisial */}
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center
                              text-xs font-semibold text-muted-foreground shrink-0">
                {u.name.charAt(0).toUpperCase()}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium truncate">{u.name}</span>
                  {u.isCurrentUser && (
                    <span className="text-xs text-muted-foreground">(Anda)</span>
                  )}
                </div>
                {u.email && (
                  <span className="text-xs text-muted-foreground">{u.email}</span>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium
                                  ${ROLE_COLORS[u.role] ?? "bg-gray-100 text-gray-800"}`}>
                  {u.role === "custom" && u.customRoleName
                    ? u.customRoleName
                    : (ROLE_LABELS[u.role] ?? u.role)}
                </span>

                {u.role !== "owner" && !u.isCurrentUser && (
                  <button
                    onClick={() => handleRemoveUser(u.id)}
                    disabled={isPending}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1"
                    title="Hapus akses"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}

          {users.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              Belum ada pengguna.
            </div>
          )}
        </div>
      </section>

      {/* ── Undangan ─────────────────────────────────────────────────────── */}
      {pendingInvites.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Undangan Tertunda ({pendingInvites.length})</h3>

          <div className="rounded-lg border border-border divide-y divide-border">
            {pendingInvites.map((invite) => {
              const link = buildInviteLink(invite.token);
              const expDate = new Date(invite.expiresAt).toLocaleDateString("id-ID", {
                day: "numeric", month: "short", year: "numeric",
              });

              return (
                <div key={invite.id} className="px-4 py-3 space-y-2 text-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{invite.memberName}</span>
                      {invite.email && (
                        <span className="ml-2 text-muted-foreground text-xs">{invite.email}</span>
                      )}
                    </div>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium
                                      ${ROLE_COLORS[invite.role] ?? "bg-gray-100 text-gray-800"}`}>
                      {invite.role === "custom" && invite.customRoleName
                        ? invite.customRoleName
                        : (ROLE_LABELS[invite.role] ?? invite.role)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0 flex items-center gap-1.5 rounded border border-border
                                    bg-muted/30 px-2 py-1.5 text-xs font-mono truncate">
                      <Link2 className="h-3 w-3 shrink-0 text-muted-foreground" />
                      <span className="truncate text-muted-foreground">{link}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 shrink-0"
                      onClick={() => copyLink(link)}
                    >
                      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </Button>
                    <button
                      onClick={() => handleRevoke(invite.id)}
                      disabled={isPending}
                      className="text-muted-foreground hover:text-destructive transition-colors p-1"
                      title="Batalkan undangan"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Berlaku sampai {expDate}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Riwayat undangan diterima / kadaluarsa ───────────────────────── */}
      {resolvedInvites.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">
            Riwayat Undangan ({resolvedInvites.length})
          </h3>
          <div className="rounded-lg border border-border divide-y divide-border text-sm">
            {resolvedInvites.map((invite) => {
              const status = inviteStatus(invite);
              return (
                <div key={invite.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 text-muted-foreground">
                    {invite.memberName}
                    {invite.email && (
                      <span className="ml-1.5 text-xs">({invite.email})</span>
                    )}
                  </div>
                  <Badge variant={status === "accepted" ? "default" : "secondary"} className="text-xs">
                    {status === "accepted" ? (
                      <><UserCheck className="h-3 w-3 mr-1" />Diterima</>
                    ) : (
                      "Kadaluarsa"
                    )}
                  </Badge>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Invite Dialog ─────────────────────────────────────────────────── */}
      <InviteDialog
        slug={slug}
        open={showInviteDialog}
        onClose={() => { setShowInviteDialog(false); }}
        availableMembers={availableMembers}
        customRoles={customRoles}
        appUrl={appUrl}
        onInviteCreated={(token, invite) => {
          setNewInviteLink(buildInviteLink(token));
          setActivatedName(null);
          setInvites((prev) => [...prev, invite]);
          setShowInviteDialog(false);
        }}
        onActivated={(name, userRow) => {
          setActivatedName(name);
          setNewInviteLink(null);
          setUsers((prev) => [...prev, userRow]);
          setShowInviteDialog(false);
        }}
      />

      {/* ── Link baru yang baru dibuat ────────────────────────────────────── */}
      {newInviteLink && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 space-y-2">
          <p className="text-sm font-medium text-green-800">Undangan berhasil dibuat</p>
          <p className="text-xs text-green-700">
            Salin link di bawah dan kirim ke calon pengurus secara manual:
          </p>
          <div className="flex gap-2">
            <div className="flex-1 min-w-0 rounded border border-green-200 bg-white
                            px-3 py-2 text-xs font-mono text-muted-foreground truncate">
              {newInviteLink}
            </div>
            <Button size="sm" variant="outline" onClick={() => copyLink(newInviteLink)} className="shrink-0">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}

      {/* ── Aktivasi langsung berhasil ───────────────────────────────────── */}
      {activatedName && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="text-sm font-medium text-green-800">
            Akun <span className="font-semibold">{activatedName}</span> berhasil diaktifkan
          </p>
          <p className="text-xs text-green-700 mt-0.5">
            Pengguna sekarang bisa login dengan email dan password yang sudah diset.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Invite Dialog ────────────────────────────────────────────────────────────

type InviteMethod = "link" | "direct";

function InviteDialog({
  slug,
  open,
  onClose,
  availableMembers,
  customRoles,
  appUrl,
  onInviteCreated,
  onActivated,
}: {
  slug:             string;
  open:             boolean;
  onClose:          () => void;
  availableMembers: AvailableMember[];
  customRoles:      CustomRole[];
  appUrl:           string;
  onInviteCreated:  (token: string, invite: InviteRow) => void;
  onActivated:      (name: string, userRow: UserRow) => void;
}) {
  const [method, setMethod]               = useState<InviteMethod>("link");
  const [memberId, setMemberId]           = useState("");
  const [memberName, setMemberName]       = useState("");
  const [memberEmail, setMemberEmail]     = useState<string | null>(null);
  const [memberOpen, setMemberOpen]       = useState(false);
  const [role, setRole]                   = useState<"ketua" | "sekretaris" | "bendahara" | "custom">("ketua");
  const [customRoleId, setCustomRoleId]   = useState("");
  const [customRoleName, setCustomRoleName] = useState("");
  const [customRoleOpen, setCustomRoleOpen] = useState(false);
  // Field khusus metode langsung
  const [password, setPassword]           = useState("");
  const [showPassword, setShowPassword]   = useState(false);
  const [error, setError]                 = useState("");
  const [isPending, startTransition]      = useTransition();

  const ROLES: { value: typeof role; label: string }[] = [
    { value: "ketua",      label: "Ketua" },
    { value: "sekretaris", label: "Sekretaris" },
    { value: "bendahara",  label: "Bendahara" },
    { value: "custom",     label: "Role Kustom" },
  ];

  function reset() {
    setMemberId(""); setMemberName(""); setMemberEmail(null); setRole("ketua");
    setCustomRoleId(""); setCustomRoleName("");
    setPassword(""); setShowPassword(false);
    setError(""); setMethod("link");
  }

  function handleClose() { reset(); onClose(); }

  // ── Metode 1: Buat link undangan ──────────────────────────────────────────
  function handleSubmitLink() {
    if (!memberId) { setError("Pilih anggota terlebih dahulu."); return; }
    if (role === "custom" && !customRoleId) { setError("Pilih role kustom."); return; }
    setError("");

    startTransition(async () => {
      const res = await createInviteAction(slug, {
        memberId,
        role,
        customRoleId: role === "custom" ? customRoleId : undefined,
        deliveryMethod: "manual",
      });

      if (!res.success) { setError(res.error); return; }

      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      onInviteCreated(res.token, {
        id:             res.inviteId,
        memberName,
        email:          null,
        role,
        customRoleName: role === "custom" ? customRoleName : null,
        token:          res.token,
        expiresAt,
        acceptedAt:     null,
        deliveryMethod: "manual",
      });
      reset();
    });
  }

  // ── Metode 2: Aktifkan langsung ───────────────────────────────────────────
  function handleSubmitDirect() {
    if (!memberId) { setError("Pilih anggota terlebih dahulu."); return; }
    if (!memberEmail) { setError("Anggota ini belum punya email. Isi dulu di data anggota."); return; }
    if (password.length < 8) { setError("Password minimal 8 karakter."); return; }
    if (role === "custom" && !customRoleId) { setError("Pilih role kustom."); return; }
    setError("");

    startTransition(async () => {
      const res = await activateUserDirectAction(slug, {
        memberId,
        role,
        customRoleId: role === "custom" ? customRoleId : undefined,
        email:    memberEmail,
        password,
        name:     memberName,
      });

      if (!res.success) { setError(res.error); return; }

      onActivated(res.name, {
        id:             crypto.randomUUID(), // placeholder, page will refresh
        name:           memberName,
        email:          memberEmail,
        role,
        customRoleName: role === "custom" ? customRoleName : null,
        memberId,
        isCurrentUser:  false,
        createdAt:      new Date().toISOString(),
      });
      reset();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Tambah Pengurus</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* ── Toggle metode ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-1 rounded-lg border border-border p-1 bg-muted/30">
            <button
              type="button"
              onClick={() => { setMethod("link"); setError(""); }}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors
                ${method === "link"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
                }`}
            >
              Kirim Link Undangan
            </button>
            <button
              type="button"
              onClick={() => { setMethod("direct"); setError(""); }}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors
                ${method === "direct"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
                }`}
            >
              Aktifkan Langsung
            </button>
          </div>

          {/* Deskripsi metode */}
          <p className="text-xs text-muted-foreground">
            {method === "link"
              ? "Generate link 7 hari. User buka link → isi password sendiri → langsung aktif."
              : "Admin tentukan email dan password. User bisa langsung login tanpa klik link."
            }
          </p>

          {/* ── Pilih Anggota ─────────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Anggota</label>
            <Popover open={memberOpen} onOpenChange={setMemberOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="w-full flex items-center justify-between rounded-md border border-input
                             bg-background px-3 py-2 text-sm text-left focus:outline-none
                             focus:ring-2 focus:ring-ring"
                >
                  <span className={memberName ? "" : "text-muted-foreground"}>
                    {memberName || "Pilih anggota..."}
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-80" align="start">
                <Command>
                  <CommandInput placeholder="Cari nama anggota..." />
                  <CommandList>
                    <CommandEmpty>Tidak ada anggota tersedia.</CommandEmpty>
                    {availableMembers.map((m) => (
                      <CommandItem
                        key={m.id}
                        value={m.name}
                        onSelect={() => {
                          setMemberId(m.id);
                          setMemberName(m.name);
                          setMemberEmail(m.email ?? null);
                          setMemberOpen(false);
                        }}
                      >
                        <div className="flex flex-col">
                          <span>{m.name}</span>
                          {m.email && (
                            <span className="text-xs text-muted-foreground">{m.email}</span>
                          )}
                        </div>
                        {m.memberNumber && (
                          <span className="ml-auto text-xs text-muted-foreground font-mono shrink-0">
                            {m.memberNumber}
                          </span>
                        )}
                      </CommandItem>
                    ))}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* ── Pilih Role ────────────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Role</label>
            <div className="grid grid-cols-2 gap-2">
              {ROLES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRole(r.value)}
                  className={`rounded-md border px-3 py-2 text-sm text-left transition-colors
                    ${role === r.value
                      ? "border-primary bg-primary/5 text-primary font-medium"
                      : "border-border text-muted-foreground hover:border-border/80"
                    }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Custom Role (jika role=custom) ────────────────────────────── */}
          {role === "custom" && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Role Kustom</label>
              {customRoles.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Belum ada role kustom. Buat di{" "}
                  <a href={`/${slug}/settings/roles`} className="underline">Pengaturan Role</a>.
                </p>
              ) : (
                <Popover open={customRoleOpen} onOpenChange={setCustomRoleOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="w-full flex items-center justify-between rounded-md border border-input
                                 bg-background px-3 py-2 text-sm text-left focus:outline-none
                                 focus:ring-2 focus:ring-ring"
                    >
                      <span className={customRoleName ? "" : "text-muted-foreground"}>
                        {customRoleName || "Pilih role kustom..."}
                      </span>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0 w-64" align="start">
                    <Command>
                      <CommandInput placeholder="Cari role..." />
                      <CommandList>
                        <CommandEmpty>Tidak ditemukan.</CommandEmpty>
                        {customRoles.map((r) => (
                          <CommandItem
                            key={r.id}
                            value={r.name}
                            onSelect={() => {
                              setCustomRoleId(r.id);
                              setCustomRoleName(r.name);
                              setCustomRoleOpen(false);
                            }}
                          >
                            {r.name}
                          </CommandItem>
                        ))}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          )}

          {/* ── Field khusus metode Aktifkan Langsung ────────────────────── */}
          {method === "direct" && (
            <div className="space-y-3 rounded-lg border border-border p-3 bg-muted/10">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Kredensial Akun
              </p>

              {/* Email — dari data anggota, read-only */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Email</label>
                {memberId ? (
                  memberEmail ? (
                    <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                      {memberEmail}
                    </div>
                  ) : (
                    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                      Anggota ini belum punya email — isi dulu di data anggota.
                    </div>
                  )
                ) : (
                  <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                    Pilih anggota dulu
                  </div>
                )}
              </div>

              {/* Password — satu-satunya yang diisi admin */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Set Password</label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimal 8 karakter"
                    className="pr-10"
                    disabled={!memberEmail}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    disabled={!memberEmail}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground
                               hover:text-foreground transition-colors disabled:opacity-40"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Informasikan password ini ke pengurus. Mereka bisa ubah sendiri nanti.
                </p>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose} disabled={isPending}>Batal</Button>
          <Button
            onClick={method === "link" ? handleSubmitLink : handleSubmitDirect}
            disabled={isPending}
          >
            {isPending
              ? "Memproses..."
              : method === "link" ? "Buat Link Undangan" : "Aktifkan Sekarang"
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
