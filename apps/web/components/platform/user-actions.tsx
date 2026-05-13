"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ToggleLeft, ToggleRight, KeyRound } from "lucide-react";
import {
  togglePlatformUserActiveAction,
  resetPlatformUserPasswordAction,
} from "@/app/(platform)/platform/actions";
import type { PlatformUserRole } from "@jalajogja/db";

export function PlatformUserActions({
  userId,
  isActive,
  role,
}: {
  userId:   string;
  isActive: boolean;
  role:     PlatformUserRole;
}) {
  const router = useRouter();
  const [pending,    startTransition]    = useTransition();
  const [showReset,  setShowReset]       = useState(false);
  const [newPw,      setNewPw]           = useState("");
  const [resetError, setResetError]      = useState("");
  const [resetOk,    setResetOk]         = useState(false);

  function handleToggle() {
    if (!confirm(isActive ? "Non-aktifkan pengguna ini?" : "Aktifkan pengguna ini?")) return;
    startTransition(async () => {
      await togglePlatformUserActiveAction(userId, !isActive);
      router.refresh();
    });
  }

  function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setResetError("");
    startTransition(async () => {
      const res = await resetPlatformUserPasswordAction(userId, newPw);
      if (res?.error) {
        setResetError(res.error);
      } else {
        setResetOk(true);
        setNewPw("");
        setTimeout(() => { setShowReset(false); setResetOk(false); }, 1500);
      }
    });
  }

  return (
    <div className="flex items-center gap-1 justify-end">
      <button
        type="button"
        onClick={() => setShowReset((v) => !v)}
        className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        title="Reset password"
      >
        <KeyRound size={15} />
      </button>
      <button
        type="button"
        onClick={handleToggle}
        disabled={pending}
        className={`rounded-md p-1.5 transition-colors ${
          isActive
            ? "text-green-600 hover:text-red-600 hover:bg-red-50"
            : "text-muted-foreground hover:text-green-600 hover:bg-green-50"
        }`}
        title={isActive ? "Non-aktifkan" : "Aktifkan"}
      >
        {isActive ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
      </button>

      {showReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <form
            onSubmit={handleReset}
            className="bg-background rounded-xl border border-border shadow-lg p-5 w-80 space-y-3"
          >
            <p className="font-semibold text-sm">Reset Password</p>
            {resetOk && <p className="text-sm text-green-600">Password berhasil direset.</p>}
            {resetError && <p className="text-sm text-destructive">{resetError}</p>}
            <input
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder="Password baru (min. 8 karakter)"
              required
              minLength={8}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={pending}
                className="flex-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {pending ? "Menyimpan..." : "Simpan"}
              </button>
              <button
                type="button"
                onClick={() => setShowReset(false)}
                className="flex-1 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
              >
                Batal
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
