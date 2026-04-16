"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Pencil,
  Trash2,
  Plus,
  Search,
  HeartHandshake,
} from "lucide-react";
import {
  deleteCampaignAction,
} from "@/app/(dashboard)/[tenant]/donasi/actions";

// ─── Types ────────────────────────────────────────────────────────────────────

type Campaign = {
  id:              string;
  slug:            string;
  title:           string;
  campaignType:    string;
  status:          string;
  targetAmount:    string | null;
  collectedAmount: string;
  createdAt:       Date;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRupiah(amount: string | null) {
  if (!amount) return null;
  const n = parseFloat(amount);
  return new Intl.NumberFormat("id-ID", {
    style: "currency", currency: "IDR", minimumFractionDigits: 0,
  }).format(n);
}

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  draft:    { label: "Draft",    variant: "secondary" },
  active:   { label: "Aktif",   variant: "default"   },
  closed:   { label: "Ditutup", variant: "outline"   },
  archived: { label: "Arsip",   variant: "outline"   },
};

const TYPE_MAP: Record<string, string> = {
  donasi: "Donasi",
  zakat:  "Zakat",
  wakaf:  "Wakaf",
  qurban: "Qurban",
};

// ─── CreateButton ─────────────────────────────────────────────────────────────

export function CreateCampaignButton({ slug }: { slug: string }) {
  const router = useRouter();

  return (
    <Button onClick={() => router.push(`/${slug}/donasi/campaign/new`)} size="sm">
      <Plus className="h-4 w-4 mr-1.5" />
      Campaign Baru
    </Button>
  );
}

// ─── CampaignTable ────────────────────────────────────────────────────────────

export function CampaignTable({
  slug,
  campaigns,
}: {
  slug:      string;
  campaigns: Campaign[];
}) {
  const [search,  setSearch]  = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [, startTransition]   = useTransition();

  const filtered = campaigns.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    c.slug.toLowerCase().includes(search.toLowerCase())
  );

  function handleDelete(id: string) {
    if (!confirm("Hapus campaign ini? Aksi ini tidak bisa dibatalkan.")) return;
    setDeleting(id);
    startTransition(async () => {
      await deleteCampaignAction(slug, id);
      setDeleting(null);
    });
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cari campaign..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 h-9"
        />
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <HeartHandshake className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {search ? "Tidak ada campaign yang cocok" : "Belum ada campaign"}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Campaign</th>
                <th className="px-4 py-2.5 text-left font-medium">Jenis</th>
                <th className="px-4 py-2.5 text-left font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium">Terkumpul</th>
                <th className="px-4 py-2.5 text-right font-medium">Target</th>
                <th className="px-4 py-2.5 text-right font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((c) => {
                const st = STATUS_MAP[c.status] ?? { label: c.status, variant: "outline" as const };
                return (
                  <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/${slug}/donasi/campaign/${c.id}`}
                        className="font-medium hover:underline"
                      >
                        {c.title}
                      </Link>
                      <p className="text-xs text-muted-foreground font-mono">{c.slug}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {TYPE_MAP[c.campaignType] ?? c.campaignType}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={st.variant}>{st.label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-green-700">
                      {formatRupiah(c.collectedAmount) ?? "Rp 0"}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {c.targetAmount ? formatRupiah(c.targetAmount) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/${slug}/donasi/campaign/${c.id}/edit`}>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          disabled={deleting === c.id}
                          onClick={() => handleDelete(c.id)}
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
