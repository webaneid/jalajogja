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
  mode?:          InstagramMode;          // "repost" (default) | "post" — LABEL header saja,
                                           // bukan penentu sumber data (lihat instagram-feed.server.ts)
  accountName?:   string;                 // override tampilan nama akun (opsional — default dari akun yang terhubung)
  accountUrl?:    string;                 // override URL linimasa (opsional — default dari akun yang terhubung)
  count?:         number;                 // 4, 8 (default), 12, 16
  showBorderTop?: boolean;                // default false
  postUrls?:      string[];               // opsi sekunder: tempel URL post publik untuk embed resmi
                                           // Instagram — dipakai kalau admin belum/tidak connect OAuth.
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
