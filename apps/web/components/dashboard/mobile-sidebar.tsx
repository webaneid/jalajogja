"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Sidebar } from "./sidebar";

type MobileSidebarProps = {
  slug: string;
  orgName: string;
};

export function MobileSidebar({ slug, orgName }: MobileSidebarProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Tombol hamburger — hanya muncul di mobile */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center justify-center rounded-md p-1.5
                   hover:bg-accent transition-colors md:hidden"
        aria-label="Buka menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Overlay + drawer */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-30 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-40 flex">
            <Sidebar slug={slug} orgName={orgName} />
            <button
              onClick={() => setOpen(false)}
              className="absolute right-2 top-2 rounded-md p-1 hover:bg-accent"
              aria-label="Tutup menu"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </>
      )}
    </>
  );
}
