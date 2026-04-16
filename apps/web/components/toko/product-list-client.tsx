"use client";

import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

export function ProductListClient({ slug }: { slug: string }) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.push(`/${slug}/toko/produk/new`)}
      className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
    >
      <Plus className="h-4 w-4" />
      Produk Baru
    </button>
  );
}
