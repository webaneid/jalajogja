import type { NextConfig } from "next";

// Slug pattern: huruf kecil + angka + dash, minimal 3 karakter
// Negatif lookahead pakai (?:/|$) bukan $ saja — karena regex diapply ke full path string,
// bukan hanya segment. "platform/dashboard" → $ tidak match di akhir "platform",
// tapi (?:/|$) match ("/" ada setelahnya) → "platform" dikecualikan dengan benar.
const TENANT_SLUG = "(?!(?:api|app|platform|_next|register|dashboard-redirect)(?:/|$))[a-z][a-z0-9-]+";

// Admin modules yang dipindah dari /{slug}/X ke /app/{slug}/X di Fase 1
// Redirect 301 untuk mempertahankan bookmark lama
const ADMIN_MODULES = [
  "dashboard",
  "members",
  "pengurus",
  "divisi",
  "accounts",
  "media",
  "website",
  "letters",
  "finance",
  "donasi",
  "toko",
  "settings",
];

const nextConfig: NextConfig = {
  transpilePackages: ["@jalajogja/ui"],

  async rewrites() {
    // Beberapa browser ter-cache redirect 301 lama yang salah arahkan
    // /api/* ke /app/api/*. beforeFiles rewrite memastikan request ke /app/api/*
    // di-forward ke /api/* SEBELUM Next.js cek route (dashboard)/app/[tenant]/*.
    return {
      beforeFiles: [
        {
          source: "/app/api/:path*",
          destination: "/api/:path*",
        },
      ],
      afterFiles: [],
      fallback:   [],
    };
  },

  async redirects() {
    // 4a: Redirect 301 dari old admin URLs ke /app/ prefix
    // Berlaku selama 30 hari lalu dihapus (setelah semua bookmark admin diperbarui)
    //
    // WAJIB dibatasi host jalakarta.com (`has: [{ type: "host", ... }]`) — redirects()
    // Next.js berjalan SEBELUM middleware.ts (urutan: headers → redirects → middleware →
    // rewrites), jadi tanpa guard host, aturan ini tidak tahu bedanya custom domain vs
    // domain sendiri. Bug nyata yang pernah terjadi: di custom domain (mis. visikita.com),
    // halaman publik `/akun/media` hanya 2 segment path ("akun" + "media") — persis cocok
    // pola `/:slug/media` di sini (menyangka "akun" adalah tenant slug) → redirect permanen
    // ke `/app/akun/media` (bukan tenant valid) → bounce ke login admin. Redirect legacy ini
    // memang hanya relevan untuk bookmark lama di domain sendiri — custom domain tidak
    // pernah punya path admin lama sama sekali.
    const ownHostOnly = [{ type: "host" as const, value: "jalakarta.com" }];

    // Redirect per module — root + semua subpath
    const moduleRedirects = ADMIN_MODULES.flatMap((module) => [
      {
        source: `/:slug(${TENANT_SLUG})/${module}`,
        destination: `/app/:slug/${module}`,
        permanent: true,
        has: ownHostOnly,
      },
      {
        source: `/:slug(${TENANT_SLUG})/${module}/:path*`,
        destination: `/app/:slug/${module}/:path*`,
        permanent: true,
        has: ownHostOnly,
      },
    ]);

    // event — hanya subpath admin (acara, kategori)
    // /:slug/event/[slug] dibiarkan (public compat redirect ke /agenda/[slug])
    const eventRedirects = [
      {
        source: `/:slug(${TENANT_SLUG})/event/acara`,
        destination: `/app/:slug/event/acara`,
        permanent: true,
        has: ownHostOnly,
      },
      {
        source: `/:slug(${TENANT_SLUG})/event/acara/:path*`,
        destination: `/app/:slug/event/acara/:path*`,
        permanent: true,
        has: ownHostOnly,
      },
      {
        source: `/:slug(${TENANT_SLUG})/event/kategori`,
        destination: `/app/:slug/event/kategori`,
        permanent: true,
        has: ownHostOnly,
      },
    ];

    // dokumen — hanya admin subpaths
    // /:slug/dokumen/[id] dibiarkan (halaman publik dokumen)
    const dokumenRedirects = [
      {
        source: `/:slug(${TENANT_SLUG})/dokumen`,
        destination: `/app/:slug/dokumen`,
        permanent: true,
        has: ownHostOnly,
      },
      {
        source: `/:slug(${TENANT_SLUG})/dokumen/semua`,
        destination: `/app/:slug/dokumen/semua`,
        permanent: true,
        has: ownHostOnly,
      },
      {
        source: `/:slug(${TENANT_SLUG})/dokumen/semua/:path*`,
        destination: `/app/:slug/dokumen/semua/:path*`,
        permanent: true,
        has: ownHostOnly,
      },
      {
        source: `/:slug(${TENANT_SLUG})/dokumen/new`,
        destination: `/app/:slug/dokumen/new`,
        permanent: true,
        has: ownHostOnly,
      },
      {
        source: `/:slug(${TENANT_SLUG})/dokumen/kategori`,
        destination: `/app/:slug/dokumen/kategori`,
        permanent: true,
        has: ownHostOnly,
      },
    ];

    return [
      ...moduleRedirects,
      ...eventRedirects,
      ...dokumenRedirects,
    ];
  },

  images: {
    remotePatterns: [
      {
        // MinIO development — localhost:9000
        protocol: "http",
        hostname: "localhost",
        port: "9000",
        pathname: "/**",
      },
      {
        // MinIO local network — 192.168.x.x:9000
        protocol: "http",
        hostname: "192.168.*",
        port: "9000",
        pathname: "/**",
      },
      {
        // MinIO production — sesuaikan hostname dengan VPS kalian
        protocol: "https",
        hostname: "minio.jalakarta.com",
        pathname: "/**",
      },
      {
        // MinIO production via HTTP (jika belum pakai SSL di MinIO)
        protocol: "http",
        hostname: "minio.jalakarta.com",
        port: "9000",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
