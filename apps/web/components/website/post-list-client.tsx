"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Plus, MoreHorizontal, Pencil, Trash2, Eye, EyeOff, Search } from "lucide-react";
import { createPostDraftAction, deletePostAction, updatePostStatusAction } from "@/app/(dashboard)/[tenant]/website/actions";
import type { ContentStatus } from "@jalajogja/db";

// ── Types ─────────────────────────────────────────────────────────────────────

type Post = {
  id: string;
  title: string;
  slug: string;
  status: ContentStatus;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

// ── CreateButton ──────────────────────────────────────────────────────────────

export function CreateButton({ slug }: { slug: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleCreate() {
    startTransition(async () => {
      const res = await createPostDraftAction(slug);
      if (res.success) {
        router.push(`/${slug}/website/posts/${res.data.postId}/edit`);
      } else {
        alert(res.error);
      }
    });
  }

  return (
    <Button onClick={handleCreate} disabled={isPending} className="gap-2">
      <Plus className="h-4 w-4" />
      {isPending ? "Membuat..." : "Post Baru"}
    </Button>
  );
}

// ── SearchInput ───────────────────────────────────────────────────────────────

export function SearchInput({
  slug,
  status,
  defaultValue,
}: {
  slug: string;
  status?: string;
  defaultValue?: string;
}) {
  const router = useRouter();

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = (e.currentTarget.elements.namedItem("q") as HTMLInputElement).value;
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (q.trim()) params.set("q", q.trim());
    router.push(`/${slug}/website/posts?${params.toString()}`);
  }

  return (
    <form onSubmit={handleSearch} className="flex gap-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          name="q"
          placeholder="Cari post..."
          defaultValue={defaultValue}
          className="pl-8 w-52"
        />
      </div>
    </form>
  );
}

// ── RowActions (internal) ─────────────────────────────────────────────────────

function RowActions({ post, slug }: { post: Post; slug: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showDelete, setShowDelete] = useState(false);

  function handleDelete() {
    startTransition(async () => {
      const res = await deletePostAction(slug, post.id);
      if (!res.success) alert(res.error);
      setShowDelete(false);
    });
  }

  function handleTogglePublish() {
    const newStatus: ContentStatus =
      post.status === "published" ? "draft" : "published";
    startTransition(async () => {
      const res = await updatePostStatusAction(slug, post.id, newStatus);
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
          <DropdownMenuItem onClick={() => router.push(`/${slug}/website/posts/${post.id}/edit`)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleTogglePublish}>
            {post.status === "published" ? (
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
            <AlertDialogTitle>Hapus post?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{post.title}&rdquo; akan dihapus permanen. Aksi ini tidak bisa dibatalkan.
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

// ── StatusBadge (internal) ────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ContentStatus }) {
  const map: Record<ContentStatus, { label: string; variant: "default" | "secondary" | "outline" }> = {
    published: { label: "Terbit",   variant: "default" },
    draft:     { label: "Draft",    variant: "secondary" },
    archived:  { label: "Arsip",    variant: "outline" },
  };
  const { label, variant } = map[status] ?? { label: status, variant: "outline" };
  return <Badge variant={variant}>{label}</Badge>;
}

// ── PostsTable ────────────────────────────────────────────────────────────────

export function PostsTable({
  posts,
  slug,
  page,
  totalPages,
}: {
  posts: Post[];
  slug: string;
  page: number;
  totalPages: number;
}) {
  const router = useRouter();

  if (posts.length === 0) {
    return (
      <div className="rounded-lg border border-border p-12 text-center text-muted-foreground">
        Belum ada post. Klik &ldquo;Post Baru&rdquo; untuk mulai menulis.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-4 py-3 text-left font-medium">Judul</th>
              <th className="px-4 py-3 text-left font-medium w-28">Status</th>
              <th className="px-4 py-3 text-left font-medium w-40 hidden md:table-cell">Diperbarui</th>
              <th className="px-4 py-3 w-12" />
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => (
              <tr
                key={post.id}
                className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
              >
                <td className="px-4 py-3">
                  <button
                    onClick={() => router.push(`/${slug}/website/posts/${post.id}/edit`)}
                    className="text-left hover:underline font-medium"
                  >
                    {post.title}
                  </button>
                  <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                    /{post.slug}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={post.status} />
                </td>
                <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                  {post.updatedAt.toLocaleDateString("id-ID", {
                    day: "2-digit", month: "short", year: "numeric",
                  })}
                </td>
                <td className="px-4 py-3 text-right">
                  <RowActions post={post} slug={slug} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Halaman {page} dari {totalPages}</span>
          <div className="flex gap-2">
            {page > 1 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/${slug}/website/posts?page=${page - 1}`)}
              >
                Sebelumnya
              </Button>
            )}
            {page < totalPages && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/${slug}/website/posts?page=${page + 1}`)}
              >
                Berikutnya
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
