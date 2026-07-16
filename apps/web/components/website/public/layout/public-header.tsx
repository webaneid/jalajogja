import type { HeaderProps, HeaderDesignId } from "@/lib/header-designs";
import { ClassicHeader } from "./headers/classic-header";
import { FlexHeader }    from "./headers/flex-header";
import { PillHeader }    from "./headers/pill-header";

type Props = HeaderProps & { designId?: HeaderDesignId };

export function PublicHeader({ designId = "flex", ...props }: Props) {
  switch (designId) {
    case "classic": return <ClassicHeader {...props} />;
    case "pill":    return <PillHeader {...props} />;
    case "flex":
    default:        return <FlexHeader {...props} />;
  }
}
