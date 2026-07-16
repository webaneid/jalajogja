"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { ShoppingCart } from "lucide-react";
import { getCartCountAction } from "@/app/(public)/[tenant]/cart/actions";
import { cn } from "@/lib/utils";

export function CartButton({
  tenantSlug,
  baseUrl,
  className = "hidden md:flex",
}: {
  tenantSlug: string;
  baseUrl:    string;
  /** Kelas visibilitas responsif — default desktop-only agar backward compatible dengan header lama */
  className?: string;
}) {
  const [count, setCount]       = useState(0);
  const [, startTransition]     = useTransition();
  const pathname                = usePathname();

  // Refresh count setiap kali pathname berubah (navigasi antar halaman)
  // — menangkap perubahan setelah addToCartAction + revalidatePath
  useEffect(() => {
    startTransition(async () => {
      const n = await getCartCountAction(tenantSlug);
      setCount(n);
    });
  }, [pathname, tenantSlug]);

  return (
    <a
      href={`${baseUrl}/keranjang`}
      className={cn(
        "relative items-center justify-center h-8 w-8 rounded-full hover:bg-muted/60 text-muted-foreground transition-colors",
        className,
      )}
      aria-label="Keranjang belanja"
    >
      <ShoppingCart className="h-4 w-4" />
      {count > 0 && (
        <span
          className={cn(
            "absolute -top-1 -right-1 flex items-center justify-center",
            "min-w-[1.1rem] h-[1.1rem] rounded-full bg-primary text-primary-foreground",
            "text-[10px] font-bold leading-none px-1",
          )}
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </a>
  );
}
