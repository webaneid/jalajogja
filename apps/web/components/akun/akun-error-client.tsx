"use client";

import { authClient } from "@/lib/auth-client";
import { Button }     from "@/components/ui/button";
import { LogOut }     from "lucide-react";
import { useState }   from "react";

export function AkunErrorClient({ slug }: { slug: string }) {
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    await authClient.signOut();
    window.location.href = `/${slug}/register`;
  }

  return (
    <div className="flex flex-col gap-3">
      <Button
        onClick={handleSignOut}
        disabled={loading}
        className="w-full"
      >
        <LogOut className="h-4 w-4 mr-2" />
        {loading ? "Keluar..." : "Keluar dan Daftar Ulang"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Butuh bantuan?{" "}
        <a href={`/${slug}/`} className="text-primary hover:underline">
          Kembali ke beranda
        </a>
      </p>
    </div>
  );
}
