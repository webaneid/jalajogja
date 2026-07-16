import type { FooterProps, FooterDesignId } from "@/lib/footer-designs";
import { DarkFooter }   from "./footers/dark-footer";
import { LightFooter }  from "./footers/light-footer";
import { ModernFooter } from "./footers/modern-footer";

type Props = FooterProps & { designId?: FooterDesignId };

export function PublicFooter({ designId = "dark", ...props }: Props) {
  switch (designId) {
    case "light":  return <LightFooter {...props} />;
    case "modern": return <ModernFooter {...props} />;
    case "dark":
    default:       return <DarkFooter {...props} />;
  }
}
