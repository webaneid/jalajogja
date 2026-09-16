"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  approveForumMembershipAction,
  rejectForumMembershipAction,
  suspendForumMembershipAction,
  reactivateForumMembershipAction,
} from "@/app/(dashboard)/app/[tenant]/members/actions";

type PendingAction = "approve" | "reject" | "suspend" | "reactivate";

const ACTION_FN: Record<PendingAction, (slug: string, memberId: string) => Promise<{ success: boolean; error?: string }>> = {
  approve:    approveForumMembershipAction,
  reject:     rejectForumMembershipAction,
  suspend:    suspendForumMembershipAction,
  reactivate: reactivateForumMembershipAction,
};

const ACTION_LABEL: Record<PendingAction, string> = {
  approve: "Setujui", reject: "Tolak", suspend: "Tangguhkan", reactivate: "Aktifkan kembali",
};

// Aksi admin forum: approve/tolak/suspend/aktifkan-kembali — kapabilitas MANUAL opsional
// (docs/arsitektur-gabung-forum.md § 5), dipakai di list DAN detail. `forumStatus=null`
// (baris cabang/marhalah) tidak pernah render apa pun — dijaga di caller juga, defensif di sini.
export function ForumStatusActions({
  slug, memberId, forumStatus,
}: {
  slug: string;
  memberId: string;
  forumStatus: "pending" | "active" | "suspended" | "rejected" | null;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState<PendingAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(action: PendingAction) {
    setError(null);
    startTransition(async () => {
      const result = await ACTION_FN[action](slug, memberId);
      if (result.success) {
        setConfirming(null);
        router.refresh();
      } else {
        setError(result.error ?? "Gagal memproses.");
      }
    });
  }

  if (confirming) {
    return (
      <div className="flex flex-col items-start gap-1">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{ACTION_LABEL[confirming]}?</span>
          <button
            onClick={() => run(confirming)}
            disabled={isPending}
            className="rounded-md bg-primary px-2 py-1 text-xs font-medium
                       text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? "..." : "Ya"}
          </button>
          <button
            onClick={() => setConfirming(null)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Batal
          </button>
        </div>
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
    );
  }

  if (forumStatus === "pending") {
    return (
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setConfirming("approve")}
          className="rounded-md border border-green-600/40 px-2 py-1 text-xs font-medium
                     text-green-700 hover:bg-green-50 transition-colors"
        >
          Setujui
        </button>
        <button
          onClick={() => setConfirming("reject")}
          className="rounded-md border border-destructive/40 px-2 py-1 text-xs font-medium
                     text-destructive hover:bg-destructive/10 transition-colors"
        >
          Tolak
        </button>
      </div>
    );
  }

  if (forumStatus === "active") {
    return (
      <button
        onClick={() => setConfirming("suspend")}
        className="rounded-md border border-orange-500/40 px-2 py-1 text-xs font-medium
                   text-orange-700 hover:bg-orange-50 transition-colors"
      >
        Tangguhkan
      </button>
    );
  }

  if (forumStatus === "suspended") {
    return (
      <button
        onClick={() => setConfirming("reactivate")}
        className="rounded-md border border-green-600/40 px-2 py-1 text-xs font-medium
                   text-green-700 hover:bg-green-50 transition-colors"
      >
        Aktifkan Kembali
      </button>
    );
  }

  return null; // rejected: tidak ada aksi UI (§ 6 docs/arsitektur-gabung-forum.md)
}
