"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { removeMemberFromTenantAction } from "../actions";

export function DeleteMemberButton({
  slug,
  memberId,
  memberName,
}: {
  slug: string;
  memberId: string;
  memberName: string;
}) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await removeMemberFromTenantAction(slug, memberId);
      if (result.success) {
        router.push(`/${slug}/members`);
      }
    });
  }

  if (confirm) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/5 px-3 py-2">
        <span className="text-xs text-destructive">Hapus {memberName}?</span>
        <button
          onClick={handleDelete}
          disabled={isPending}
          className="rounded-md bg-destructive px-2.5 py-1 text-xs font-medium
                     text-destructive-foreground hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? "..." : "Ya"}
        </button>
        <button
          onClick={() => setConfirm(false)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Batal
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirm(true)}
      className="flex items-center gap-1.5 rounded-lg border border-destructive/40 px-3 py-2
                 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
    >
      <Trash2 className="h-4 w-4" /> Hapus
    </button>
  );
}
