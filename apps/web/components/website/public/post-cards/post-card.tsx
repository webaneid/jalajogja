import type { PostCardData, PostCardVariant } from "@/lib/post-card-templates";
import { PostCardKlasik }  from "./post-card-klasik";
import { PostCardList }    from "./post-card-list";
import { PostCardOverlay } from "./post-card-overlay";
import { PostCardRingkas } from "./post-card-ringkas";
import { PostCardJudul }   from "./post-card-judul";
import { PostCardTicker }  from "./post-card-ticker";

type Props = {
  post:          PostCardData;
  variant:       PostCardVariant;
  tenantSlug:    string;
  primaryColor?: string;
  className?:    string;
};

export function PostCard({ post, variant, tenantSlug, primaryColor, className }: Props) {
  switch (variant) {
    case "list":    return <PostCardList    post={post} tenantSlug={tenantSlug} />;
    case "overlay": return <PostCardOverlay post={post} tenantSlug={tenantSlug} primaryColor={primaryColor} className={className} />;
    case "ringkas": return <PostCardRingkas post={post} tenantSlug={tenantSlug} />;
    case "judul":   return <PostCardJudul   post={post} tenantSlug={tenantSlug} />;
    case "ticker":  return <PostCardTicker  post={post} tenantSlug={tenantSlug} />;
    default:        return <PostCardKlasik  post={post} tenantSlug={tenantSlug} />;
  }
}
