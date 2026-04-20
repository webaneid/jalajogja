"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, Link2, Unlink, Loader2, Check, ChevronDown } from "lucide-react";
import { linkProfileToMemberAction, unlinkProfileFromMemberAction } from "../actions";

// ─── Types ────────────────────────────────────────────────────────────────────

type MemberOption = {
  id:           string;
  name:         string;
  memberNumber: string | null;
  phone:        string | null;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function LinkMemberClient({
  slug,
  profileId,
  currentMemberId,
  currentMemberName,
  mode,
}: {
  slug:              string;
  profileId:         string;
  currentMemberId:   string | null;
  currentMemberName: string | null;
  mode:              "link" | "unlink";
}) {
  const router = useRouter();
  const [open,     setOpen]     = useState(false);
  const [search,   setSearch]   = useState("");
  const [options,  setOptions]  = useState<MemberOption[]>([]);
  const [selected, setSelected] = useState<MemberOption | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Fetch members saat search berubah ───────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setFetching(true);
      try {
        const params = new URLSearchParams({ slug, search, status: "active" });
        const res  = await fetch(`/api/ref/tenant-members?${params}`);
        const data = await res.json();
        setOptions(data.items ?? []);
      } catch {
        setOptions([]);
      } finally {
        setFetching(false);
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search, open, slug]);

  // ── Tutup dropdown saat klik di luar ────────────────────────────────────────
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  // ── Link ke anggota ──────────────────────────────────────────────────────────
  async function handleLink() {
    if (!selected) return;
    setLoading(true);
    setError(null);
    const result = await linkProfileToMemberAction(slug, profileId, selected.id);
    setLoading(false);
    if (result.success) {
      router.refresh();
    } else {
      setError(result.error ?? "Gagal menghubungkan.");
    }
  }

  // ── Lepas link ────────────────────────────────────────────────────────────────
  async function handleUnlink() {
    if (!confirm(`Lepaskan link ke anggota "${currentMemberName}"?`)) return;
    setLoading(true);
    setError(null);
    const result = await unlinkProfileFromMemberAction(slug, profileId);
    setLoading(false);
    if (result.success) {
      router.refresh();
    } else {
      setError(result.error ?? "Gagal melepas link.");
    }
  }

  // ── Unlink mode ───────────────────────────────────────────────────────────────
  if (mode === "unlink") {
    return (
      <div>
        <button
          onClick={handleUnlink}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-destructive hover:border-destructive transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlink className="h-3.5 w-3.5" />}
          Lepas Link Anggota
        </button>
        {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  // ── Link mode — combobox pilih anggota ────────────────────────────────────────
  return (
    <div className="space-y-3">
      {/* Combobox */}
      <div ref={containerRef} className="relative max-w-sm">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <span className={selected ? "text-foreground" : "text-muted-foreground"}>
            {selected ? `${selected.name}${selected.memberNumber ? ` (${selected.memberNumber})` : ""}` : "Pilih anggota IKPM..."}
          </span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>

        {open && (
          <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-md">
            {/* Search input */}
            <div className="flex items-center border-b px-3 py-2 gap-2">
              <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <input
                type="text"
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama anggota..."
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>

            {/* Options */}
            <div className="max-h-52 overflow-y-auto py-1">
              {fetching ? (
                <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                </div>
              ) : options.length === 0 ? (
                <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                  {search ? "Tidak ada anggota ditemukan." : "Ketik nama untuk mencari anggota."}
                </p>
              ) : (
                options.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => { setSelected(opt); setOpen(false); }}
                    className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-accent transition-colors"
                  >
                    <div className="text-left">
                      <p className="font-medium">{opt.name}</p>
                      {opt.memberNumber && (
                        <p className="text-xs text-muted-foreground">{opt.memberNumber}</p>
                      )}
                    </div>
                    {selected?.id === opt.id && <Check className="h-3.5 w-3.5 text-primary" />}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Tombol Link */}
      <button
        onClick={handleLink}
        disabled={!selected || loading}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
        Hubungkan ke Anggota
      </button>

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
