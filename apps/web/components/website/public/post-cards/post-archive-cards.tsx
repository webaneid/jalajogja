import type { PostCardData } from "@/lib/post-card-templates";
import type { PostArchiveCardDesignId } from "@/lib/post-archive-card-designs";
import { PostArchiveCardsDesign1 } from "./post-archive-cards-design-1";

type Props = {
  design:  PostArchiveCardDesignId;
  posts:   PostCardData[];
  baseUrl: string;
};

// Dispatcher desain kartu arsip post — dipakai di /post (arsip + filter kategori + search).
// Nambah desain baru: tambah ID di lib/post-archive-card-designs.ts + case di sini + komponen
// post-archive-cards-design-N.tsx baru.
export function PostArchiveCards({ design, posts, baseUrl }: Props) {
  switch (design) {
    default: return <PostArchiveCardsDesign1 posts={posts} baseUrl={baseUrl} />;
  }
}
