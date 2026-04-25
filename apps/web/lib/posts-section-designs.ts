import type { PostCardData } from "@/lib/post-card-templates";

export type PostsSectionData = {
  title:         string;
  count:         number;
  categoryId?:   string | null;
  onlyFeatured?: boolean;
};

export const POSTS_SECTION_DESIGN_IDS = ["1", "2", "3", "4", "5"] as const;
export type PostsSectionDesignId = typeof POSTS_SECTION_DESIGN_IDS[number];

export type PostsSectionDesignMeta = {
  label:          string;
  description:    string;
  minCount:       number;
  needsFeatured?: boolean;
};

export const POSTS_SECTION_DESIGNS: Record<PostsSectionDesignId, PostsSectionDesignMeta> = {
  "1": { label: "Hero 3 Kolom",     description: "Tiga kolom: terkini kiri-kanan, unggulan di tengah.", minCount: 5, needsFeatured: true },
  "2": { label: "Featured + Grid",  description: "Satu card besar di atas, grid kecil di bawah.",       minCount: 4 },
  "3": { label: "List Vertikal",    description: "Daftar panjang horizontal per baris.",                 minCount: 3 },
  "4": { label: "Ticker / Marquee", description: "Running text judul berita terbaru.",                   minCount: 5 },
  "5": { label: "Magazine",         description: "Layout majalah: besar + kolom samping.",               minCount: 5 },
};

export type PostsSectionProps = {
  data:           PostsSectionData;
  posts:          PostCardData[];
  featuredPosts?: PostCardData[];
  tenantSlug:     string;
};
