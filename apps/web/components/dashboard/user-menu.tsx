"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, ChevronDown, User } from "lucide-react";
import { signOut } from "@/lib/auth-client";

type UserMenuProps = {
  name: string;
  email: string;
  role: string;
};

export function UserMenu({ name, email, role }: UserMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    await signOut();
    router.push("/login");
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm
                   hover:bg-accent transition-colors"
      >
        {/* Avatar inisial */}
        <span className="flex h-7 w-7 items-center justify-center rounded-full
                         bg-primary text-xs font-semibold text-primary-foreground">
          {name.charAt(0).toUpperCase()}
        </span>
        <span className="hidden max-w-[120px] truncate font-medium sm:block">{name}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      {open && (
        <>
          {/* Overlay untuk tutup dropdown */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />

          <div className="absolute right-0 z-20 mt-1 w-56 rounded-lg border bg-card shadow-md">
            {/* Info user */}
            <div className="border-b px-4 py-3">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{name}</p>
                  <p className="truncate text-xs text-muted-foreground">{email}</p>
                </div>
              </div>
              <span className="mt-2 inline-block rounded-full bg-secondary px-2 py-0.5 text-xs capitalize text-secondary-foreground">
                {role}
              </span>
            </div>

            {/* Aksi */}
            <div className="p-1">
              <button
                onClick={handleSignOut}
                disabled={loading}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm
                           text-destructive hover:bg-destructive/10 transition-colors
                           disabled:opacity-50"
              >
                <LogOut className="h-4 w-4" />
                {loading ? "Keluar..." : "Keluar"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
