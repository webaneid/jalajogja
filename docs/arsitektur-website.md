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

## Bagian 3: Front-end Publik — Page Template System

### Filosofi

Website publik dikontrol penuh oleh tenant. Admin pilih **template** untuk setiap halaman.
Template yang lebih sederhana langsung render. Landing page punya **section builder** drag & drop.

Semua preview menggunakan **wireframe CSS/Tailwind** (skeleton abu-abu). Setelah dipilih,
design asli yang render. Tidak ada gambar PNG — murni Tailwind untuk performa.

---

### 5 Template Halaman

| Template | Deskripsi | Body Format |
|----------|-----------|-------------|
| `default` | Tiptap body + featured image | Tiptap JSON (sudah ada) |
| `landing` | Section builder drag & drop | `{ sections: SectionItem[] }` |
| `contact` | Form + info kontak + Google Maps | `{ showForm, mapEmbedUrl, customTitle }` |
| `about` | Tiptap body, layout beda | Tiptap JSON |
| `linktree` | Link list mobile-optimized | `{ profileImage, bio, links: LinkItem[] }` |

---

### DB Schema: Kolom Baru di `pages`

```sql
-- Tambah ke DDL create-tenant-schema.ts + migration manual tenant existing
ALTER TABLE pages ADD COLUMN template TEXT NOT NULL DEFAULT 'default';
```

Drizzle schema update:
```typescript
template: text("template", {
  enum: ["default", "landing", "contact", "about", "linktree"]
}).notNull().default("default"),
```

---

### Tabel Baru: `contact_submissions`

Form Contact Page menyimpan pesan masuk ke DB — bukan hanya email.
Jadi ada "Inbox Pesan" di dashboard.

```sql
CREATE TABLE contact_submissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id     UUID NOT NULL,            -- FK → pages.id
  name        TEXT NOT NULL,
  email       TEXT,
  phone       TEXT,
  message     TEXT NOT NULL,
  is_read     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Dashboard: `/{slug}/website/pesan` — list submissions dengan badge unread count.

---

### Template: Landing Page — Section Builder

#### Konsep Alur Admin

```
Edit halaman (template=landing)
  ↓
[Section List — drag & drop menggunakan @dnd-kit/sortable]
  ⠿  [Wireframe Hero]       Hero              [Ganti Design] [Edit] [Hapus]
  ⠿  [Wireframe Posts]      Postingan Terbaru [Ganti Design] [Edit] [Hapus]
  ⠿  [Wireframe Gallery]    Galeri            [Ganti Design] [Edit] [Hapus]
  
  [+ Tambah Section]
```

- **Ganti Design** → popup picker: wireframe grid semua variant section type itu → klik → langsung apply
- **Edit** → panel/drawer edit konten section (field sesuai type)
- **Drag** → reorder urutan

#### Format Data `body` untuk Landing

```typescript
type SectionItem = {
  id:      string;        // UUID lokal (nanoid), untuk React key + drag
  type:    SectionType;   // "hero" | "posts" | "gallery" | ...
  variant: string;        // "1" | "2" | ... (design variant)
  data:    Record<string, unknown>; // konten spesifik per type
}

type LandingBody = {
  sections: SectionItem[];
}
```

#### Section Types (mulai 1 variant per type, siap tambah lebih)

| Type | Label | Data Fields | Auto-data |
|------|-------|-------------|-----------|
| `hero` | Hero Banner | title, subtitle, ctaLabel, ctaUrl, bgImageUrl, bgColor | — |
| `posts` | Postingan Terbaru | title, count(6) | Ambil dari DB otomatis |
| `events` | Event Mendatang | title, count(3) | Ambil dari DB otomatis |
| `gallery` | Galeri Foto | title, images[{url,alt}] | — |
| `about_text` | Tentang Kami | title, body, imageUrl, imagePosition(left\|right) | — |
| `features` | Keunggulan / Layanan | title, items[{icon,title,desc}] max 6 | — |
| `cta` | Call to Action | title, subtitle, ctaLabel, ctaUrl, bgColor | — |
| `contact_info` | Info Kontak | — | Dari settings otomatis |
| `stats` | Statistik | items[{number,label}] max 4 | — |
| `divider` | Pemisah / Spacer | height, bgColor | — |

#### Default Sections saat Template Dipilih

Saat admin pilih template `landing` untuk pertama kali, langsung ada 3 section default:
```
[Hero v1] → [Posts Terbaru v1] → [Contact Info v1]
```
Admin bisa langsung edit atau tambah section lain.

#### Wireframe Tiap Section (CSS Tailwind)

Wireframe = skeleton representasi layout section. Contoh Hero v1:
```
┌────────────────────────────────────┐
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│  ← bg gray
│         ██████████████            │  ← title bar
│         ████████████              │  ← subtitle bar
│         ┌──────┐  ┌──────┐        │  ← CTA buttons
│         └──────┘  └──────┘        │
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
└────────────────────────────────────┘
```
Dibuat dengan `div` bg-gray-200, rounded, animate-pulse optional.

---

### Template: Contact Page

Satu design untuk sekarang. Config di `body`:
```typescript
type ContactBody = {
  customTitle?:  string;   // default: "Hubungi Kami"
  showForm:      boolean;  // default: true
  showMap:       boolean;  // default: true
  mapEmbedUrl?:  string;   // paste dari Google Maps → Share → Embed
  successMsg?:   string;   // pesan setelah form submit
}
```

Data kontak (nama org, email, telepon, alamat) otomatis dari `settings` group `contact`.

Layout render di front-end:
```
[Judul: "Hubungi Kami" atau customTitle]
[Grid 2 kolom]
  Kiri:                    Kanan:
  - Nama (required)        - Nama organisasi
  - Email                  - Telepon
  - Telepon                - Email
  - Pesan (required)       - Alamat
  - [Kirim]                - Socials icons
[Google Maps iframe full-width bawah]
```

---

### Template: Linktree

Mobile-first (max-width 480px centered).

```typescript
type LinkItem = {
  id:      string;
  type:    LinkType;   // enum di bawah
  label:   string;     // custom label
  url:     string;
  enabled: boolean;
}

type LinktreeBody = {
  profileImageUrl?: string;
  bio?:             string;
  links:            LinkItem[];
}

// Link types dengan icon bawaan
type LinkType =
  | "instagram" | "tiktok" | "facebook" | "youtube" | "twitter"
  | "whatsapp"  | "telegram" | "linkedin" | "email" | "phone"
  | "website"   | "shopee"   | "tokopedia" | "gofood" | "grabfood"
  | "custom"    // generic link, pakai icon Globe
```

Layout:
```
[Logo/foto profil bulat]
[Nama org]
[Bio text]
[Instagram ─────────────────── →]
[TikTok ─────────────────────── →]
[Website ────────────────────── →]
[WhatsApp ───────────────────── →]
```

Admin editor: list link dengan drag reorder (juga pakai @dnd-kit), toggle enabled/disabled,
edit label + url + type.

---

### Template: About Us

Sama dengan `default` — Tiptap editor. Tapi front-end render dengan layout yang berbeda:
- Sidebar info organisasi (ambil dari settings)
- Featured image sebagai hero atas
- Body di bawahnya

Tidak ada field tambahan — beda hanya di presentasi front-end.

---

### Template: Default

Status quo — Tiptap body + featured image. Render sebagai artikel biasa.

---

### Struktur Route Front-end

```
app/(public)/[tenant]/
├── layout.tsx              → PublicLayout (header + footer dari settings)
├── page.tsx                → / → Render halaman slug="home" atau fallback
├── blog/
│   ├── page.tsx            → /blog → list posts published
│   └── [postSlug]/
│       └── page.tsx        → /blog/[slug] → detail post + SEO
├── [pageSlug]/
│   └── page.tsx            → /[slug] → router template (pilih renderer)
├── donasi/[slug]/page.tsx  → ✅ sudah ada
├── event/[slug]/page.tsx   → ✅ sudah ada
├── dokumen/[id]/page.tsx   → ✅ sudah ada
├── sign/[token]/page.tsx   → ✅ sudah ada
└── verify/[hash]/page.tsx  → ✅ sudah ada
```

Route `[pageSlug]` adalah **template router**:
```typescript
// app/(public)/[tenant]/[pageSlug]/page.tsx
const page = await fetchPage(slug, pageSlug)
if (!page || page.status !== "published") notFound()

switch (page.template) {
  case "landing":  return <LandingTemplate page={page} tenant={tenant} />
  case "contact":  return <ContactTemplate page={page} tenant={tenant} settings={contact} />
  case "linktree": return <LinktreeTemplate page={page} />
  case "about":    return <AboutTemplate page={page} tenant={tenant} />
  default:         return <DefaultTemplate page={page} />
}
```

---

### Komponen Struktur

```
components/public/
├── layout/
│   ├── public-header.tsx      → logo + nav (Pages published, sorted by order)
│   ├── public-footer.tsx      → socials + kontak + copyright
│   └── public-layout.tsx      → wrapper: inject CSS vars warna + font
├── templates/
│   ├── default-template.tsx   → Tiptap body + featured image
│   ├── about-template.tsx     → sidebar info + Tiptap body
│   ├── contact-template.tsx   → form + info + maps
│   ├── linktree-template.tsx  → mobile link list
│   └── landing-template.tsx  → loop sections → render per type+variant
├── sections/
│   ├── hero/
│   │   ├── hero-v1.tsx        → full-width hero: bg + title + subtitle + CTA
│   │   └── hero-wireframe.tsx → CSS wireframe untuk picker
│   ├── posts/
│   │   ├── posts-v1.tsx       → grid 3 kolom card
│   │   └── posts-wireframe.tsx
│   ├── gallery/
│   │   ├── gallery-v1.tsx     → masonry/grid foto
│   │   └── gallery-wireframe.tsx
│   └── ... (satu folder per section type)
├── post-card.tsx              → card post reusable
└── prose-content.tsx          → Tiptap body renderer untuk front-end
```

```
components/website/        (dashboard admin — sudah ada, tambahkan:)
├── page-template-picker.tsx   → grid wireframe pilih template
├── landing-builder.tsx        → drag & drop section list (@dnd-kit)
├── section-picker.tsx         → popup wireframe picker variant per type
├── section-editor/
│   ├── hero-editor.tsx
│   ├── posts-editor.tsx
│   ├── gallery-editor.tsx
│   └── ... (satu per type)
├── contact-page-editor.tsx    → form + toggle showMap + paste mapUrl
└── linktree-editor.tsx        → drag & drop link list
```

---

### Dashboard: Admin Landing Builder

```
PageForm (template=landing)
  ↓ bukan Tiptap editor
  ↓ render LandingBuilder

LandingBuilder (client component, @dnd-kit/sortable):
  SortableContext → DndContext
    SectionRow (draggable):
      [GripVertical] [Wireframe mini 60px] [Label] [Ganti] [Edit ▼] [Trash]
  
  [+ Tambah Section] → SectionPicker modal:
      Grid wireframe semua section types
      Klik → append ke list dengan variant "1"
  
  Section Picker per row (Ganti Design):
      Popup wireframe semua variant untuk type itu
      Klik → update variant di state

  Section Editor panel (Edit):
      Slide-in drawer dari kanan
      Field sesuai type (title, url, images, dll)
```

---

### Dashboard: Inbox Pesan (Contact Submissions)

Route baru: `/{slug}/website/pesan`

```
Sidebar nav website:
  Dashboard
  Posts
  Halaman
  Kategori
  Pesan      ← BARU (badge angka unread)
```

List page: tanggal, nama, email, pesan preview, status baca/belum.
Detail: modal atau expand inline.
Server action: `markContactSubmissionReadAction(slug, submissionId)`.

---

### Caching Strategy

| Halaman | Revalidate |
|---------|-----------|
| Beranda / | 60 detik |
| /blog list | 60 detik |
| /blog/[slug] | 300 detik |
| /[pageSlug] landing/contact/dll | 120 detik |
| Linktree | 300 detik |

Saat admin publish/update konten → `revalidatePath(`/(public)/${slug}/...`)` di server action.

---

### Dependensi Baru

```bash
bun add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

Hanya untuk dashboard (client component). Front-end publik tidak perlu dnd-kit.

---

### Status Implementasi

| Komponen | Status | Commit |
|----------|--------|--------|
| DB: kolom `template` di pages | ✅ Selesai | Fase 1 |
| DB: tabel `contact_submissions` | ✅ Selesai | Fase 1 |
| Admin: Template picker di PageForm sidebar | ✅ Selesai | Fase 2 |
| Admin: `LandingBuilder` drag & drop | ✅ Selesai | Fase 2 |
| Admin: `SectionPicker` wireframe popup | ✅ Selesai | Fase 2 |
| Admin: Section Editors 10 types | ✅ Selesai | Fase 2 |
| Admin: `ContactPageEditor` | ✅ Selesai | Fase 2 |
| Admin: `LinktreeEditor` drag & drop | ✅ Selesai | Fase 2 |
| Admin: Inbox Pesan (`/website/pesan`) | ✅ Selesai | Fase 5 |
| Front-end: Template Router `/[pageSlug]` | ✅ Selesai | Fase 3 |
| Front-end: `DefaultTemplate` + `AboutTemplate` | ✅ Selesai | Fase 3 |
| Front-end: `LandingTemplate` + 10 sections | ✅ Selesai | Fase 4 |
| Front-end: `ContactTemplate` + form submit | ✅ Selesai | Fase 5 |
| Front-end: `LinktreeTemplate` | ✅ Selesai | Fase 5 |
| Front-end: `/blog` list + `/blog/[slug]` | ✅ Selesai | Fase 6 |
| Front-end: `PublicLayout` (header+footer) | ⬜ Belum | — |
| Front-end: `/` (homepage route) | ⬜ Belum | — |
| Domain routing Fase 2-3 (middleware) | ⬜ Belum | — |

### Komponen File Map (Sudah Diimplementasikan)

```
apps/web/
├── lib/page-templates.ts                    → semua types + parse helpers
├── components/website/
│   ├── landing-builder.tsx                  → drag & drop section admin
│   ├── section-picker.tsx                   → wireframe popup pilih section
│   ├── section-editors.tsx                  → editor per section type (10 types)
│   ├── section-wireframes.tsx               → CSS wireframe thumbnails
│   ├── contact-page-editor.tsx              → editor contact page
│   ├── linktree-editor.tsx                  → editor linktree dengan dnd
│   └── public/
│       ├── default-template.tsx             → Tiptap HTML renderer
│       ├── landing-template.tsx             → async server, 10 section renderers
│       ├── contact-template.tsx             → client, form + maps + info
│       └── linktree-template.tsx            → mobile-first link list
├── app/(public)/[tenant]/
│   ├── [pageSlug]/
│   │   ├── page.tsx                         → template router
│   │   └── actions.ts                       → submitContactFormAction
│   ├── blog/
│   │   ├── page.tsx                         → list posts ISR 60s
│   │   └── [slug]/page.tsx                  → detail post ISR 60s
└── app/(dashboard)/[tenant]/website/
    └── pesan/
        ├── page.tsx                         → inbox submissions
        ├── actions.ts                       → markSubmissionReadAction
        └── mark-read-button.tsx             → client tombol tandai dibaca
```

### Migration SQL Tenant Existing

```sql
-- Jalankan per tenant yang sudah ada:
ALTER TABLE "tenant_{slug}".pages
  ADD COLUMN IF NOT EXISTS template TEXT NOT NULL DEFAULT 'default'
    CHECK (template IN ('default','landing','contact','about','linktree'));

CREATE TABLE IF NOT EXISTS "tenant_{slug}".contact_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES "tenant_{slug}".pages(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```
