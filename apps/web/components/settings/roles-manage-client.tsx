"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil, Trash2, Shield, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  createCustomRoleAction,
  updateCustomRoleAction,
  deleteCustomRoleAction,
} from "@/app/(dashboard)/[tenant]/settings/actions";
import type { Level, Module } from "@/lib/permissions";

// ─── Constants ────────────────────────────────────────────────────────────────

const MODULES: { value: Module; label: string }[] = [
  { value: "website",  label: "Website" },
  { value: "surat",    label: "Surat" },
  { value: "keuangan", label: "Keuangan" },
  { value: "toko",     label: "Toko" },
  { value: "donasi",   label: "Donasi" },
  { value: "event",    label: "Event" },
  { value: "dokumen",  label: "Dokumen" },
  { value: "anggota",  label: "Anggota" },
  { value: "media",    label: "Media" },
  { value: "pengurus", label: "Pengurus" },
];

const LEVELS: { value: Level; label: string; description: string }[] = [
  { value: "full", label: "Full",   description: "CRUD + semua aksi admin" },
  { value: "read", label: "Lihat",  description: "Hanya lihat data" },
  { value: "own",  label: "Sendiri", description: "Buat + lihat milik sendiri" },
  { value: "none", label: "Tidak",  description: "Tidak ada akses" },
];

const LEVEL_COLORS: Record<Level, string> = {
  full: "bg-blue-100 text-blue-800 border-blue-200",
  read: "bg-green-100 text-green-800 border-green-200",
  own:  "bg-yellow-100 text-yellow-800 border-yellow-200",
  none: "bg-gray-100 text-gray-500 border-gray-200",
};

const SYSTEM_ROLES = [
  {
    name:        "Owner",
    description: "Akses penuh + kelola pengguna",
    permissions: Object.fromEntries(MODULES.map((m) => [m.value, "full" as Level])) as Record<Module, Level>,
  },
  {
    name:        "Ketua",
    description: "Akses penuh ke semua modul",
    permissions: Object.fromEntries(MODULES.map((m) => [m.value, "full" as Level])) as Record<Module, Level>,
  },
  {
    name:        "Sekretaris",
    description: "Surat, dokumen, anggota, event full — keuangan read",
    permissions: {
      website: "full", surat: "full", keuangan: "read",
      toko: "read", donasi: "read", event: "full",
      dokumen: "full", anggota: "full", media: "full", pengurus: "full",
    } as Record<Module, Level>,
  },
  {
    name:        "Bendahara",
    description: "Keuangan full — surat hanya milik sendiri",
    permissions: {
      website: "none", surat: "own", keuangan: "full",
      toko: "read", donasi: "read", event: "read",
      dokumen: "read", anggota: "none", media: "read", pengurus: "read",
    } as Record<Module, Level>,
  },
];

// ─── Types ────────────────────────────────────────────────────────────────────

type CustomRoleRow = {
  id:          string;
  name:        string;
  description: string | null;
  permissions: Record<string, string>;
  isSystem:    boolean;
  createdAt:   string;
};

type Props = {
  slug:        string;
  customRoles: CustomRoleRow[];
};

// ─── Default Permissions ──────────────────────────────────────────────────────

function defaultPermissions(): Record<Module, Level> {
  return Object.fromEntries(MODULES.map((m) => [m.value, "none" as Level])) as Record<Module, Level>;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function RolesManageClient({ slug, customRoles: initialRoles }: Props) {
  const [roles, setRoles] = useState(initialRoles);
  const [showDialog, setShowDialog] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRoleRow | null>(null);
  const [expandedSystemRole, setExpandedSystemRole] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function handleEdit(role: CustomRoleRow) {
    setEditingRole(role);
    setShowDialog(true);
  }

  function handleDelete(roleId: string, roleName: string) {
    if (!confirm(`Hapus role "${roleName}"? Pengguna dengan role ini harus diubah terlebih dahulu.`)) return;
    startTransition(async () => {
      const res = await deleteCustomRoleAction(slug, roleId);
      if (res.success) {
        setRoles((prev) => prev.filter((r) => r.id !== roleId));
      } else {
        alert(res.error);
      }
    });
  }

  function handleSaved(role: CustomRoleRow) {
    setRoles((prev) => {
      const idx = prev.findIndex((r) => r.id === role.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = role;
        return next;
      }
      return [...prev, role];
    });
    setShowDialog(false);
    setEditingRole(null);
  }

  const editableRoles = roles.filter((r) => !r.isSystem);

  return (
    <div className="space-y-8">
      {/* ── System Roles (read-only) ──────────────────────────────────────── */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Role Bawaan (Tidak bisa diubah)
        </h3>
        <div className="rounded-lg border border-border divide-y divide-border">
          {SYSTEM_ROLES.map((r) => {
            const isExpanded = expandedSystemRole === r.name;
            return (
              <div key={r.name}>
                <button
                  type="button"
                  onClick={() => setExpandedSystemRole(isExpanded ? null : r.name)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30
                             transition-colors"
                >
                  <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium">{r.name}</span>
                    <p className="text-xs text-muted-foreground">{r.description}</p>
                  </div>
                  {isExpanded
                    ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                    : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  }
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4">
                    <PermissionMatrix permissions={r.permissions} readonly />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Custom Roles ─────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Role Kustom ({editableRoles.length})</h3>
          <Button
            size="sm"
            variant="outline"
            onClick={() => { setEditingRole(null); setShowDialog(true); }}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Buat Role
          </Button>
        </div>

        {editableRoles.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-10 text-center
                          text-sm text-muted-foreground">
            Belum ada role kustom. Buat untuk memberikan hak akses yang disesuaikan.
          </div>
        ) : (
          <div className="rounded-lg border border-border divide-y divide-border">
            {editableRoles.map((r) => (
              <div key={r.id} className="px-4 py-3 text-sm">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{r.name}</p>
                    {r.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{r.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleEdit(r)}
                      className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                      title="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(r.id, r.name)}
                      disabled={isPending}
                      className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                      title="Hapus"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Ringkasan permissions */}
                <div className="mt-2 flex flex-wrap gap-1">
                  {MODULES.map((m) => {
                    const level = (r.permissions[m.value] ?? "none") as Level;
                    if (level === "none") return null;
                    return (
                      <span
                        key={m.value}
                        className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs
                                    ${LEVEL_COLORS[level]}`}
                      >
                        {m.label}: {LEVELS.find((l) => l.value === level)?.label}
                      </span>
                    );
                  })}
                  {Object.values(r.permissions).every((v) => v === "none" || !v) && (
                    <span className="text-xs text-muted-foreground">Semua akses: tidak ada</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Dialog buat/edit role ─────────────────────────────────────────── */}
      <RoleDialog
        slug={slug}
        open={showDialog}
        editingRole={editingRole}
        onClose={() => { setShowDialog(false); setEditingRole(null); }}
        onSaved={handleSaved}
      />
    </div>
  );
}

// ─── Role Dialog ──────────────────────────────────────────────────────────────

function RoleDialog({
  slug,
  open,
  editingRole,
  onClose,
  onSaved,
}: {
  slug:        string;
  open:        boolean;
  editingRole: CustomRoleRow | null;
  onClose:     () => void;
  onSaved:     (role: CustomRoleRow) => void;
}) {
  const isEditing = !!editingRole;

  const [name, setName] = useState(editingRole?.name ?? "");
  const [description, setDescription] = useState(editingRole?.description ?? "");
  const [permissions, setPermissions] = useState<Record<Module, Level>>(
    () => {
      const base = defaultPermissions();
      if (editingRole?.permissions) {
        for (const [k, v] of Object.entries(editingRole.permissions)) {
          if (k in base) base[k as Module] = v as Level;
        }
      }
      return base;
    }
  );
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  // Reset state when dialog opens/closes with different role
  useState(() => {
    setName(editingRole?.name ?? "");
    setDescription(editingRole?.description ?? "");
    const base = defaultPermissions();
    if (editingRole?.permissions) {
      for (const [k, v] of Object.entries(editingRole.permissions)) {
        if (k in base) base[k as Module] = v as Level;
      }
    }
    setPermissions(base);
    setError("");
  });

  function setLevel(module: Module, level: Level) {
    setPermissions((prev) => ({ ...prev, [module]: level }));
  }

  function handleSubmit() {
    if (!name.trim()) { setError("Nama role wajib diisi."); return; }
    setError("");

    startTransition(async () => {
      const data = { name, description, permissions };
      const res = isEditing
        ? await updateCustomRoleAction(slug, editingRole!.id, data)
        : await createCustomRoleAction(slug, data);

      if (!res.success) { setError(res.error); return; }

      onSaved({
        id:          editingRole?.id ?? crypto.randomUUID(),
        name:        name.trim(),
        description: description.trim() || null,
        permissions: permissions as Record<string, string>,
        isSystem:    false,
        createdAt:   editingRole?.createdAt ?? new Date().toISOString(),
      });
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Role" : "Buat Role Kustom"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Nama */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Nama Role</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Divisi Media, Koordinator, dll"
            />
          </div>

          {/* Deskripsi */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Deskripsi <span className="text-muted-foreground">(opsional)</span></label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Jelaskan fungsi role ini"
            />
          </div>

          {/* Permission Matrix */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Hak Akses per Modul</label>
            <PermissionMatrix
              permissions={permissions}
              readonly={false}
              onChange={setLevel}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isPending}>Batal</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Menyimpan..." : (isEditing ? "Simpan Perubahan" : "Buat Role")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Permission Matrix ────────────────────────────────────────────────────────

function PermissionMatrix({
  permissions,
  readonly,
  onChange,
}: {
  permissions: Record<string, string> | Record<Module, Level>;
  readonly:    boolean;
  onChange?:   (module: Module, level: Level) => void;
}) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[1fr_repeat(4,80px)] bg-muted/50 border-b border-border
                      text-xs font-medium text-muted-foreground">
        <div className="px-3 py-2">Modul</div>
        {LEVELS.map((l) => (
          <div key={l.value} className="px-2 py-2 text-center" title={l.description}>
            {l.label}
          </div>
        ))}
      </div>

      {/* Rows */}
      {MODULES.map((m, idx) => {
        const current = ((permissions as Record<string, string>)[m.value] ?? "none") as Level;
        return (
          <div
            key={m.value}
            className={`grid grid-cols-[1fr_repeat(4,80px)] items-center
                        ${idx % 2 === 0 ? "" : "bg-muted/20"}
                        ${readonly ? "" : "hover:bg-muted/30"}`}
          >
            <div className="px-3 py-2.5 text-sm font-medium">{m.label}</div>
            {LEVELS.map((l) => (
              <div key={l.value} className="flex items-center justify-center py-2.5">
                {readonly ? (
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center
                                ${current === l.value
                                  ? "border-primary bg-primary"
                                  : "border-border"
                                }`}
                  >
                    {current === l.value && (
                      <div className="w-2 h-2 rounded-full bg-white" />
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onChange?.(m.value, l.value)}
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center
                                transition-colors cursor-pointer
                                ${current === l.value
                                  ? "border-primary bg-primary"
                                  : "border-border hover:border-primary/50"
                                }`}
                    title={`${m.label}: ${l.description}`}
                  >
                    {current === l.value && (
                      <div className="w-2 h-2 rounded-full bg-white" />
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
