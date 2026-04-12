import type { Metadata } from "next";
import {
  TITLE_MAX_LENGTH,
  DESC_MAX_LENGTH,
  TITLE_SEPARATOR,
  DEFAULT_TWITTER_CARD,
  DEFAULT_ROBOTS,
  DEFAULT_LOCALE,
  DEFAULT_OG_TYPE,
  OG_IMAGE_WIDTH,
  OG_IMAGE_HEIGHT,
} from "./seo-defaults";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GenerateMetadataParams {
  /** Judul halaman (tanpa nama site) */
  title: string;
  /** Deskripsi halaman */
  description?: string | null;
  /** Nama organisasi / site */
  siteName: string;
  /** URL kanonik penuh, misal "https://ikpm.jalajogja.com/posts/123" */
  canonicalUrl?: string | null;
  /** URL gambar OG */
  ogImageUrl?: string | null;
  /** Override judul OG (default = title) */
  ogTitle?: string | null;
  /** Override deskripsi OG (default = description) */
  ogDescription?: string | null;
  /** Twitter card type */
  twitterCard?: "summary" | "summary_large_image";
  /**
   * Nilai robots.txt: "index,follow" | "noindex" | "noindex,nofollow"
   * Akan di-parse ke format Next.js Metadata robots object
   */
  robots?: string | null;
  /** Locale BCP 47, default "id_ID" */
  locale?: string;
  /** og:type, default "website" */
  ogType?: string;
}

export interface ArticleJsonLdParams {
  headline: string;
  description?: string | null;
  imageUrl?: string | null;
  authorName?: string | null;
  publishedAt?: Date | string | null;
  updatedAt?: Date | string | null;
  siteUrl: string;
  articleUrl: string;
  publisherName: string;
  publisherLogoUrl?: string | null;
  /** "Article" | "NewsArticle" | "BlogPosting" */
  schemaType?: string;
}

export interface ProductJsonLdParams {
  name: string;
  description?: string | null;
  imageUrls?: string[];
  sku?: string | null;
  price: number | string;
  currency?: string;
  availability?: "InStock" | "OutOfStock" | "PreOrder";
  brandName?: string;
  productUrl: string;
  /** "Product" | "SoftwareApplication" */
  schemaType?: string;
}

export interface OrganizationJsonLdParams {
  name: string;
  description?: string | null;
  url: string;
  logoUrl?: string | null;
  /** Array URL sosial media */
  sameAs?: string[];
  email?: string | null;
  telephone?: string | null;
  address?: {
    streetAddress?: string;
    addressLocality?: string;
    addressRegion?: string;
    postalCode?: string;
    addressCountry?: string;
  };
}

export interface BreadcrumbItem {
  name: string;
  url: string;
}

// ── Helpers teks ──────────────────────────────────────────────────────────────

/**
 * Potong teks pada batas kata, tambah "…" jika melebihi maxLength.
 */
export function truncateForSeo(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength).trimEnd();
  // Balik ke batas kata terakhir
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut) + "…";
}

export const truncateTitle = (t: string) => truncateForSeo(t, TITLE_MAX_LENGTH);
export const truncateDesc  = (t: string) => truncateForSeo(t, DESC_MAX_LENGTH);

/**
 * Generate URL-friendly slug dari judul.
 * Normalisasi diakritik (ä→a, é→e, dll), hapus karakter non-alfanumerik.
 */
export function generateSlug(title: string): string {
  return title
    .normalize("NFD")                        // pisah diakritik
    .replace(/[\u0300-\u036f]/g, "")         // hapus diakritik
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")           // hanya huruf, angka, spasi, strip
    .trim()
    .replace(/\s+/g, "-")                    // spasi → strip
    .replace(/-+/g, "-");                    // strip ganda → satu
}

/**
 * Bangun title gabungan: "Judul Halaman | Nama Site"
 * Jika gabungan > 60 karakter, potong pageTitle (bukan siteName).
 */
export function buildTitle(
  pageTitle: string,
  siteName: string,
  separator = TITLE_SEPARATOR,
): string {
  const full = `${pageTitle}${separator}${siteName}`;
  if (full.length <= TITLE_MAX_LENGTH) return full;

  const overhead = separator.length + siteName.length;
  const allowedPage = TITLE_MAX_LENGTH - overhead;
  const shortPage = allowedPage > 10
    ? truncateForSeo(pageTitle, allowedPage)
    : pageTitle;

  return `${shortPage}${separator}${siteName}`;
}

// ── Metadata ──────────────────────────────────────────────────────────────────

/**
 * Generate objek `Metadata` Next.js dari parameter SEO.
 */
export function generateMetadata(params: GenerateMetadataParams): Metadata {
  const {
    title,
    description,
    siteName,
    canonicalUrl,
    ogImageUrl,
    ogTitle,
    ogDescription,
    twitterCard = DEFAULT_TWITTER_CARD,
    robots: robotsStr = DEFAULT_ROBOTS,
    locale = DEFAULT_LOCALE,
    ogType = DEFAULT_OG_TYPE,
  } = params;

  const fullTitle  = buildTitle(title, siteName);
  const metaDesc   = description ? truncateDesc(description) : undefined;
  const resolvedOgTitle = ogTitle || title;
  const resolvedOgDesc  = ogDescription || metaDesc;

  // Parse "index,follow" → Next.js robots object
  const noIndex   = robotsStr?.includes("noindex")   ?? false;
  const noFollow  = robotsStr?.includes("nofollow")  ?? false;

  const metadata: Metadata = {
    title: fullTitle,
    ...(metaDesc && { description: metaDesc }),
    openGraph: {
      title: resolvedOgTitle,
      ...(resolvedOgDesc && { description: resolvedOgDesc }),
      siteName,
      locale,
      ...(canonicalUrl && { url: canonicalUrl }),
      ...(ogImageUrl && {
        images: [{ url: ogImageUrl, width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT }],
      }),
    },
    twitter: {
      card: twitterCard,
      title: resolvedOgTitle,
      ...(resolvedOgDesc && { description: resolvedOgDesc }),
      ...(ogImageUrl && { images: [ogImageUrl] }),
    },
    robots: {
      index:  !noIndex,
      follow: !noFollow,
      googleBot: { index: !noIndex, follow: !noFollow },
    },
    ...(canonicalUrl && {
      alternates: { canonical: canonicalUrl },
    }),
  };

  return metadata;
}

// ── JSON-LD generators ────────────────────────────────────────────────────────

/** JSON-LD untuk artikel / post */
export function generateArticleJsonLd(params: ArticleJsonLdParams): string {
  const {
    headline,
    description,
    imageUrl,
    authorName,
    publishedAt,
    updatedAt,
    siteUrl,
    articleUrl,
    publisherName,
    publisherLogoUrl,
    schemaType = "Article",
  } = params;

  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": schemaType,
    headline: truncateTitle(headline),
    url: articleUrl,
    mainEntityOfPage: { "@type": "WebPage", "@id": articleUrl },
    publisher: {
      "@type": "Organization",
      name: publisherName,
      url: siteUrl,
      ...(publisherLogoUrl && {
        logo: { "@type": "ImageObject", url: publisherLogoUrl },
      }),
    },
  };

  if (description) ld.description = truncateDesc(description);
  if (imageUrl)    ld.image = imageUrl;
  if (authorName)  ld.author = { "@type": "Person", name: authorName };
  if (publishedAt) ld.datePublished = new Date(publishedAt).toISOString();
  if (updatedAt)   ld.dateModified  = new Date(updatedAt).toISOString();

  return JSON.stringify(ld);
}

/** JSON-LD untuk produk toko */
export function generateProductJsonLd(params: ProductJsonLdParams): string {
  const {
    name,
    description,
    imageUrls,
    sku,
    price,
    currency = "IDR",
    availability = "InStock",
    brandName,
    productUrl,
    schemaType = "Product",
  } = params;

  const availabilityUrl: Record<string, string> = {
    InStock:  "https://schema.org/InStock",
    OutOfStock: "https://schema.org/OutOfStock",
    PreOrder: "https://schema.org/PreOrder",
  };

  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": schemaType,
    name,
    url: productUrl,
    offers: {
      "@type": "Offer",
      price: String(price),
      priceCurrency: currency,
      availability: availabilityUrl[availability] ?? availabilityUrl.InStock,
      url: productUrl,
    },
  };

  if (description)       ld.description = truncateDesc(description);
  if (imageUrls?.length) ld.image = imageUrls.length === 1 ? imageUrls[0] : imageUrls;
  if (sku)               ld.sku = sku;
  if (brandName)         ld.brand = { "@type": "Brand", name: brandName };

  return JSON.stringify(ld);
}

/** JSON-LD untuk profil organisasi */
export function generateOrganizationJsonLd(params: OrganizationJsonLdParams): string {
  const { name, description, url, logoUrl, sameAs, email, telephone, address } = params;

  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name,
    url,
  };

  if (description)    ld.description = truncateDesc(description);
  if (logoUrl)        ld.logo = { "@type": "ImageObject", url: logoUrl };
  if (sameAs?.length) ld.sameAs = sameAs;
  if (email)          ld.email = email;
  if (telephone)      ld.telephone = telephone;

  if (address) {
    ld.address = {
      "@type": "PostalAddress",
      ...(address.streetAddress  && { streetAddress:  address.streetAddress }),
      ...(address.addressLocality && { addressLocality: address.addressLocality }),
      ...(address.addressRegion  && { addressRegion:  address.addressRegion }),
      ...(address.postalCode     && { postalCode:     address.postalCode }),
      ...(address.addressCountry && { addressCountry: address.addressCountry }),
    };
  }

  return JSON.stringify(ld);
}

/** JSON-LD untuk breadcrumb navigasi */
export function generateBreadcrumbJsonLd(items: BreadcrumbItem[]): string {
  const ld = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return JSON.stringify(ld);
}
