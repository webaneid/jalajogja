import type { PostCardData } from "@/lib/post-card-templates";

export type PostColumnConfig = {
  categoryId?: string | null;
  tagId?:      string | null;
  count?:      number;
};

export type PostsSectionData = {
  title:         string;
  count:         number;
  categoryId?:   string | null;
  tagId?:        string | null;
  onlyFeatured?: boolean;
  columns?:      PostColumnConfig[];
};

export const POSTS_SECTION_DESIGN_IDS = ["1", "2", "3", "4", "5"] as const;
export type PostsSectionDesignId = typeof POSTS_SECTION_DESIGN_IDS[number];

export type PostsSectionDesignMeta = {
  label:            string;
  description:      string;
  minCount:         number;
  type:             "hero" | "section";
  needsFeatured?:   boolean;
  needsColumnData?: boolean;
};

export const POSTS_SECTION_DESIGNS: Record<PostsSectionDesignId, PostsSectionDesignMeta> = {
  "1": { label: "Hero 3 Kolom",  description: "Tiga kolom: terkini kiri-kanan, unggulan di tengah.", minCount: 5, type: "hero",    needsFeatured: true },
  "2": { label: "Klasik",        description: "Featured atas (gambar + teks 50/50) + 2 kolom list.", minCount: 6, type: "section" },
  "3": { label: "Twin Columns",  description: "Dua kolom sejajar, judul dari nama kategori/tag.",    minCount: 4, type: "section" },
  "4": { label: "Trio Column",   description: "Tiga kolom, tiap kolom filter kategori/tag sendiri.", minCount: 3, type: "section", needsColumnData: true },
  "5": { label: "Post Carousel", description: "Sliding carousel overlay card, portrait 3:4.",        minCount: 3, type: "section" },
};

export type ColumnRenderData = {
  posts:        PostCardData[];
  filterLabel?: string;
  filterHref?:  string;
};

export type PostsSectionProps = {
  data:           PostsSectionData;
  posts:          PostCardData[];
  featuredPosts?: PostCardData[];
  tenantSlug:     string;
  sectionTitle:   string;   // sudah di-resolve: filterLabel ?? data.title ?? "Berita Terbaru"
  filterHref:     string;   // selalu terisi: /post?category=x | /post?tag=x | /post
  columnData?:    ColumnRenderData[];
};
