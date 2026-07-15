"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function MitraCancelApplyButton({ slug }: { slug: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleCancel() {
    if (!confirm("Batalkan pengajuan mitra ini?")) return;
    setPending(true);
    await fetch(`/api/mitra/apply?slug=${slug}`, { method: "DELETE" });
    setPending(false);
    router.refresh();
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => void handleCancel()}
      className="text-yellow-700 border-yellow-300 hover:bg-yellow-100"
    >
      {pending ? "Membatalkan..." : "Batalkan Pengajuan"}
    </Button>
  );
}
