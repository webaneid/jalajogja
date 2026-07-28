import type { PostCardData, PostCardVariant } from "@/lib/post-card-templates";
import { PostCardKlasik }  from "./post-card-klasik";
import { PostCardList }    from "./post-card-list";
import { PostCardOverlay } from "./post-card-overlay";
import { PostCardRingkas } from "./post-card-ringkas";
import { PostCardJudul }   from "./post-card-judul";
import { PostCardTicker }  from "./post-card-ticker";

type Props = {
  post:       PostCardData;
  variant:    PostCardVariant;
  baseUrl:    string;
  className?: string;
};

export function PostCard({ post, variant, baseUrl, className }: Props) {
  switch (variant) {
    case "list":    return <PostCardList    post={post} baseUrl={baseUrl} />;
    case "overlay": return <PostCardOverlay post={post} baseUrl={baseUrl} className={className} />;
    case "ringkas": return <PostCardRingkas post={post} baseUrl={baseUrl} />;
    case "judul":   return <PostCardJudul   post={post} baseUrl={baseUrl} />;
    case "ticker":  return <PostCardTicker  post={post} baseUrl={baseUrl} />;
    default:        return <PostCardKlasik  post={post} baseUrl={baseUrl} />;
  }
}
