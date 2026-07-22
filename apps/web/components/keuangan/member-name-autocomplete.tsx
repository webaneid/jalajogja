"use client";

// MemberNameAutocomplete — cari nama dari anggota (tenant-members), fallback ketik manual.
// Saat anggota dipilih: kirim {id, name, phone, email} ke onSelectMember (caller auto-isi
// field telepon/email). Saat ketik manual (tidak memilih dari dropdown): onSelectMember(null)
// — field kontak lain TIDAK di-clear otomatis oleh komponen ini, caller yang tentukan.

import { useState, useEffect, useRef } from "react";
import { Loader2, UserRound } from "lucide-react";

type MemberResult = {
  id:           string;
  name:         string;
  memberNumber: string | null;
  phone:        string | null;
  email:        string | null;
};

export type SelectedMember = {
  id:    string;
  name:  string;
  phone: string;
  email: string;
};

type Props = {
  slug:           string;
  value:          string;
  onChange:       (name: string) => void;
  onSelectMember: (member: SelectedMember | null) => void;
  placeholder?:   string;
  className?:     string;
  required?:      boolean;
};

export function MemberNameAutocomplete({ slug, value, onChange, onSelectMember, placeholder, className, required }: Props) {
  const [open, setOpen]       = useState(false);
  const [results, setResults] = useState<MemberResult[]>([]);
  const [loading, setLoading] = useState(false);

  const containerRef  = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    const q = value.trim();
    if (q.length < 2) { setResults([]); return; }
    debounceTimer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/ref/tenant-members?slug=${encodeURIComponent(slug)}&search=${encodeURIComponent(q)}&status=all&page=1`);
        if (!res.ok) { setResults([]); return; }
        const data = await res.json() as { items: MemberResult[] };
        setResults(data.items ?? []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, [value, slug]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleInputChange(v: string) {
    onChange(v);
    onSelectMember(null);
    setOpen(true);
  }

  function selectMember(m: MemberResult) {
    onChange(m.name);
    onSelectMember({ id: m.id, name: m.name, phone: m.phone ?? "", email: m.email ?? "" });
    setOpen(false);
    setResults([]);
  }

  const q = value.trim();
  const showDropdown = open && q.length >= 2;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder={placeholder ?? "Ketik nama — cari dari anggota atau isi manual"}
          autoComplete="off"
          required={required}
          className={className ?? "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"}
        />
        {loading && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {showDropdown && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-background shadow-md max-h-56 overflow-y-auto">
          {results.length > 0 ? (
            results.map((m) => (
              <button
                key={m.id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); selectMember(m); }}
                className="flex items-start gap-2 w-full px-3 py-2 text-left text-sm hover:bg-muted/50"
              >
                <UserRound className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                <span>
                  <span className="font-medium">{m.name}</span>
                  {m.memberNumber && (
                    <span className="text-muted-foreground font-mono text-xs"> · {m.memberNumber}</span>
                  )}
                  {(m.phone || m.email) && (
                    <span className="block text-xs text-muted-foreground">
                      {[m.phone, m.email].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </span>
              </button>
            ))
          ) : !loading ? (
            <div className="px-3 py-3 text-sm text-muted-foreground">
              Tidak ditemukan di anggota — akan disimpan sebagai nama manual.
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
