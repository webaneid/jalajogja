"use client";

import { useState } from "react";
import { signOut } from "@/lib/auth-client";

export function SignOutButton() {
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    await signOut();
    // window.location.href WAJIB (bukan router.push) setelah sesi dihancurkan — full page
    // reload memastikan cookie baru dikirim dari awal, cegah middleware baca cookie basi.
    window.location.href = "/app/login";
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={loading}
      className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2
                 text-sm font-medium text-primary-foreground transition-opacity
                 hover:opacity-90 disabled:opacity-50"
    >
      {loading ? "Memproses..." : "Keluar & Coba Akun Lain"}
    </button>
  );
}
