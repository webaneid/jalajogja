"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";

type Props = {
  slug: string;
  createAction: (slug: string) => Promise<
    { success: true; data: { productId: string } } | { success: false; error: string }
  >;
};

export function ProductListClient({ slug, createAction }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function handleCreate() {
    setError("");
    startTransition(async () => {
      const res = await createAction(slug);
      if (res.success) {
        router.push(`/${slug}/toko/produk/${res.data.productId}/edit`);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div>
      {error && <p className="text-xs text-destructive mb-2">{error}</p>}
      <button
        type="button"
        onClick={handleCreate}
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        Produk Baru
      </button>
    </div>
  );
}
