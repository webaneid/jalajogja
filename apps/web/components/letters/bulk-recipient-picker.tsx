"use client";

import { useState, useTransition, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, Users, BookUser, X, CheckSquare, Square, Loader2, Send } from "lucide-react";
import { createBulkLettersAction, type BulkRecipient } from "@/app/(dashboard)/[tenant]/letters/actions";

// ─── Types ────────────────────────────────────────────────────────────────────

type MemberItem = {
  id:           string;
  name:         string;
  memberNumber: string | null;
  nik:          string | null;
  phone:        string | null;
  email:        string | null;
  status:       string;
};

type ContactItem = {
  id:           string;
  name:         string;
  title:        string | null;
  organization: string | null;
  phone:        string | null;
  email:        string | null;
  address:      string | null;
};

type Props = {
  slug:     string;
  letterId: string;
  contacts: ContactItem[];
};

type Tab = "members" | "contacts";
type MemberStatus = "active" | "alumni" | "all";

// ─── Komponen utama ───────────────────────────────────────────────────────────

export function BulkRecipientPicker({ slug, letterId, contacts }: Props) {
  const router = useRouter();

  const [tab, setTab]                   = useState<Tab>("members");
  const [selected, setSelected]         = useState<BulkRecipient[]>([]);
  const [error, setError]               = useState("");
  const [result, setResult]             = useState<{ count: number } | null>(null);
  const [pending, startTransition]      = useTransition();

  // ── State tab anggota ──
  const [memberStatus, setMemberStatus] = useState<MemberStatus>("active");
  const [search, setSearch]             = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [members, setMembers]           = useState<MemberItem[]>([]);
  const [page, setPage]                 = useState(1);
  const [totalPages, setTotalPages]     = useState(1);
  const [total, setTotal]               = useState(0);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Debounce search input 300ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Reset halaman saat filter berubah
  useEffect(() => {
    setPage(1);
  }, [memberStatus, debouncedSearch]);

  // Fetch anggota dari API
  const fetchMembers = useCallback(async () => {
    setLoadingMembers(true);
    try {
      const params = new URLSearchParams({
        slug,
        status: memberStatus,
        search: debouncedSearch,
        page:   String(page),
      });
      const res  = await fetch(`/api/ref/tenant-members?${params}`);
      const data = await res.json() as {
        items: MemberItem[];
        total: number;
        totalPages: number;
      };
      setMembers(data.items ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
    } catch {
      setMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  }, [slug, memberStatus, debouncedSearch, page]);

  useEffect(() => {
    void fetchMembers();
  }, [fetchMembers]);

  // ── Helpers ──

  function isSelectedMember(id: string) {
    return selected.some((r) => r.type === "member" && r.id === id);
  }

  function isSelectedContact(id: string) {
    return selected.some((r) => r.type === "contact" && r.id === id);
  }

  function toggleMember(m: MemberItem) {
    if (isSelectedMember(m.id)) {
      setSelected((prev) => prev.filter((r) => !(r.type === "member" && r.id === m.id)));
    } else {
      setSelected((prev) => [
        ...prev,
        {
          type:   "member",
          id:     m.id,
          name:   m.name,
          phone:  m.phone,
          email:  m.email,
          number: m.memberNumber,
          nik:    m.nik,
        },
      ]);
    }
  }

  function toggleContact(c: ContactItem) {
    if (isSelectedContact(c.id)) {
      setSelected((prev) => prev.filter((r) => !(r.type === "contact" && r.id === c.id)));
    } else {
      setSelected((prev) => [
        ...prev,
        {
          type:    "contact",
          id:      c.id,
          name:    c.name,
          phone:   c.phone,
          email:   c.email,
          address: c.address,
        },
      ]);
    }
  }

  // Pilih semua anggota di halaman ini
  function selectAllPage() {
    const toAdd = members
      .filter((m) => !isSelectedMember(m.id))
      .map((m): BulkRecipient => ({
        type:   "member",
        id:     m.id,
        name:   m.name,
        phone:  m.phone,
        email:  m.email,
        number: m.memberNumber,
        nik:    m.nik,
      }));
    setSelected((prev) => [...prev, ...toAdd]);
  }

  function deselectAllPage() {
    const pageIds = new Set(members.map((m) => m.id));
    setSelected((prev) => prev.filter((r) => !(r.type === "member" && pageIds.has(r.id))));
  }

  const pageAllSelected = members.length > 0 && members.every((m) => isSelectedMember(m.id));

  function removeSelected(type: "member" | "contact", id: string) {
    setSelected((prev) => prev.filter((r) => !(r.type === type && r.id === id)));
  }

  // ── Generate action ──

  function handleGenerate() {
    if (selected.length === 0) {
      setError("Pilih minimal satu penerima.");
      return;
    }
    setError("");

    startTransition(async () => {
      const res = await createBulkLettersAction(slug, letterId, selected);
      if (res.success) {
        setResult({ count: res.count });
        // Redirect ke halaman parent setelah 1.5 detik
        setTimeout(() => router.push(`/${slug}/letters/keluar/${letterId}`), 1500);
      } else {
        setError(res.error);
      }
    });
  }

  // ── Render ──

  if (result) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 px-6 py-8 text-center space-y-2">
        <p className="text-green-700 font-semibold text-lg">{result.count} salinan surat berhasil dibuat</p>
        <p className="text-sm text-muted-foreground">Mengarahkan kembali ke halaman surat…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tab */}
      <div className="flex border-b border-border">
        <button
          type="button"
          onClick={() => setTab("members")}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === "members"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Users className="h-3.5 w-3.5" />
          Dari Anggota
        </button>
        <button
          type="button"
          onClick={() => setTab("contacts")}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === "contacts"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <BookUser className="h-3.5 w-3.5" />
          Dari Kontak
          {contacts.length > 0 && (
            <span className="ml-1 text-xs text-muted-foreground">({contacts.length})</span>
          )}
        </button>
      </div>

      {/* Tab: Anggota */}
      {tab === "members" && (
        <div className="space-y-3">
          {/* Filter + Search */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Cari nama, nomor anggota, NIK…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm rounded border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <select
              value={memberStatus}
              onChange={(e) => setMemberStatus(e.target.value as MemberStatus)}
              className="rounded border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="active">Aktif</option>
              <option value="alumni">Alumni</option>
              <option value="all">Semua</option>
            </select>
          </div>

          {/* Pilih semua halaman ini */}
          {members.length > 0 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{total} anggota ditemukan</span>
              <button
                type="button"
                onClick={pageAllSelected ? deselectAllPage : selectAllPage}
                className="hover:text-foreground flex items-center gap-1"
              >
                {pageAllSelected
                  ? <><CheckSquare className="h-3.5 w-3.5" /> Batal pilih semua halaman ini</>
                  : <><Square className="h-3.5 w-3.5" /> Pilih semua halaman ini</>
                }
              </button>
            </div>
          )}

          {/* Daftar anggota */}
          <div className="divide-y divide-border rounded-lg border border-border overflow-hidden min-h-[120px]">
            {loadingMembers ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground text-sm gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Memuat…
              </div>
            ) : members.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                Tidak ada anggota ditemukan
              </div>
            ) : (
              members.map((m) => {
                const sel = isSelectedMember(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleMember(m)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/30 transition-colors ${sel ? "bg-primary/5" : ""}`}
                  >
                    {sel
                      ? <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                      : <Square className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                    }
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{m.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {m.memberNumber && <span className="font-mono mr-2">{m.memberNumber}</span>}
                        {m.status === "alumni" && <span className="text-blue-600">Alumni</span>}
                      </p>
                    </div>
                    {m.phone && (
                      <span className="text-xs text-muted-foreground shrink-0">{m.phone}</span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                disabled={page <= 1 || loadingMembers}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1 rounded border border-border hover:bg-muted/30 disabled:opacity-40 text-xs"
              >
                ← Sebelumnya
              </button>
              <span className="text-xs text-muted-foreground">
                Hal {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages || loadingMembers}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 rounded border border-border hover:bg-muted/30 disabled:opacity-40 text-xs"
              >
                Selanjutnya →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tab: Kontak Eksternal */}
      {tab === "contacts" && (
        <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
          {contacts.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Belum ada kontak tersimpan.{" "}
              <a
                href={`/${slug}/letters/template`}
                className="text-primary hover:underline"
              >
                Tambah kontak di halaman Template.
              </a>
            </div>
          ) : (
            contacts.map((c) => {
              const sel = isSelectedContact(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleContact(c)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/30 transition-colors ${sel ? "bg-primary/5" : ""}`}
                >
                  {sel
                    ? <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                    : <Square className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                  }
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {[c.title, c.organization].filter(Boolean).join(", ")}
                    </p>
                  </div>
                  {c.phone && (
                    <span className="text-xs text-muted-foreground shrink-0">{c.phone}</span>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}

      {/* Panel penerima terpilih + tombol generate */}
      <div className="rounded-lg border border-border bg-muted/10 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">
            {selected.length === 0
              ? "Belum ada penerima dipilih"
              : `${selected.length} penerima dipilih`
            }
          </p>
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => setSelected([])}
              className="text-xs text-muted-foreground hover:text-destructive"
            >
              Hapus semua
            </button>
          )}
        </div>

        {/* Chip penerima terpilih */}
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
            {selected.map((r) => (
              <span
                key={`${r.type}-${r.id}`}
                className="inline-flex items-center gap-1 rounded-full bg-background border border-border px-2.5 py-1 text-xs"
              >
                {r.name}
                <button
                  type="button"
                  onClick={() => removeSelected(r.type, r.id)}
                  className="text-muted-foreground hover:text-destructive ml-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <button
          type="button"
          onClick={handleGenerate}
          disabled={pending || selected.length === 0}
          className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {pending
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Membuat surat…</>
            : <><Send className="h-4 w-4" /> Generate {selected.length > 0 ? `${selected.length} Salinan Surat` : "Salinan Surat"}</>
          }
        </button>
      </div>
    </div>
  );
}
