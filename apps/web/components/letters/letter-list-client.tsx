"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, FileText, Eye, FileDown, Copy } from "lucide-react";
import { deleteLetterAction } from "@/app/(dashboard)/[tenant]/letters/actions";

type LetterRow = {
  id:           string;
  letterNumber: string | null;
  subject:      string;
  sender:       string;
  recipient:    string;
  letterDate:   string;
  status:       string;
  isBulk:       boolean;
  pdfUrl:       string | null;
  createdAt:    Date;
};

type Props = {
  slug:           string;
  type:           "outgoing" | "incoming" | "internal";
  initialLetters: LetterRow[];
};

const STATUS_LABELS: Record<string, string> = {
  draft:    "Draft",
  sent:     "Terkirim",
  received: "Diterima",
  archived: "Diarsipkan",
};

const STATUS_COLORS: Record<string, string> = {
  draft:    "bg-zinc-100 text-zinc-600",
  sent:     "bg-blue-100 text-blue-700",
  received: "bg-green-100 text-green-700",
  archived: "bg-yellow-100 text-yellow-700",
};

const TYPE_NEW_HREF: Record<string, string> = {
  outgoing: "keluar/new",
  incoming: "masuk/new",
  internal: "nota/new",
};

const TYPE_PREFIX: Record<string, string> = {
  outgoing: "keluar",
  incoming: "masuk",
  internal: "nota",
};

export function LetterListClient({ slug, type, initialLetters }: Props) {
  const [letters, setLetters] = useState<LetterRow[]>(initialLetters);
  const [search,  setSearch]  = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const filtered = letters.filter((l) =>
    !search ||
    l.subject.toLowerCase().includes(search.toLowerCase()) ||
    (l.letterNumber ?? "").toLowerCase().includes(search.toLowerCase()) ||
    l.recipient.toLowerCase().includes(search.toLowerCase())
  );

  function handleDelete(letterId: string) {
    const l = letters.find((x) => x.id === letterId);
    if (!confirm(`Hapus surat "${l?.subject || letterId}"?`)) return;
    setError("");

    startTransition(async () => {
      const res = await deleteLetterAction(slug, letterId);
      if (res.success) {
        setLetters((prev) => prev.filter((x) => x.id !== letterId));
      } else {
        setError(res.error);
      }
    });
  }

  const newHref  = `/${slug}/letters/${TYPE_NEW_HREF[type]}`;
  const prefix   = `/${slug}/letters/${TYPE_PREFIX[type]}`;
  const hasDetail = type !== "incoming"; // masuk tidak punya halaman detail terpisah

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          type="search"
          placeholder="Cari surat…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <Link
          href={newHref}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          {type === "incoming" ? "Catat Surat Masuk" : type === "internal" ? "Nota Dinas Baru" : "Surat Baru"}
        </Link>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-12 text-center">
          <FileText className="h-8 w-8 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">
            {search ? "Tidak ada surat yang cocok" : "Belum ada surat"}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nomor</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Perihal</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  {type === "incoming" ? "Pengirim" : "Kepada"}
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tanggal</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((letter) => (
                <tr key={letter.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                    {letter.letterNumber ?? "—"}
                  </td>
                  <td className="px-4 py-3 font-medium max-w-xs">
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`${prefix}/${letter.id}`}
                        className="truncate hover:underline underline-offset-2"
                        title="Buka detail surat"
                      >
                        {letter.subject || <span className="text-muted-foreground italic">Tanpa perihal</span>}
                      </Link>
                      {/* Badge bulk — surat induk massal */}
                      {letter.isBulk && (
                        <span title="Surat massal" className="shrink-0">
                          <Copy className="h-3 w-3 text-muted-foreground/60" />
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground truncate max-w-[160px]">
                    {type === "incoming" ? letter.sender : letter.recipient}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {letter.letterDate}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[letter.status] ?? "bg-muted text-muted-foreground"}`}>
                      {STATUS_LABELS[letter.status] ?? letter.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {/* Lihat detail */}
                      <Link
                        href={`${prefix}/${letter.id}`}
                        title="Lihat detail"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                      {/* Download PDF jika sudah ada */}
                      {letter.pdfUrl && (
                        <a
                          href={letter.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Download PDF"
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <FileDown className="h-4 w-4" />
                        </a>
                      )}
                      {/* Edit — tidak untuk surat masuk */}
                      {type !== "incoming" && (
                        <Link
                          href={`${prefix}/${letter.id}/edit`}
                          title="Edit"
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Pencil className="h-4 w-4" />
                        </Link>
                      )}
                      {/* Hapus */}
                      <button
                        type="button"
                        onClick={() => handleDelete(letter.id)}
                        disabled={pending}
                        title="Hapus"
                        className="text-muted-foreground hover:text-destructive disabled:opacity-40"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
