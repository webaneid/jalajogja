"use client";

import { usePathname } from "next/navigation";
import { PublicHeader } from "./public-header";
import type { HeaderProps, HeaderDesignId } from "@/lib/header-designs";
import { isSingleMobileRoute } from "@/lib/mobile-route-checks";

type Props = HeaderProps & { designId?: HeaderDesignId };

export function HeaderVisibility(props: Props) {
  const pathname = usePathname();
  const isSingle = isSingleMobileRoute(pathname, props.baseUrl);

  return (
    <div className={isSingle ? "hidden md:block" : ""}>
      <PublicHeader {...props} />
    </div>
  );
}
