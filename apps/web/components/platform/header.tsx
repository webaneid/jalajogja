"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOut, ChevronDown } from "lucide-react";
import type { PlatformUserRole } from "@jalajogja/db";

export function PlatformHeader({
  name,
  email,
  role,
}: {
  name:  string;
  email: string;
  role:  PlatformUserRole;
}) {
  const router = useRouter();
  const [open,    setOpen]    = useState(false);
  const [pending, startTransition] = useTransition();

  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  function handleLogout() {
    startTransition(async () => {
      await fetch("/api/platform/auth/logout", { method: "POST" });
      router.push("/platform/login");
    });
  }

  return (
    <header className="h-14 border-b border-border bg-background flex items-center justify-end px-5 shrink-0">
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted transition-colors text-sm"
        >
          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary">
            {initials}
          </div>
          <span className="font-medium">{name}</span>
          <ChevronDown size={14} className="text-muted-foreground" />
        </button>

        {open && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setOpen(false)}
            />
            <div className="absolute right-0 top-full mt-1 z-20 w-52 rounded-lg border border-border bg-background shadow-md py-1 text-sm">
              <div className="px-3 py-2 border-b border-border">
                <p className="font-medium truncate">{name}</p>
                <p className="text-xs text-muted-foreground truncate">{email}</p>
                <p className="text-xs text-muted-foreground capitalize mt-0.5">{role}</p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                disabled={pending}
                className="w-full flex items-center gap-2 px-3 py-2 text-destructive hover:bg-muted transition-colors"
              >
                <LogOut size={14} />
                {pending ? "Keluar..." : "Keluar"}
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
