"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Search, Pencil, Trash2, CalendarDays } from "lucide-react";
import { deleteEventAction } from "@/app/(dashboard)/[tenant]/event/actions";

// ─── Types ────────────────────────────────────────────────────────────────────

type Event = {
  id:        string;
  slug:      string;
  title:     string;
  eventType: string;
  status:    string;
  startsAt:  Date | null;
  endsAt:    Date | null;
  location:  string | null;
  createdAt: Date;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  draft:      { label: "Draft",       variant: "secondary"    },
  published:  { label: "Dipublikasi", variant: "default"      },
  cancelled:  { label: "Dibatalkan",  variant: "destructive"  },
  completed:  { label: "Selesai",     variant: "outline"      },
};

const TYPE_MAP: Record<string, string> = {
  offline: "Offline",
  online:  "Online",
  hybrid:  "Hybrid",
};

function formatDate(d: Date | null) {
  if (!d) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric", month: "short", year: "numeric",
  }).format(new Date(d));
}

// ─── CreateEventButton ────────────────────────────────────────────────────────

export function CreateEventButton({ slug }: { slug: string }) {
  const router = useRouter();
  return (
    <Button size="sm" onClick={() => router.push(`/${slug}/event/acara/new`)}>
      <Plus className="h-4 w-4 mr-1" />
      Event Baru
    </Button>
  );
}

// ─── EventTable ───────────────────────────────────────────────────────────────

export function EventTable({ slug, events: initialEvents }: { slug: string; events: Event[] }) {
  const [events,  setEvents]  = useState<Event[]>(initialEvents);
  const [search,  setSearch]  = useState("");
  const [delId,   setDelId]   = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = events.filter((e) =>
    e.title.toLowerCase().includes(search.toLowerCase()) ||
    e.location?.toLowerCase().includes(search.toLowerCase())
  );

  function handleDelete(eventId: string) {
    if (!confirm("Hapus event ini? Aksi ini tidak bisa dibatalkan.")) return;
    setDelId(eventId);
    startTransition(async () => {
      const res = await deleteEventAction(slug, eventId);
      if (res.success) {
        setEvents((prev) => prev.filter((e) => e.id !== eventId));
      } else {
        alert(res.error);
      }
      setDelId(null);
    });
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cari event..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground border-2 border-dashed rounded-lg">
          <CalendarDays className="h-8 w-8" />
          <p className="text-sm">
            {search ? "Tidak ada event yang sesuai pencarian." : "Belum ada event. Buat event pertama!"}
          </p>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Judul</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Jenis</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tanggal</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((event) => {
                const st = STATUS_MAP[event.status] ?? { label: event.status, variant: "outline" as const };
                return (
                  <tr key={event.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium">{event.title}</div>
                      {event.location && (
                        <div className="text-xs text-muted-foreground mt-0.5 truncate max-w-[240px]">
                          {event.location}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {TYPE_MAP[event.eventType] ?? event.eventType}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {formatDate(event.startsAt)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={st.variant}>{st.label}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <Link href={`/${slug}/event/acara/${event.id}/edit`}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(event.id)}
                          disabled={isPending && delId === event.id}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
