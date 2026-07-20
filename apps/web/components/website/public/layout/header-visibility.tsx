"use client";

import { usePathname } from "next/navigation";
import { PublicHeader } from "./public-header";
import type { HeaderProps, HeaderDesignId } from "@/lib/header-designs";
import { isSingleMobileRoute, isAkunAppMode } from "@/lib/mobile-route-checks";

type Props = HeaderProps & { designId?: HeaderDesignId };

export function HeaderVisibility(props: Props) {
  const pathname = usePathname();
  const hideOnMobile = isSingleMobileRoute(pathname, props.baseUrl) || isAkunAppMode(pathname, props.baseUrl);

  return (
    <div className={hideOnMobile ? "hidden md:block" : ""}>
      <PublicHeader {...props} />
    </div>
  );
}
