"use client";

// RecipientCombobox — autocomplete field "Kepada" di form surat
// Sumber data: letter_contacts (pre-loaded) + public.members (debounced API)
// Dilengkapi tombol [+] untuk tambah kontak baru inline

import { useState, useEffect, useRef, useTransition } from "react";
import { Plus, X, Check, Loader2, UserRound, BookUser } from "lucide-react";
import { createLetterContactAction } from "@/app/(dashboard)/[tenant]/letters/actions";

// ── Types ──────────────────────────────────────────────────────────────────────

export type ContactOption = {
  id:           string;
  name:         string;
  title:        string | null;
  organization: string | null;
  address:      string | null;
  phone:        string | null;
  email:        string | null;
};

// Data lengkap penerima yang dikembalikan saat memilih dari dropdown
export type RecipientSelection = {
  name:         string;
  title:        string;
  organization: string;
  address:      string;
  phone:        string;
  email:        string;
};

type MemberResult = {
  id:           string;
  name:         string;
  memberNumber: string | null;
  phone:        string | null;
  email:        string | null;
  address:      string | null;
};

type Props = {
  slug:             string;
  value:            string;
  onChange:         (data: RecipientSelection) => void;
  contacts:         ContactOption[];
  onContactCreated: (contact: ContactOption) => void;
  /** Nama organisasi tenant — dipakai sebagai default title/organization saat pilih anggota */
  orgName:          string;
};

// ── Component ─────────────────────────────────────────────────────────────────

export function RecipientCombobox({ slug, value, onChange, contacts, onContactCreated, orgName }: Props) {
  const [inputValue,    setInputValue]    = useState(value);
  const [open,          setOpen]          = useState(false);
  const [members,       setMembers]       = useState<MemberResult[]>([]);
  const [loadingMember, setLoadingMember] = useState(false);
  const [showAddForm,   setShowAddForm]   = useState(false);
  const [addForm,       setAddForm]       = useState({ name: "", title: "", organization: "" });
  const [addError,      setAddError]      = useState("");
  const [addPending,    startAddTransition] = useTransition();

  const containerRef  = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync nilai dari luar (misal load dari DB)
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Debounced fetch anggota
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    const q = inputValue.trim();
    if (!q || q.length < 2) {
      setMembers([]);
      return;
    }
    debounceTimer.current = setTimeout(async () => {
      setLoadingMember(true);
      try {
        const res  = await fetch(`/api/ref/tenant-members?slug=${encodeURIComponent(slug)}&search=${encodeURIComponent(q)}&status=all&page=1`);
        const data = await res.json() as { items: MemberResult[] };
        setMembers(data.items ?? []);
      } catch {
        setMembers([]);
      } finally {
        setLoadingMember(false);
      }
    }, 300);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputValue]);

  // Tutup dropdown saat klik di luar
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter kontak client-side
  const q = inputValue.trim().toLowerCase();
  const filteredContacts = q.length >= 1
    ? contacts.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        (c.organization ?? "").toLowerCase().includes(q)
      )
    : contacts.slice(0, 8);

  const hasResults = filteredContacts.length > 0 || members.length > 0;

  function selectRecipient(data: RecipientSelection) {
    setInputValue(data.name);
    onChange(data);
    setOpen(false);
    setMembers([]);
  }

  function handleInputChange(v: string) {
    setInputValue(v);
    // Saat user mengetik manual (bukan pilih dari dropdown), kirim data minimal
    onChange({ name: v, title: "", organization: "", address: "", phone: "", email: "" });
    setOpen(true);
  }

  function handleOpenAddForm() {
    setAddForm({ name: inputValue.trim(), title: "", organization: "" });
    setAddError("");
    setShowAddForm(true);
    setOpen(false);
  }

  function handleCancelAdd() {
    setShowAddForm(false);
    setAddError("");
  }

  function handleSaveContact() {
    if (!addForm.name.trim()) { setAddError("Nama wajib diisi."); return; }
    setAddError("");

    startAddTransition(async () => {
      const data = {
        name:         addForm.name.trim(),
        title:        addForm.title.trim()        || null,
        organization: addForm.organization.trim() || null,
        email:        null,
        phone:        null,
      };
      const res = await createLetterContactAction(slug, data);
      if (res.success) {
        const newContact: ContactOption = { id: res.contactId, ...data, address: null, phone: null, email: null };
        onContactCreated(newContact);
        selectRecipient({
          name:         data.name,
          title:        data.title        ?? "",
          organization: data.organization ?? "",
          address:      "",
          phone:        "",
          email:        "",
        });
        setShowAddForm(false);
      } else {
        setAddError(res.error);
      }
    });
  }

  const fieldCls = "w-full rounded border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring";

  return (
    <div ref={containerRef} className="relative">
      {/* Input + tombol [+] */}
      <div className="flex gap-1.5 mt-0.5">
        <div className="relative flex-1">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => setOpen(true)}
            placeholder="Ketik nama penerima / instansi..."
            className="w-full rounded border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {loadingMember && (
            <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
        <button
          type="button"
          onClick={handleOpenAddForm}
          title="Tambah kontak baru"
          className="shrink-0 inline-flex items-center justify-center rounded border border-border w-9 h-9 hover:bg-muted/40 text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Dropdown hasil pencarian */}
      {open && !showAddForm && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-background shadow-md max-h-64 overflow-y-auto">

          {/* Seksi kontak */}
          {filteredContacts.length > 0 && (
            <div>
              <p className="px-3 py-1.5 text-xs font-medium text-muted-foreground border-b border-border bg-muted/30">
                Kontak Surat
              </p>
              {filteredContacts.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); selectRecipient({ name: c.name, title: c.title ?? "", organization: c.organization ?? "", address: c.address ?? "", phone: c.phone ?? "", email: c.email ?? "" }); }}
                  className="flex items-start gap-2 w-full px-3 py-2 text-left text-sm hover:bg-muted/50"
                >
                  <BookUser className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                  <span>
                    <span className="font-medium">{c.name}</span>
                    {(c.title || c.organization) && (
                      <span className="text-muted-foreground">
                        {" · "}{[c.title, c.organization].filter(Boolean).join(", ")}
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Seksi anggota */}
          {members.length > 0 && (
            <div>
              <p className="px-3 py-1.5 text-xs font-medium text-muted-foreground border-b border-border bg-muted/30">
                Anggota
              </p>
              {members.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); selectRecipient({ name: m.name, title: `Anggota ${orgName}`, organization: orgName, address: m.address ?? "", phone: m.phone ?? "", email: m.email ?? "" }); }}
                  className="flex items-start gap-2 w-full px-3 py-2 text-left text-sm hover:bg-muted/50"
                >
                  <UserRound className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                  <span>
                    <span className="font-medium">{m.name}</span>
                    {m.memberNumber && (
                      <span className="text-muted-foreground font-mono text-xs"> · {m.memberNumber}</span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Tidak ada hasil */}
          {!hasResults && !loadingMember && q.length >= 2 && (
            <div className="px-3 py-3 text-sm text-muted-foreground flex items-center justify-between">
              <span>Tidak ditemukan di kontak maupun anggota.</span>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); handleOpenAddForm(); }}
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Plus className="h-3 w-3" />
                Tambah kontak
              </button>
            </div>
          )}

          {loadingMember && filteredContacts.length === 0 && (
            <div className="px-3 py-3 text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Mencari anggota...
            </div>
          )}
        </div>
      )}

      {/* Inline form tambah kontak */}
      {showAddForm && (
        <div className="mt-2 rounded-lg border border-border bg-muted/10 p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-foreground">Tambah Kontak Baru</p>
            <button type="button" onClick={handleCancelAdd} className="text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Nama <span className="text-destructive">*</span></label>
            <input
              type="text"
              value={addForm.name}
              onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Nama lengkap / instansi"
              className={`mt-0.5 ${fieldCls}`}
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Jabatan</label>
              <input
                type="text"
                value={addForm.title}
                onChange={(e) => setAddForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Direktur, dll"
                className={`mt-0.5 ${fieldCls}`}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Instansi</label>
              <input
                type="text"
                value={addForm.organization}
                onChange={(e) => setAddForm((f) => ({ ...f, organization: e.target.value }))}
                placeholder="Nama instansi"
                className={`mt-0.5 ${fieldCls}`}
              />
            </div>
          </div>

          {addError && <p className="text-xs text-destructive">{addError}</p>}

          <div className="flex gap-2 justify-end pt-0.5">
            <button
              type="button"
              onClick={handleCancelAdd}
              className="rounded border border-border px-2.5 py-1 text-xs hover:bg-muted/40"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSaveContact}
              disabled={addPending}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              <Check className="h-3 w-3" />
              {addPending ? "Menyimpan..." : "Simpan & Pilih"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
