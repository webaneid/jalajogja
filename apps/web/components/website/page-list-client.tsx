"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, MoreHorizontal, Pencil, Trash2, Eye, EyeOff } from "lucide-react";
import { createPageDraftAction, deletePageAction, updatePageStatusAction } from "@/app/(dashboard)/[tenant]/website/actions";
import type { ContentStatus } from "@jalajogja/db";

// ── Types ─────────────────────────────────────────────────────────────────────

type Page = {
  id: string;
  title: string;
  slug: string;
  status: ContentStatus;
  order: number;
  publishedAt: Date | null;
  updatedAt: Date;
};

// ── CreateButton ──────────────────────────────────────────────────────────────

export function CreatePageButton({ slug }: { slug: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleCreate() {
    startTransition(async () => {
      const res = await createPageDraftAction(slug);
      if (res.success) {
        router.push(`/${slug}/website/pages/${res.data.pageId}/edit`);
      } else {
        alert(res.error);
      }
    });
  }

  return (
    <Button onClick={handleCreate} disabled={isPending} className="gap-2">
      <Plus className="h-4 w-4" />
      {isPending ? "Membuat..." : "Halaman Baru"}
    </Button>
  );
}

// ── RowActions ────────────────────────────────────────────────────────────────

function RowActions({ page, slug }: { page: Page; slug: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showDelete, setShowDelete] = useState(false);

  function handleDelete() {
    startTransition(async () => {
      const res = await deletePageAction(slug, page.id);
      if (!res.success) alert(res.error);
      setShowDelete(false);
    });
  }

  function handleTogglePublish() {
    const newStatus: ContentStatus = page.status === "published" ? "draft" : "published";
    startTransition(async () => {
      const res = await updatePageStatusAction(slug, page.id, newStatus);
      if (!res.success) alert(res.error);
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={isPending}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => router.push(`/${slug}/website/pages/${page.id}/edit`)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleTogglePublish}>
            {page.status === "published" ? (
              <><EyeOff className="mr-2 h-4 w-4" /> Unpublish</>
            ) : (
              <><Eye className="mr-2 h-4 w-4" /> Publish</>
            )}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => setShowDelete(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Hapus
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus halaman?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{page.title}&rdquo; akan dihapus permanen. Aksi ini tidak bisa dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? "Menghapus..." : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ── StatusBadge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ContentStatus }) {
  const map: Record<ContentStatus, { label: string; variant: "default" | "secondary" | "outline" }> = {
    published: { label: "Terbit",  variant: "default" },
    draft:     { label: "Draft",   variant: "secondary" },
    archived:  { label: "Arsip",   variant: "outline" },
  };
  const { label, variant } = map[status] ?? { label: status, variant: "outline" };
  return <Badge variant={variant}>{label}</Badge>;
}

// ── PagesTable ────────────────────────────────────────────────────────────────

export function PagesTable({ pages, slug }: { pages: Page[]; slug: string }) {
  const router = useRouter();

  if (pages.length === 0) {
    return (
      <div className="rounded-lg border border-border p-12 text-center text-muted-foreground">
        Belum ada halaman. Klik &ldquo;Halaman Baru&rdquo; untuk mulai.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="px-4 py-3 text-left font-medium w-10 hidden sm:table-cell">#</th>
            <th className="px-4 py-3 text-left font-medium">Judul</th>
            <th className="px-4 py-3 text-left font-medium w-28">Status</th>
            <th className="px-4 py-3 text-left font-medium w-40 hidden md:table-cell">Diperbarui</th>
            <th className="px-4 py-3 w-12" />
          </tr>
        </thead>
        <tbody>
          {pages.map((page) => (
            <tr
              key={page.id}
              className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
            >
              <td className="px-4 py-3 text-muted-foreground text-xs hidden sm:table-cell">
                {page.order}
              </td>
              <td className="px-4 py-3">
                <button
                  onClick={() => router.push(`/${slug}/website/pages/${page.id}/edit`)}
                  className="text-left hover:underline font-medium"
                >
                  {page.title}
                </button>
                <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                  /{page.slug}
                </p>
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={page.status} />
              </td>
              <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                {page.updatedAt.toLocaleDateString("id-ID", {
                  day: "2-digit", month: "short", year: "numeric",
                })}
              </td>
              <td className="px-4 py-3 text-right">
                <RowActions page={page} slug={slug} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
