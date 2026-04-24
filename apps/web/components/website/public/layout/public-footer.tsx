import type { FooterProps, FooterDesignId } from "@/lib/footer-designs";
import { DarkFooter } from "./footers/dark-footer";

type Props = FooterProps & { designId?: FooterDesignId };

export function PublicFooter({ designId = "dark", ...props }: Props) {
  switch (designId) {
    case "dark":
    default: return <DarkFooter {...props} />;
    // "light" belum diimplementasikan — fallback ke dark
  }
}
