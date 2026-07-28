"use client";

// Picker penulis/editor byline post — cari dari Anggota IKPM ATAU Penulis Tersimpan (profil
// tamu yang sudah pernah dibuat, mekanisme "recall"), atau buat baru langsung dari pencarian.
// Dipakai 2x di sidebar post-form.tsx (Penulis + Editor) dengan label/hint berbeda.
// Lihat docs/arsitektur-penulis-post.md § 5.

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { MediaPicker, useMediaPicker, type MediaItem } from "@/components/media/media-picker";
import { UserRound, Pencil, X, Plus, ImagePlus } from "lucide-react";
import {
  findOrCreatePostAuthorFromMemberAction,
  createGuestPostAuthorAction,
  updatePostAuthorAction,
  getPostAuthorAction,
  type PostAuthorData,
} from "@/app/(dashboard)/app/[tenant]/website/post-authors-actions";

type MemberResult = { id: string; name: string; memberNumber: string | null };
type GuestResult  = PostAuthorData;

type Props = {
  slug:      string;
  label:     string;   // "Penulis" | "Editor" — dipakai di placeholder search
  value:     string | null;
  onChange:  (id: string | null) => void;
  emptyHint: string;    // teks saat kosong, mis. "Default: {nama login}" atau "(Opsional...)"
};

export function AuthorPicker({ slug, label, value, onChange, emptyHint }: Props) {
  const [resolved, setResolved]         = useState<PostAuthorData | null>(null);
  const [loadingResolved, setLoadingResolved] = useState(false);

  // Resolve info tampilan kalau value terisi tapi belum ada di state (mis. mount edit page)
  useEffect(() => {
    if (!value) { setResolved(null); return; }
    if (resolved?.id === value) return;
    let cancelled = false;
    setLoadingResolved(true);
    getPostAuthorAction(slug, value).then((res) => {
      if (cancelled) return;
      if (res.success && res.data) setResolved(res.data);
      setLoadingResolved(false);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, slug]);

  // ── Pencarian (Anggota + Penulis Tersimpan) ─────────────────────────────
  const [open, setOpen]       = useState(false);
  const [query, setQuery]     = useState("");
  const [members, setMembers] = useState<MemberResult[]>([]);
  const [guests, setGuests]   = useState<GuestResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const [mRes, gRes] = await Promise.all([
        fetch(`/api/ref/tenant-members?slug=${slug}&status=all&search=${encodeURIComponent(q)}`, { cache: "no-store" }),
        fetch(`/api/ref/post-authors?slug=${slug}&q=${encodeURIComponent(q)}`, { cache: "no-store" }),
      ]);
      const mData = await mRes.json() as { items: MemberResult[] };
      const gData = await gRes.json() as { items: GuestResult[] };
      setMembers(mData.items ?? []);
      setGuests(gData.items ?? []);
    } catch {
      setMembers([]); setGuests([]);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (!open) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void runSearch(query); }, 300);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [open, query, runSearch]);

  async function handlePickMember(memberId: string) {
    setPending(true);
    const res = await findOrCreatePostAuthorFromMemberAction(slug, memberId);
    setPending(false);
    if (res.success) {
      setResolved(res.data);
      onChange(res.data.id);
      setOpen(false);
      setQuery("");
    }
  }

  function handlePickGuest(g: GuestResult) {
    setResolved(g);
    onChange(g.id);
    setOpen(false);
    setQuery("");
  }

  async function handleCreateGuest(name: string) {
    setPending(true);
    const res = await createGuestPostAuthorAction(slug, { name });
    setPending(false);
    if (res.success) {
      setResolved(res.data);
      onChange(res.data.id);
      setOpen(false);
      setQuery("");
      setEditOpen(true); // langsung buka form bio/foto setelah profil baru dibuat
    }
  }

  function handleReset() {
    setResolved(null);
    onChange(null);
  }

  // ── Edit bio/foto — SHARED row, perubahan berlaku ke semua post yang memakai penulis ini ──
  const [editOpen, setEditOpen]     = useState(false);
  const [editName, setEditName]     = useState("");
  const [editBio, setEditBio]       = useState("");
  const [editAvatar, setEditAvatar] = useState<string | null>(null);
  const { open: pickerOpen, openPicker, closePicker } = useMediaPicker();

  useEffect(() => {
    if (editOpen && resolved) {
      setEditName(resolved.name);
      setEditBio(resolved.bio ?? "");
      setEditAvatar(resolved.avatarUrl);
    }
  }, [editOpen, resolved]);

  async function handleSaveEdit() {
    if (!resolved) return;
    setPending(true);
    const res = await updatePostAuthorAction(slug, resolved.id, {
      name: editName, bio: editBio || null, avatarUrl: editAvatar,
    });
    setPending(false);
    if (res.success) {
      setResolved(res.data);
      setEditOpen(false);
    }
  }

  return (
    <div className="space-y-2">
      {resolved ? (
        <div className="rounded-md border border-border p-2.5 space-y-2">
          <div className="flex items-center gap-2.5">
            {resolved.avatarUrl ? (
              <div className="relative h-9 w-9 shrink-0 rounded-full overflow-hidden bg-muted">
                <Image src={resolved.avatarUrl} alt={resolved.name} fill sizes="36px" className="object-cover" />
              </div>
            ) : (
              <div className="h-9 w-9 shrink-0 rounded-full bg-muted flex items-center justify-center">
                <UserRound className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{resolved.name}</p>
              {resolved.bio && <p className="text-xs text-muted-foreground truncate">{resolved.bio}</p>}
            </div>
          </div>
          <div className="flex gap-1.5">
            <Button type="button" variant="outline" size="sm" className="flex-1 h-7 text-xs gap-1" onClick={() => setEditOpen((v) => !v)}>
              <Pencil className="h-3 w-3" /> Edit Bio/Foto
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={handleReset}>
              Ganti
            </Button>
          </div>
        </div>
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="w-full rounded-md border border-dashed border-border px-3 py-2 text-left text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
            >
              {loadingResolved ? "Memuat..." : emptyHint}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-[320px] p-0" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
            <Command shouldFilter={false}>
              <CommandInput placeholder={`Cari ${label.toLowerCase()}...`} value={query} onValueChange={setQuery} />
              <CommandList className="max-h-64">
                {loading && <div className="py-4 text-center text-xs text-muted-foreground">Mencari...</div>}
                {!loading && members.length === 0 && guests.length === 0 && !query.trim() && (
                  <CommandEmpty>Ketik nama untuk mencari.</CommandEmpty>
                )}
                {!loading && members.length > 0 && (
                  <CommandGroup heading="Anggota">
                    {members.map((m) => (
                      <CommandItem key={m.id} value={m.name} onSelect={() => handlePickMember(m.id)} disabled={pending}>
                        <span className="truncate">{m.name}</span>
                        {m.memberNumber && (
                          <span className="ml-auto text-xs text-muted-foreground shrink-0">{m.memberNumber}</span>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {!loading && guests.length > 0 && (
                  <CommandGroup heading="Penulis Tersimpan">
                    {guests.map((g) => (
                      <CommandItem key={g.id} value={g.name} onSelect={() => handlePickGuest(g)} disabled={pending}>
                        <span className="truncate">{g.name}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {!loading && query.trim() && (
                  <CommandGroup heading="Buat Baru">
                    <CommandItem
                      value={`__create__${query}`}
                      onSelect={() => { void handleCreateGuest(query.trim()); }}
                      disabled={pending}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                      Buat penulis baru: &ldquo;{query.trim()}&rdquo;
                    </CommandItem>
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}

      {editOpen && (
        <div className="rounded-md border border-border p-2.5 space-y-2 bg-muted/30">
          <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Nama" className="h-8 text-sm" />
          <Textarea
            value={editBio}
            onChange={(e) => setEditBio(e.target.value)}
            placeholder="Bio singkat — mis. &quot;Wartawan senior di ...&quot;"
            className="text-xs min-h-16 resize-none"
          />
          <div className="flex items-center gap-2">
            {editAvatar ? (
              <div className="relative h-10 w-10 shrink-0 rounded-full overflow-hidden bg-muted">
                <Image src={editAvatar} alt="" fill sizes="40px" className="object-cover" />
              </div>
            ) : (
              <div className="h-10 w-10 shrink-0 rounded-full bg-muted flex items-center justify-center">
                <ImagePlus className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={openPicker}>
              {editAvatar ? "Ganti Foto" : "Pilih Foto"}
            </Button>
            {editAvatar && (
              <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditAvatar(null)}>
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
          <div className="flex gap-1.5 pt-1">
            <Button type="button" size="sm" className="flex-1 h-7 text-xs" onClick={() => { void handleSaveEdit(); }} disabled={pending}>
              Simpan
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditOpen(false)}>
              Batal
            </Button>
          </div>
        </div>
      )}

      <MediaPicker
        slug={slug}
        open={pickerOpen}
        onClose={closePicker}
        module="website"
        accept={["image/"]}
        onSelect={(item: MediaItem) => {
          const url = item.variants?.large ?? item.url;
          setEditAvatar(url);
          closePicker();
        }}
      />
    </div>
  );
}
