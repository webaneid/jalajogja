"use client";

import { useTransition } from "react";
import { toggleCabangActiveAction } from "../actions";

export function CabangActions({ id, isActive }: { id: string; isActive: boolean }) {
  const [pending, start] = useTransition();

  return (
    <button
      disabled={pending}
      onClick={() => start(() => toggleCabangActiveAction(id, !isActive))}
      className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
    >
      {isActive ? "Non-aktifkan" : "Aktifkan"}
    </button>
  );
}
