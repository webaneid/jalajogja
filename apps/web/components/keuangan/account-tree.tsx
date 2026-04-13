"use client";

import { useState, useTransition } from "react";
import { ChevronRight, ChevronDown, Plus, Pencil, Power } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  createAccountAction,
  updateAccountAction,
  toggleAccountActiveAction,
  type AccountData,
} from "@/app/(dashboard)/[tenant]/finance/actions";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type AccountNode = {
  id: string;
  code: string;
  name: string;
  type: string;
  parentId: string | null;
  isActive: boolean;
  children: AccountNode[];
};

const TYPE_LABELS: Record<string, string> = {
  asset:     "Aset",
  liability: "Kewajiban",
  equity:    "Ekuitas",
  income:    "Pendapatan",
  expense:   "Beban",
};

const TYPE_COLORS: Record<string, string> = {
  asset:     "text-blue-600",
  liability: "text-orange-600",
  equity:    "text-purple-600",
  income:    "text-green-600",
  expense:   "text-red-600",
};

// ─── AccountForm (inline) ─────────────────────────────────────────────────────

type AccountFormProps = {
  slug: string;
  parentId?: string | null;
  parentType?: string;
  initial?: { id: string; code: string; name: string; type: string };
  onClose: () => void;
};

function AccountForm({ slug, parentId, parentType, initial, onClose }: AccountFormProps) {
  const [code, setCode]     = useState(initial?.code ?? "");
  const [name, setName]     = useState(initial?.name ?? "");
  const [type, setType]     = useState<AccountData["type"]>(
    (initial?.type as AccountData["type"]) ?? (parentType as AccountData["type"]) ?? "asset"
  );
  const [error, setError]   = useState("");
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const res = initial
        ? await updateAccountAction(slug, initial.id, { code, name, type })
        : await createAccountAction(slug, { code, name, type, parentId: parentId ?? null });

      if (!res.success) {
        setError(res.error);
      } else {
        onClose();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-1 mb-2 ml-4 rounded-md border border-border bg-muted/30 p-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-muted-foreground">Kode</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="mis. 1101"
            className="w-full mt-0.5 rounded border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            required
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Tipe</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as AccountData["type"])}
            className="w-full mt-0.5 rounded border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {Object.entries(TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Nama Akun</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="mis. Kas Tunai"
          className="w-full mt-0.5 rounded border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          required
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {pending ? "Menyimpan..." : "Simpan"}
        </button>
        <button type="button" onClick={onClose} className="rounded px-3 py-1 text-xs text-muted-foreground hover:text-foreground">
          Batal
        </button>
      </div>
    </form>
  );
}

// ─── AccountRow ───────────────────────────────────────────────────────────────

function AccountRow({
  node,
  slug,
  depth,
}: {
  node: AccountNode;
  slug: string;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const [showAdd,  setShowAdd]  = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [pending,  startTransition] = useTransition();

  const hasChildren = node.children.length > 0;

  function handleToggleActive() {
    startTransition(async () => {
      await toggleAccountActiveAction(slug, node.id);
    });
  }

  return (
    <li>
      <div
        className={cn(
          "group flex items-center gap-1 rounded px-2 py-1.5 text-sm hover:bg-muted/40 transition-colors",
          !node.isActive && "opacity-50"
        )}
        style={{ paddingLeft: `${8 + depth * 20}px` }}
      >
        {/* Expand/collapse toggle */}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className={cn("h-4 w-4 shrink-0 text-muted-foreground", !hasChildren && "invisible")}
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>

        {/* Kode */}
        <span className="w-14 shrink-0 font-mono text-xs text-muted-foreground">{node.code}</span>

        {/* Nama */}
        <span className="flex-1 font-medium">{node.name}</span>

        {/* Tipe */}
        <span className={cn("hidden text-xs sm:block", TYPE_COLORS[node.type])}>
          {TYPE_LABELS[node.type]}
        </span>

        {/* Aksi — tampil saat hover */}
        <div className="ml-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={() => { setShowAdd(!showAdd); setShowEdit(false); }}
            className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted"
            title="Tambah sub-akun"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => { setShowEdit(!showEdit); setShowAdd(false); }}
            className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted"
            title="Edit akun"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleToggleActive}
            disabled={pending}
            className={cn(
              "rounded p-1 hover:bg-muted",
              node.isActive ? "text-green-600 hover:text-green-700" : "text-zinc-400 hover:text-zinc-600"
            )}
            title={node.isActive ? "Nonaktifkan" : "Aktifkan"}
          >
            <Power className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Form edit */}
      {showEdit && (
        <AccountForm
          slug={slug}
          initial={{ id: node.id, code: node.code, name: node.name, type: node.type }}
          onClose={() => setShowEdit(false)}
        />
      )}

      {/* Form tambah sub-akun */}
      {showAdd && (
        <AccountForm
          slug={slug}
          parentId={node.id}
          parentType={node.type}
          onClose={() => setShowAdd(false)}
        />
      )}

      {/* Anak-anak */}
      {hasChildren && expanded && (
        <ul>
          {node.children.map((child) => (
            <AccountRow key={child.id} node={child} slug={slug} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

// ─── AccountTree (export utama) ───────────────────────────────────────────────

export function AccountTree({ accounts, slug }: { accounts: AccountNode[]; slug: string }) {
  const [showRootAdd, setShowRootAdd] = useState(false);

  // Kelompokkan per tipe untuk display yang rapi
  const rootsByType: Record<string, AccountNode[]> = {};
  for (const acc of accounts) {
    if (!rootsByType[acc.type]) rootsByType[acc.type] = [];
    rootsByType[acc.type].push(acc);
  }

  const typeOrder = ["asset", "liability", "equity", "income", "expense"];

  return (
    <div>
      {/* Header + tombol tambah root */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-medium text-sm">Daftar Akun (Chart of Accounts)</h2>
        <button
          type="button"
          onClick={() => setShowRootAdd(!showRootAdd)}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted/40 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Tambah Akun
        </button>
      </div>

      {showRootAdd && (
        <AccountForm slug={slug} onClose={() => setShowRootAdd(false)} />
      )}

      {accounts.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Belum ada akun. Klik &quot;Tambah Akun&quot; untuk mulai.
        </p>
      ) : (
        <div className="rounded-lg border border-border bg-card">
          {typeOrder.map((type) => {
            const nodes = rootsByType[type];
            if (!nodes || nodes.length === 0) return null;
            return (
              <div key={type}>
                <div className="border-b border-border px-3 py-2 bg-muted/20">
                  <span className={cn("text-xs font-semibold uppercase tracking-wide", TYPE_COLORS[type])}>
                    {TYPE_LABELS[type]}
                  </span>
                </div>
                <ul>
                  {nodes.map((node) => (
                    <AccountRow key={node.id} node={node} slug={slug} depth={0} />
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
