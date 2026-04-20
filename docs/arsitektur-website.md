# Arsitektur Website — jalajogja

Dokumen ini mencakup dua hal berbeda yang saling berkaitan:
1. **Dashboard CMS** — modul admin untuk kelola konten (posts, pages, kategori, tag)
2. **Front-end Publik** — website yang dibuka oleh pengunjung umum

---

## Bagian 1: Dashboard CMS (Sudah Selesai)

Modul website di dashboard tenant — tempat admin buat dan kelola konten.

### Struktur Route Dashboard
```
app/(dashboard)/[tenant]/website/
├── layout.tsx              → website shell: WebsiteNav (sub-nav kiri) + slot konten kanan
├── page.tsx                → /website — dashboard: stats + 5 post terbaru
├── actions.ts              → SEMUA server actions website (posts + pages)
├── posts/
│   ├── page.tsx            → list posts: filter status + search + pagination
│   ├── new/page.tsx        → pre-create draft → redirect ke edit
│   └── [id]/edit/page.tsx  → full editor: fetch post + tags + categories → render PostForm
└── pages/
    ├── page.tsx            → list pages: sorted by `order` asc
    ├── new/page.tsx        → pre-create draft → redirect ke edit
    └── [id]/edit/page.tsx  → full editor: fetch page → render PageForm
```

### Server Actions (website/actions.ts)
```
Posts:
  createPostDraftAction(slug, title?)      → pre-create + return postId
  updatePostAction(slug, postId, data)     → full update + tag sync diff
  updatePostStatusAction(slug, postId, s)  → quick status change
  deletePostAction(slug, postId)           → delete pivot dulu, baru post

Pages:
  createPageDraftAction(slug, title?)      → pre-create + return pageId
  updatePageAction(slug, pageId, data)     → full update
  updatePageStatusAction(slug, pageId, s)  → quick status change
  deletePageAction(slug, pageId)           → delete
```

### Pre-create Pattern
User klik "Post Baru" → action buat draft kosong di DB → redirect ke `/posts/{id}/edit`.
Tidak ada modal input judul dulu — judul bisa diisi langsung di form editor.

### Tags Sync: Replace-All Diff
Bukan delete-all + insert-all. Hitung diff:
- `toRemove` = tag lama yang tidak ada di list baru → `DELETE WHERE tagId IN (...)`
- `toAdd` = tag baru yang belum ada di pivot → `INSERT batch`

### PostForm / PageForm Layout
```
[Header: ← Posts | StatusBadge]  ← sticky top
[Main area]          [Sidebar 288px]
  Judul (h1-style)     Status (select full width)
  Slug (font-mono)     ────────────
  Excerpt (post only)  Featured Image (aspect-video)
  TiptapEditor         ────────────
  SeoPanel             Kategori (post only)
                       Tags pills (post only)
                       Urutan / Order (pages only)
                       ────────────
                       [Simpan ...]   ← sticky bottom
                       [Publikasikan]
```

### Logika Label Tombol
| Status aktif | Button 1 (outline) | Button 2 |
|---|---|---|
| `draft` | "Simpan Draft" | "Publikasikan" (primary, Globe) |
| `published` | "Simpan Perubahan" | "Jadikan Draft" (outline, EyeOff) |
| `archived` | "Arsipkan" (Archive icon) | "Publikasikan" (primary, Globe) |

### Perbedaan Posts vs Pages
| | Posts | Pages |
|---|---|---|
| Excerpt | ✓ | ✗ |
| Kategori | ✓ | ✗ |
| Tags | ✓ | ✗ |
| Urutan (order) | ✗ | ✓ |
| Sort list | updatedAt desc | order asc, title asc |
| schemaType | Article/NewsArticle/BlogPosting | WebPage/AboutPage/ContactPage/FAQPage |
| twitterCard default | summary_large_image | summary |

### Komponen Client
```
components/website/
├── post-list-client.tsx   → CreateButton, SearchInput, PostsTable (named exports)
├── page-list-client.tsx   → CreatePageButton, PagesTable
├── post-form.tsx          → full editor form untuk posts
├── page-form.tsx          → full editor form untuk pages
└── website-nav.tsx        → sub-nav kiri
```

**Aturan export client components**: selalu individual named exports — namespace object
`export const X = { A, B }` tidak kompatibel dengan Next.js App Router client boundary.

### Lessons Learned — Block Editor (Tiptap v3)
- Tiptap v3 breaking changes: BubbleMenu di `@tiptap/react/menus`, `immediatelyRender: false` wajib untuk SSR, named import `{ TextStyle }` dan `{ Table }`
- `atom: true` di custom Node → leaf node → renderHTML TIDAK boleh ada `0` (content hole)
- oEmbed universal via `noembed.com/embed?url=` — 300+ platform, tanpa package tambahan
- EmbedBlockView: `dangerouslySetInnerHTML` tidak re-execute `<script>` → pakai `useEffect` re-inject scripts

---

## Bagian 2: Domain Routing (3 Fase)

### Konsep
Tiga fase hidup bersamaan — tidak saling menggantikan. Tenant bisa punya ketiganya aktif sekaligus.

| Fase | URL | Status | Catatan |
|------|-----|--------|---------|
| 1 — Path | `app.jalajogja.com/{slug}` | **Aktif sekarang** | Default, selalu ada |
| 2 — Subdomain | `{subdomain}.jalajogja.com` | Implementasi saat Front-end | Wildcard DNS `*.jalajogja.com` |
| 3 — Custom Domain | `ikpm.or.id` | Implementasi saat Front-end | A record → VPS IP, SSL via Caddy |

### Cara Kerja Custom Domain (White-label)
```
Tenant pointing DNS:
  ikpm.or.id  →  A record  →  123.45.67.89 (IP VPS)

Request flow:
  Browser buka ikpm.or.id
  → Caddy terima request, auto-provision SSL (Let's Encrypt)
  → Forward ke Next.js app
  → Middleware baca Host header: "ikpm.or.id"
  → DB lookup: SELECT slug FROM tenants WHERE custom_domain = 'ikpm.or.id'
  → Render tenant "ikpm" — jalajogja.com tidak terlihat sama sekali
```

**Tidak perlu NS server sendiri** — cukup minta tenant ganti A record di Cloudflare/Niagahoster/dll.

### Logika Middleware
```typescript
const host = request.headers.get("host")

if (host === "app.jalajogja.com") {
  slug = pathname.split("/")[1]              // Fase 1: dari path
} else if (host.endsWith(".jalajogja.com")) {
  slug = host.replace(".jalajogja.com", "")  // Fase 2: dari subdomain
} else {
  slug = await db.query(                     // Fase 3: lookup DB
    "SELECT slug FROM tenants WHERE custom_domain = $1", [host])
}
```

### Schema DB di `public.tenants`
```
slug                       → Fase 1, path-based, selalu ada
subdomain                  → Fase 2, null = fallback ke slug
custom_domain              → Fase 3, null = belum set
custom_domain_status       → none | pending | active | failed
custom_domain_verified_at  → timestamp saat verifikasi berhasil
```

### Alur Setup Custom Domain
```
1. Tenant buka /{slug}/settings/domain
2. Isi form: "ikpm.or.id"
3. jalajogja simpan → custom_domain_status = 'pending'
4. Tampilkan instruksi: "Tambahkan A record: ikpm.or.id → A → {IP_VPS}"
5. Background job verifikasi DNS
6. Jika OK → custom_domain_status = 'active', custom_domain_verified_at = now()
7. Caddy auto-provision SSL saat first request masuk
```

---

## Bagian 3: Front-end Publik (BELUM DIIMPLEMENTASIKAN)

### Filosofi Desain

Website publik jalajogja adalah **website organisasi yang dikontrol penuh oleh tenant** — bukan
microsite generik. Setiap tenant punya website dengan identitas sendiri: nama, logo, warna, konten.

Tiga prinsip:
1. **Data sudah ada** — posts, pages, event, donasi, toko sudah tersimpan di DB. Front-end tinggal render.
2. **SEO-first** — semua halaman server-rendered, metadata lengkap dari `seo_*` columns.
3. **Layered** — mulai minimal (Layer 1), tambah fitur bertahap (Layer 2–4) tanpa redesign.

### Layer Pembangunan

```
Layer 1 — Minimal Viable (PRIORITAS SEKARANG)
  / → Halaman depan: nama org, tagline, logo, posts terbaru
  /blog → List postingan yang published
  /blog/[slug] → Detail postingan + metadata SEO

Layer 2 — Konten Statis
  /[page-slug] → Halaman statis dari Pages module (tentang, kontak, dll)

Layer 3 — Fitur Organisasi (sebagian sudah ada)
  /donasi/[slug] → Campaign donasi (✅ sudah ada di (public))
  /event/[slug] → Halaman event (✅ sudah ada di (public))
  /dokumen/[id] → Dokumen publik (✅ sudah ada di (public))
  /sign/[token] → TTD surat (✅ sudah ada di (public))
  /verify/[hash] → Verifikasi surat (✅ sudah ada di (public))

Layer 4 — Advanced
  /toko → Toko online publik
  /anggota → Direktori anggota (optional, bisa di-hide)
  Navigation builder (drag-drop)
  Custom blocks / page builder
```

### Struktur Route Front-end

Route group `(public)` sudah ada dan dipakai oleh donasi/event/dokumen/surat.
Website publik Layer 1–2 masuk ke sini juga:

```
app/(public)/[tenant]/
├── layout.tsx              → PublicLayout: load settings (logo, warna, nav) dari DB
├── page.tsx                → / → Halaman depan
├── blog/
│   ├── page.tsx            → /blog → list posts (published)
│   └── [slug]/
│       └── page.tsx        → /blog/[slug] → detail post
├── [slug]/
│   └── page.tsx            → /[page-slug] → halaman statis (Pages module)
├── donasi/[slug]/page.tsx  → ✅ sudah ada
├── event/[slug]/page.tsx   → ✅ sudah ada
├── dokumen/[id]/page.tsx   → ✅ sudah ada
├── sign/[token]/page.tsx   → ✅ sudah ada
└── verify/[hash]/page.tsx  → ✅ sudah ada
```

**Catatan penting**: Route `[slug]` untuk Pages harus ditempatkan SETELAH semua route spesifik
(`blog`, `donasi`, `event`, dll) agar tidak menimpa route yang lebih spesifik.
Next.js menyelesaikan ini via urutan folder — folder spesifik selalu menang atas `[slug]`.

### PublicLayout — Data yang Diload

Layout publik perlu load dari DB setiap render (atau di-cache dengan revalidate):

```typescript
// Data dari tenant settings
const settings = await getSettings(tenantClient, "general")  // site_name, tagline, logo_url
const contact  = await getSettings(tenantClient, "contact")  // socials, phone, email
const display  = await getSettings(tenantClient, "display")  // primary_color, font, footer_text

// Data dari tenant table
const tenant   = await db.select().from(tenants).where(eq(tenants.slug, slug)).limit(1)

// Navigation: ambil Pages yang published, sorted by order
const navPages = await tenantDb.select().from(schema.pages)
  .where(eq(schema.pages.status, "published"))
  .orderBy(schema.pages.order)
```

Layout render:
- `<head>`: favicon, meta charset, viewport
- Header: logo + nav (nama halaman dari Pages)
- Footer: socials + contact + footer_text dari settings
- Inject primary_color sebagai CSS variable `--color-primary`

### Halaman Depan (`/`)

Konten halaman depan bisa dari dua sumber:
1. **Page dengan slug `home`** — jika ada di Pages module dan published → render kontennya
2. **Default fallback** — jika tidak ada → render template default (nama org + tagline + posts terbaru)

```
Halaman Depan (default fallback):
  [Hero: nama org + tagline + CTA]
  [Posts Terbaru: grid 3 kolom, 6 post]
  [Event Mendatang: jika ada event upcoming]
  [Footer]
```

### SEO per Halaman

Setiap halaman publik harus menggunakan `generateMetadata()` dari `lib/seo.ts`:

```typescript
export async function generateMetadata({ params }): Promise<Metadata> {
  const post = await fetchPost(slug, postSlug)
  return generateMetadata({
    title:       post.metaTitle || post.title,
    description: post.metaDesc || post.excerpt,
    ogImage:     post.ogImageUrl,
    // ...
  })
}
```

Metadata sudah tersimpan di DB (kolom `meta_title`, `meta_desc`, `og_title`, dll).
Tinggal map ke `generateMetadata()` yang sudah ada.

### Caching Strategy

Front-end publik harus **cepat** — beda dengan dashboard yang selalu fresh.

| Halaman | Strategy | Revalidate |
|---------|----------|-----------|
| Halaman depan | ISR | 60 detik |
| List blog | ISR | 60 detik |
| Detail post | ISR | 300 detik (5 menit) |
| Halaman statis | ISR | 3600 detik (1 jam) |
| Donasi/Event | ISR | 30 detik (data kritis) |

Gunakan `export const revalidate = 60` di page level, atau `fetch(..., { next: { revalidate: 60 } })`.

Dashboard admin bisa trigger manual revalidation via `revalidatePath` saat publish konten.

### Middleware Update (Fase 2 & 3)

Middleware saat ini hanya menangani dashboard routes. Saat front-end diimplementasikan,
middleware perlu diupdate untuk membedakan request dashboard vs publik:

```typescript
// Pseudocode
const isDashboard = pathname.startsWith("/") && !isPublicRoute(pathname)
const slug = resolveSlug(host, pathname) // path / subdomain / custom domain

if (isDashboard) {
  // Cek session, redirect ke login jika perlu
} else {
  // Public route — tidak perlu auth
  // Tapi tetap perlu resolve slug untuk render tenant yang benar
}
```

### Halaman Blog — Detail

```
/blog/[slug]

Data yang diambil:
  - post (title, excerpt, body Tiptap JSON, meta_*, og_*, cover_id)
  - cover image URL dari media table
  - author info (jika ada relasi ke members)
  - kategori + tags
  - posts terkait (same kategori, exclude current, limit 3)

Render:
  <article>
    <header>
      <h1>{title}</h1>
      <time>{publishedAt}</time>
      <div class="tags">{tags}</div>
    </header>
    {coverImage && <img>}
    <div class="prose">{renderBody(body)}</div>  ← pakai renderBody() dari letter-render.ts atau Tiptap
  </article>
  <aside>Posts Terkait</aside>
```

**Render body**: gunakan `renderBody()` yang sudah ada di `lib/letter-render.ts` —
tapi perhatikan: versi saat ini untuk surat. Mungkin perlu variant khusus untuk posts
yang lebih kaya (heading levels, images, embeds, table, dll).

### Komponen UI Front-end

Komponen front-end beda dengan dashboard — tidak pakai shadcn/ui yang heavy.
Gunakan Tailwind langsung, seminimal mungkin:

```
components/public/
├── public-header.tsx    → logo + nav responsif (hamburger mobile)
├── public-footer.tsx    → socials + kontak + copyright
├── post-card.tsx        → card post untuk grid/list
├── prose-content.tsx    → wrapper untuk render Tiptap body (styling prose)
└── breadcrumb.tsx       → navigasi breadcrumb
```

### Open Questions (perlu keputusan sebelum mulai coding)

1. **Navigation**: apakah nav di-hardcode (Blog, Tentang, Kontak) atau dinamis dari Pages?
   - Opsi A: hardcode + Pages jadi sub-nav
   - Opsi B: semua dari Pages (lebih fleksibel, tapi admin harus setup dulu)
   - **Rekomendasi**: Opsi A untuk Layer 1 (cepat), Opsi B untuk Layer 4

2. **Tema / Warna**: primary_color dari settings sudah ada. Cukup untuk Layer 1?
   - Ya — inject sebagai CSS variable, pakai untuk button, link, accent

3. **Font**: dari settings juga (key `font`). Bagaimana load Google Font dinamis?
   - Opsi A: `next/font` dengan fallback Inter (simple, tidak 100% dinamis)
   - Opsi B: inject `<link rel="stylesheet">` di layout berdasarkan settings (lebih fleksibel)
   - **Rekomendasi**: Opsi A dulu untuk Layer 1

4. **Route collision**: `/(public)/[tenant]/[slug]` vs route lain yang sudah ada (`donasi`, `event`, dll)
   - Sudah aman — Next.js App Router prioritaskan folder statis atas dynamic `[slug]`

5. **Apakah halaman event/donasi sudah masuk layout publik (dengan header/footer org)?**
   - Saat ini mereka standalone — tidak punya PublicLayout
   - Perlu diupdate agar konsisten saat front-end jadi

### Status Implementasi

| Layer | Status | Catatan |
|-------|--------|---------|
| Layer 1 (Blog + Beranda) | ⬜ Belum | **PRIORITAS SEKARANG** |
| Layer 2 (Pages statis) | ⬜ Belum | Setelah Layer 1 |
| Layer 3 Donasi | ✅ Sudah ada | Di `(public)/[tenant]/donasi/` |
| Layer 3 Event | ✅ Sudah ada | Di `(public)/[tenant]/event/` |
| Layer 3 Dokumen | ✅ Sudah ada | Di `(public)/[tenant]/dokumen/` |
| Domain Routing Fase 2–3 | ⬜ Belum | Middleware update |
| PublicLayout (header/footer) | ⬜ Belum | Perlu dibuat dulu |
| Toko Publik | ⬜ Belum | Layer 4 |
| Navigation Builder | ⬜ Belum | Layer 4 |
