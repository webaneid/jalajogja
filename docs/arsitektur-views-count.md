# Arsitektur View Counter — jalakarta

Sistem untuk menghitung berapa kali sebuah konten dilihat pengunjung,
dengan deduplikasi berbasis IP sehingga 1 IP tidak bisa menambah hitungan
berkali-kali dalam window 5 menit.

Berlaku untuk: **post**, **page**, **event**, **product**, **campaign (donasi)**

---

## Aturan Counting

```
Pengunjung buka konten
         │
         ▼
Filter bot (User-Agent)
         │
    ┌────┴────────────────────────────────────────┐
    │ User-Agent = bot/crawler                    │ User-Agent = manusia
    │                                             │
    ▼                                             ▼
  SKIP                                   Hash IP address (SHA-256)
                                                  │
                                                  ▼
                                 Cek tabel content_view_sessions:
                                   (content_type, content_id, ip_hash)?
                                                  │
                                    ┌─────────────┴─────────────────────────┐
                                    │ TIDAK ADA                             │ ADA, viewed_at < 5 menit lalu
                                    │ (kunjungan pertama)                   │ (masih dalam window)
                                    │                                       │
                                    ▼                                       ▼
                               INSERT row baru                         DO NOTHING
                               view_count + 1                          (skip, tidak hitung)
                                    │
                           ─────────┘─────────────────────────────────────────┐
                                                                               │ ADA, viewed_at ≥ 5 menit lalu
                                                                               │ (window sudah lewat, boleh hitung lagi)
                                                                               │
                                                                               ▼
                                                                       UPDATE viewed_at = NOW()
                                                                       view_count + 1
```

**Ringkasan:** 1 IP per konten → dihitung maksimal 1× per 5 menit.
Jika pengunjung menutup tab, kembali 5 menit kemudian → dihitung lagi (satu kunjungan baru).

---

## Schema DB

### 1. Kolom `view_count` di tiap content table

Tambah satu kolom ke 5 tabel konten:

```sql
-- Jalankan via create-tenant-schema.ts untuk tenant baru
-- Jalankan manual ALTER TABLE untuk tenant existing

ALTER TABLE "{s}".posts     ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "{s}".pages     ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "{s}".events    ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "{s}".products  ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "{s}".campaigns ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;
```

`view_count` adalah **counter denormalisasi** — sengaja disimpan di tabel konten
agar query list (arsip post, daftar produk, dll) bisa sort/filter by views tanpa JOIN mahal.

### 2. Tabel `content_view_sessions` — Dedup tracker

```sql
CREATE TABLE IF NOT EXISTS "{s}".content_view_sessions (
  content_type  TEXT          NOT NULL
                              CHECK (content_type IN ('post','page','event','product','campaign')),
  content_id    UUID          NOT NULL,
  ip_hash       TEXT          NOT NULL,  -- SHA-256 hex dari IP address
  viewed_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  PRIMARY KEY (content_type, content_id, ip_hash)
);

-- Index untuk cleanup cron (hapus berdasarkan waktu)
CREATE INDEX IF NOT EXISTS idx_cvs_viewed_at
  ON "{s}".content_view_sessions (viewed_at);
```

**Alasan satu tabel polymorphic (bukan per-content-type):**
- Lebih simple — tidak perlu 5 tabel dedup terpisah
- `content_type` + `content_id` sebagai composite part of PK cukup untuk isolasi
- Cleanup bisa satu query (hapus semua yang expired, apapun tipenya)

**Privacy:** IP address **tidak pernah disimpan mentah**. Hanya SHA-256 hash-nya.
Hash ini tidak bisa dibalik ke IP asli, tapi cukup untuk deduplikasi.

---

## Drizzle Schema Update

Tambah `viewCount` ke 5 tabel konten di Drizzle schema factory:

```typescript
// packages/db/src/schema/tenant/website.ts — tambah di createPostsTable, createPagesTable
viewCount: integer("view_count").notNull().default(0),

// packages/db/src/schema/tenant/events.ts — tambah di createEventsTable
viewCount: integer("view_count").notNull().default(0),

// packages/db/src/schema/tenant/donations.ts — tambah di createCampaignsTable
viewCount: integer("view_count").notNull().default(0),

// packages/db/src/schema/tenant/shop.ts — tambah di createProductsTable
viewCount: integer("view_count").notNull().default(0),
```

**`content_view_sessions` TIDAK perlu Drizzle schema** — tabel ini hanya diakses via
raw SQL di `lib/view-counter.ts`. Drizzle schema dipakai untuk query building dan
TypeScript types; karena `content_view_sessions` tidak pernah di-query via Drizzle ORM,
menambahkan factory function hanya menambah boilerplate tanpa nilai.

---

## lib/view-counter.ts

```typescript
// apps/web/lib/view-counter.ts
import { createHash } from "crypto";
import { sql }        from "drizzle-orm";
import type { TenantDb } from "@jalajogja/db";

export type ContentType = "post" | "page" | "event" | "product" | "campaign";

const CONTENT_TABLE: Record<ContentType, string> = {
  post:     "posts",
  page:     "pages",
  event:    "events",
  product:  "products",
  campaign: "campaigns",
};

const VIEW_WINDOW_MINUTES = 5;

export function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex");
}

/**
 * Catat satu kunjungan. Return true jika view dihitung, false jika dalam window.
 * Fire-and-forget friendly — tidak throw, error ditelan dengan log.
 */
export async function recordView(
  tenantClient: TenantDb,
  opts: {
    slug:   string;        // tenant slug, misal "pc-ikpm-jogjakarta"
    type:   ContentType;
    id:     string;        // UUID konten
    ipHash: string;        // SHA-256 hex dari IP
  },
): Promise<boolean> {
  const { db } = tenantClient;
  const { slug, type, id, ipHash } = opts;

  // Schema dan table name via sql.raw (identifier, bukan nilai)
  const s         = `tenant_${slug}`;
  const sessTable = sql.raw(`"${s}".content_view_sessions`);
  const contTable = sql.raw(`"${s}".${CONTENT_TABLE[type]}`);
  // INTERVAL sebagai sql.raw karena konstanta — tidak perlu parameterisasi
  const interval  = sql.raw(`INTERVAL '${VIEW_WINDOW_MINUTES} minutes'`);

  try {
    // Step 1: Atomic upsert ke dedup table
    //   - INSERT baru → row baru, hitung (count = 1)
    //   - ON CONFLICT, viewed_at sudah stale → UPDATE, hitung (count = 1)
    //   - ON CONFLICT, masih dalam window → WHERE gagal, DO NOTHING (count = 0)
    const result = await db.execute(sql`
      INSERT INTO ${sessTable} (content_type, content_id, ip_hash, viewed_at)
      VALUES (${type}, ${id}::uuid, ${ipHash}, NOW())
      ON CONFLICT (content_type, content_id, ip_hash) DO UPDATE
        SET viewed_at = NOW()
        WHERE ${sessTable}.viewed_at < NOW() - ${interval}
    `);

    // PENTING: postgres.js driver pakai .count (bukan .rowCount seperti node-postgres)
    // Drizzle dengan driver postgres.js: hasil DML ada di result.count, bukan result.rowCount
    const counted = ((result as unknown as { count: number }).count ?? 0) > 0;

    // Step 2: Increment hanya jika upsert berhasil
    if (counted) {
      await db.execute(sql`
        UPDATE ${contTable}
        SET view_count = view_count + 1
        WHERE id = ${id}::uuid
      `);
    }

    return counted;
  } catch (err) {
    console.error("[view-counter] error:", err);
    return false;
  }
}
```

**Catatan parameterisasi:**
- `sql.raw()` hanya untuk identifier (schema name, table name) dan konstanta numerik (INTERVAL) — tidak pernah untuk nilai dari user
- `${type}`, `${id}::uuid`, `${ipHash}` — parameterized via Drizzle `sql` tag template → aman dari SQL injection
- INTERVAL pakai `sql.raw()` karena `VIEW_WINDOW_MINUTES` adalah konstanta compile-time, bukan input user

**Catatan ON CONFLICT DO UPDATE WHERE:**
Jika kondisi WHERE gagal (masih dalam window), PostgreSQL tidak update → `count = 0`.
Jika berhasil (insert baru atau update stale) → `count = 1`.
Ini adalah cara standard PostgreSQL untuk conditional upsert tanpa locking.

**KRITIS — postgres.js vs node-postgres:**
Driver yang dipakai Drizzle di project ini adalah **postgres.js** (package `postgres`), BUKAN `node-postgres` (package `pg`).
Keduanya punya API mirip tapi beda di nama property hasil DML:
| Property | postgres.js | node-postgres (`pg`) |
|----------|-------------|----------------------|
| Jumlah baris terpengaruh | `result.count` | `result.rowCount` |
Jika pakai `.rowCount` di project ini → selalu `undefined` → conditional upsert tidak pernah terhitung.
**Gunakan selalu `.count` untuk cek affected rows dengan Drizzle + postgres.js.**

---

## Integrasi di Page Server Component

Gunakan `after()` dari `next/server` — berjalan **setelah response dikirim ke browser**,
sehingga tidak memperlambat Time to First Byte (TTFB) halaman.

> **Requirement**: `after()` tersedia mulai **Next.js 15.1** (GA release). Pastikan versi Next.js
> di `package.json` adalah `^15.1.0` atau lebih baru sebelum menggunakan fitur ini.

```typescript
// apps/web/app/(public)/[tenant]/post/[slug]/page.tsx

import { after }                  from "next/server";
import { headers }                from "next/headers";
import { recordView, hashIp }     from "@/lib/view-counter";

export default async function PostDetailPage({ params }) {
  const { tenant: slug, slug: postSlug } = await params;

  // ... fetch post, check tenant, dll ...

  const hdrs   = await headers();

  // Bot filtering — wajib, jalankan sebelum recordView
  const ua    = hdrs.get("user-agent") ?? "";
  const isBot = /bot|crawl|spider|slurp|facebookexternalhit|twitterbot|googlebot|bingbot/i.test(ua);

  if (!isBot) {
    // Ambil IP dari header (Nginx/Caddy wajib set x-forwarded-for)
    const rawIp  = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim()
                ?? hdrs.get("x-real-ip")
                ?? "unknown";
    const ipHash = hashIp(rawIp);

    // Fire-and-forget — jalan setelah response, tidak blokir render
    after(() => recordView(tenantClient, {
      slug,
      type:   "post",
      id:     post.id,
      ipHash,
    }));
  }

  return ( /* ... JSX ... */ );
}
```

### Kenapa `after()` bukan `void recordView()`?

| | `void recordView()` | `after()` |
|--|---------------------|-----------|
| Blokir render? | Tidak (fire-and-forget) | Tidak |
| Berjalan saat? | Paralel dengan render | Setelah response terkirim |
| Risk terhadap request? | Bisa timeout bersama request | Isolated — tidak berdampak |
| Tersedia di | Next.js 15+ | Next.js **15.1**+ |

**Fallback jika versi Next.js < 15.1**: gunakan `void recordView(...)` biasa —
tetap fire-and-forget, hanya saja berjalan paralel dengan response (bukan setelah).

---

## Menampilkan view_count di UI

### Kebijakan tampil di publik

`view_count` **ditampilkan di halaman publik** — ini norma umum konten berita/organisasi
dan memberi sinyal sosial bahwa konten dibaca orang. Namun tampilkan hanya jika sudah
cukup tinggi untuk menghindari kesan "sepi":

```tsx
{post.viewCount >= 50 && (
  <span className="text-xs text-muted-foreground flex items-center gap-1">
    <Eye className="h-3.5 w-3.5" />
    {post.viewCount.toLocaleString("id-ID")} kali dilihat
  </span>
)}
```

Threshold `50` bisa diubah per-kebutuhan tanpa perubahan schema.

### Di dashboard admin (list + detail)

Di tabel list post/event/produk — tambah kolom "Dilihat" tanpa threshold:

```tsx
<TableCell className="text-right text-sm text-muted-foreground">
  {post.viewCount.toLocaleString("id-ID")}
</TableCell>
```

Bisa juga jadi sort criteria — `ORDER BY view_count DESC` untuk "konten terpopuler".

---

## Halaman yang Perlu Diintegrasikan

| Route | Content Type | File |
|-------|-------------|------|
| `/(public)/[tenant]/post/[slug]` | `post` | `app/(public)/[tenant]/post/[slug]/page.tsx` |
| `/(public)/[tenant]/[pageSlug]` | `page` | `app/(public)/[tenant]/[pageSlug]/page.tsx` |
| `/(public)/[tenant]/event/[slug]` | `event` | `app/(public)/[tenant]/event/[slug]/page.tsx` |
| `/(public)/[tenant]/toko/[slug]` | `product` | (belum ada — saat dibangun nanti) |
| `/(public)/[tenant]/donasi/[slug]` | `campaign` | (belum ada — saat dibangun nanti) |

---

## Cleanup Cron Job

Tabel `content_view_sessions` hanya butuh data 5–10 menit terakhir untuk deduplikasi.
Hapus semua row yang lebih tua dari 10 menit (2× window, safety margin).

**Interval cleanup: 1 jam** — tabel sangat kecil (estimasi < 5.000 rows per tenant aktif),
running cleanup setiap 10 menit adalah overkill yang tidak perlu.

```typescript
// apps/web/app/api/cron/cleanup-views/route.ts
// Dipanggil setiap 1 jam via cron — auth via CRON_SECRET

import { db, tenants }    from "@jalajogja/db";
import { eq }             from "drizzle-orm";
import { createTenantDb } from "@jalajogja/db";
import { sql }            from "drizzle-orm";

export async function GET(request: Request) {
  if (request.headers.get("x-cron-secret") !== process.env.CRON_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allTenants = await db.select({ slug: tenants.slug })
    .from(tenants)
    .where(eq(tenants.isActive, true));

  let deleted = 0;

  for (const { slug } of allTenants) {
    const tenantClient = createTenantDb(slug);
    // sql.raw untuk schema identifier — nilai interval tidak perlu parameterisasi di sini
    // karena tidak ada input user, tapi tetap gunakan sql template untuk konsistensi
    const sessTable = sql.raw(`"tenant_${slug}".content_view_sessions`);
    const result = await tenantClient.db.execute(sql`
      DELETE FROM ${sessTable}
      WHERE viewed_at < NOW() - INTERVAL '10 minutes'
    `);
    deleted += result.rowCount ?? 0;
  }

  return Response.json({ deleted, tenants: allTenants.length });
}
```

**Cron di VPS** (`crontab`): `0 * * * * curl -H "x-cron-secret: ..." URL` (setiap jam pas).

**Estimasi ukuran tabel**: asumsi 100 pengunjung unik × 10 konten = 1.000 rows max per tenant
sebelum cleanup. Sangat kecil — cleanup 1 jam sudah lebih dari cukup.

---

## Performa & Indeks

```sql
-- PK sudah ada: (content_type, content_id, ip_hash) — cover upsert query
-- Index tambahan untuk cleanup:
CREATE INDEX idx_cvs_viewed_at ON "{s}".content_view_sessions (viewed_at);
```

**Read performance**: `view_count` sudah denormalisasi di tabel konten → `SELECT view_count FROM posts WHERE id = $1` adalah index lookup, O(1).

**Write performance**: satu upsert + satu UPDATE per kunjungan yang dihitung.
Untuk konten populer (ratusan pengunjung/menit) ini aman karena PostgreSQL handles row-level locking per-row di UPDATE.

---

## Urutan Eksekusi

```
Step 1 — DDL: tambah kolom view_count ke 5 tabel di create-tenant-schema.ts           ✅
Step 2 — DDL: buat tabel content_view_sessions + index di create-tenant-schema.ts     ✅
Step 3 — Drizzle schema: update createPostsTable, createPagesTable, createEventsTable, ✅
         createProductsTable, createCampaignsTable — tambah viewCount field
         (TIDAK perlu Drizzle factory untuk content_view_sessions)
Step 4 — ALTER TABLE manual untuk tenant existing (pc-ikpm-jogjakarta)                ✅
         5 ADD COLUMN view_count + 1 CREATE TABLE content_view_sessions
Step 5 — Buat lib/view-counter.ts (hashIp + recordView)                               ✅
Step 6 — Integrasi di post/[slug]/page.tsx — bot filter + after() + hashIp            ✅
Step 7 — Tampilkan view_count di list admin /website/posts (kolom Dilihat)             ✅
Step 8 — Integrasi di event/[slug]/page.tsx                                           ⬜
Step 9 — Integrasi di [pageSlug]/page.tsx                                             ⬜
Step 10 — Tampilkan view_count di detail page publik (threshold >= 50)                ⬜
Step 11 — api/cron/cleanup-views/route.ts (cleanup 1 jam)                             ⬜
Step 12 — TypeScript check (tsc --noEmit)                                             ✅
```

Step 1–4 wajib selesai sebelum Step 5.
Step 8–9 bisa paralel, pola sama persis dengan Step 6.
Step 11 bisa dikerjakan kapan saja — tidak blocking.

---

## Struktur File

```
apps/web/
├── lib/
│   └── view-counter.ts                      → BARU: hashIp() + recordView()
├── app/api/cron/
│   └── cleanup-views/route.ts               → BARU: hapus sessions > 10 menit, cron 1 jam
└── app/(public)/[tenant]/
    ├── post/[slug]/page.tsx                 → UPDATE: bot filter + after() + recordView
    ├── event/[slug]/page.tsx                → UPDATE: bot filter + after() + recordView
    └── [pageSlug]/page.tsx                  → UPDATE: bot filter + after() + recordView

packages/db/src/schema/tenant/
├── website.ts                               → UPDATE: viewCount di posts + pages
├── events.ts                                → UPDATE: viewCount di events
├── donations.ts                             → UPDATE: viewCount di campaigns
└── shop.ts                                  → UPDATE: viewCount di products

packages/db/src/helpers/create-tenant-schema.ts
  → UPDATE: ADD COLUMN view_count + CREATE TABLE content_view_sessions
```

---

## Open Questions (Terjawab)

1. **Tampil di publik atau hanya admin?**
   **Keputusan: tampil di publik jika `view_count >= 50`**, sembunyikan jika masih kecil.
   Konten organisasi (berita, event) memang wajar menampilkan hitungan viewer — memberi sinyal
   sosial. Threshold 50 mencegah tampilan angka kecil yang terlihat tidak populer.

2. **Sort "Terpopuler" di arsip publik?**
   Bisa ditambahkan sebagai filter di `/{tenant}/post?sort=popular` — hanya perlu
   `ORDER BY view_count DESC` tanpa perubahan schema.

3. **Statistik per hari / time series?**
   Di luar scope arsitektur saat ini. Jika perlu grafik harian, butuh tabel tambahan
   `content_view_stats(date, content_type, content_id, count)` — catat sebagai enhancement future.

4. **IP di balik load balancer / proxy?**
   Header `x-forwarded-for` bisa berisi chain IP (`client, proxy1, proxy2`). Ambil selalu
   IP pertama (paling kiri) = IP client asli. Pastikan Nginx/Caddy di-konfigurasi untuk
   set header ini dengan benar.

---

## Status Implementasi

| Komponen | Status |
|----------|--------|
| DDL: kolom `view_count` di 5 tabel | ✅ Selesai |
| DDL: tabel `content_view_sessions` | ✅ Selesai |
| Drizzle schema update (5 tabel konten) | ✅ Selesai |
| `lib/view-counter.ts` | ✅ Selesai |
| Integrasi `post/[slug]/page.tsx` | ✅ Selesai — bot filter + after() + recordView |
| Tampilkan view_count di list admin (`/website/posts`) | ✅ Selesai — kolom "Dilihat" dengan ikon BarChart2 |
| Integrasi `event/[slug]/page.tsx` | ⬜ Belum |
| Integrasi `[pageSlug]/page.tsx` | ⬜ Belum |
| Tampilkan view_count di detail publik (threshold ≥ 50) | ⬜ Belum |
| `api/cron/cleanup-views/route.ts` | ⬜ Belum |
