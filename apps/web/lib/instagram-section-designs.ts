export function getInstagramShortcode(url: string): string | null {
  if (!url) return null;
  const match = url.match(/instagram\.com\/(?:p|reel)\/([A-Za-z0-9_-]+)/i);
  return match ? match[1] : null;
}

export type InstagramMode = "post" | "repost";

export type InstagramItem = {
  id:        string;
  imageUrl:  string;
  caption?:  string;
  postUrl?:  string;
};

export type InstagramSectionData = {
  mode?:          InstagramMode;          // "repost" (default) | "post"
  accountName?:   string;                 // "Forcreator" -> "Linimasa Forcreator ->"
  accountUrl?:    string;                 // "https://instagram.com/forcreator"
  count?:         number;                 // 4, 8 (default), 12, 16
  showBorderTop?: boolean;                // default false
  postUrls?:      string[];               // URL postingan resmi Instagram (misal https://instagram.com/p/C-xyz)
  items?:         InstagramItem[];        // list foto custom yang di-upload
};

export const INSTAGRAM_SECTION_DESIGN_IDS = ["1"] as const;
export type InstagramSectionDesignId = typeof INSTAGRAM_SECTION_DESIGN_IDS[number];

export type InstagramSectionDesignMeta = {
  label:       string;
  description: string;
};

export const INSTAGRAM_SECTION_DESIGNS: Record<InstagramSectionDesignId, InstagramSectionDesignMeta> = {
  "1": {
    label:       "Grid Foto Instagram",
    description: "Header simpel (Repost/Post dari + Ikon Instagram + Link Linimasa warna Secondary) dan grid foto square 4 kolom.",
  },
};

// Mock sample items jika admin belum unggah foto custom
export const DEFAULT_INSTAGRAM_MOCK_ITEMS: InstagramItem[] = [
  { id: "1", imageUrl: "https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=800&q=80", caption: "Kertas Gontor" },
  { id: "2", imageUrl: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=800&q=80", caption: "Karya Instalasi Seni" },
  { id: "3", imageUrl: "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=800&q=80", caption: "Kaligrafi Festival" },
  { id: "4", imageUrl: "https://images.unsplash.com/photo-1561089489-f13d5e730d72?auto=format&fit=crop&w=800&q=80", caption: "Karya Seni Lukis" },
  { id: "5", imageUrl: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=800&q=80", caption: "Kaligrafi Kontemporer" },
  { id: "6", imageUrl: "https://images.unsplash.com/photo-1582562124811-c09040d0a901?auto=format&fit=crop&w=800&q=80", caption: "Seni Mural Kreatif" },
  { id: "7", imageUrl: "https://images.unsplash.com/photo-1577083552431-6e5fd01aa342?auto=format&fit=crop&w=800&q=80", caption: "Pameran Kaligrafi" },
  { id: "8", imageUrl: "https://images.unsplash.com/photo-1536924940846-227afb31e2a5?auto=format&fit=crop&w=800&q=80", caption: "Pertunjukan Teater" },
];
