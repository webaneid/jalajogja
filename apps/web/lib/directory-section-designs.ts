export type DirectoryType = "usaha" | "profesional" | "pesantren";
export type DirectoryTitleStyle = "default" | "simple";
export type DirectoryGridCols = 2 | 3 | 4;
export type DirectoryCardDesign = "default" | "custom";

export type DirectoryItem = {
  id:           string;
  title:        string;
  description:  string;
  imageUrl?:    string;
  location?:    string;          // "Pejaten Timur, Jakarta Selatan"
  category?:    string;          // "Desain Komunikasi Visual"
  ownerName?:   string;          // "Reza Alfarabi"
  ownerAvatar?: string;          // URL foto avatar pemilik
  href:         string;
};

export type DirectorySectionData = {
  directoryType?:  DirectoryType;        // "usaha" (default) | "profesional" | "pesantren"
  titleStyle?:     DirectoryTitleStyle;   // "default" | "simple"
  title?:          string;               // override judul section (opsional)
  eyebrow?:        string;
  headerDesc?:     string;
  count?:          number;               // 2 s/d 8 (default 4)
  gridCols?:       DirectoryGridCols;    // 2 | 3 | 4 (default 3)
  cardDesign?:     DirectoryCardDesign;  // "default" | "custom" (default custom)
  imageCorner?:    "rounded" | "square"; // "rounded" (Sudut Melengkung) vs "square" (Persegi Tajam)
};

export const DIRECTORY_SECTION_DESIGN_IDS = ["1"] as const;
export type DirectorySectionDesignId = typeof DIRECTORY_SECTION_DESIGN_IDS[number];

export type DirectorySectionDesignMeta = {
  label:       string;
  description: string;
};

export const DIRECTORY_SECTION_DESIGNS: Record<DirectorySectionDesignId, DirectorySectionDesignMeta> = {
  "1": {
    label:       "Grid Direktori Organisasi",
    description: "Tampilan direktori dengan opsi judul default/simple, grid 2-4 kolom, dan desain kartu kustom (tanpa border radius cover, aksen diamond, alamat warna secondary, & avatar pemilik).",
  },
};
