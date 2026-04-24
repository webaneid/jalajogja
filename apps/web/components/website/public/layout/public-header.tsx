import type { HeaderProps, HeaderDesignId } from "@/lib/header-designs";
import { ClassicHeader } from "./headers/classic-header";
import { FlexHeader }    from "./headers/flex-header";

type Props = HeaderProps & { designId?: HeaderDesignId };

export function PublicHeader({ designId = "flex", ...props }: Props) {
  switch (designId) {
    case "classic": return <ClassicHeader {...props} />;
    case "flex":
    default:        return <FlexHeader {...props} />;
  }
}
