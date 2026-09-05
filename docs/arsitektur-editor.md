# Arsitektur Editor Tiptap & Content Renderer Universal — Jalakarta

> **Status Dokumen: 📋 MASTER BLUEPRINT & SPESIFIKASI TEKNIS (2026-07-26)**
> **Tujuan**: Menjadi panduan tunggal dan acuan arsitektur untuk komponen **Tiptap Editor** di Dashboard Admin dan **Rich Content Renderer** di Front-end Publik di seluruh modul Jalakarta (Posts, Pages, Toko, Donasi, Event, Surat).

---

## 1. Audit Konsistensi Editor Saat Ini

Hasil audit kode pada seluruh modul Jalakarta menunjukkan bahwa **infrastruktur editor telah terkonsolidasi dengan sangat baik pada satu komponen utama**:

* **Core Editor Component**: `apps/web/components/editor/tiptap-editor.tsx` (`<TiptapEditor>`)
* **Toolbar Component**: `apps/web/components/editor/editor-toolbar.tsx` (`<EditorToolbar>`)
* **Modul yang Memakai `<TiptapEditor>`**:
  1. **Posts (Artikel/Berita)** ➔ `components/website/post-form.tsx`
  2. **Pages (Halaman Statis)** ➔ `components/website/page-form.tsx`
  3. **Products (Toko/Produk)** ➔ `components/toko/product-form.tsx`
  4. **Campaigns (Donasi/Infaq)** ➔ `components/donasi/campaign-form.tsx`
  5. **Events (Agenda/Kegiatan)** ➔ `components/event/event-form.tsx`
  6. **Letters & Templates (Modul Surat)** ➔ `components/letters/letter-form.tsx` & `letter-template-form.tsx`

> [!NOTE]
> **Prinsip Utama**: Karena seluruh modul di atas mengimpor `<TiptapEditor>` dari `@/components/editor/tiptap-editor`, **setiap penambahan block, plugin, atau perbaikan pada komponen editor utama secara otomatis berlaku di SELURUH MODUL tanpa perlu mengubah kode form di masing-masing modul.**

---

## 2. Audit Gap & Bug Editor / Content Renderer

Berdasarkan audit teknis terhadap `tiptap-editor.tsx`, `embed-block-ext.ts`, dan tampilan front-end publik, ditemukan **5 Gap & Kebutuhan Utama**:

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                          TEMUAN GAP & BUG EDITOR CURRENT                                │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. GAP: Belum ada Block "Baca Juga" (Callout Link Terkait dengan Autocomplete URL)      │
│ 2. GAP: BlockQuote bawaan StarterKit masih polos (belum ada field Penulis/Citation)     │
│ 3. BUG/LIMITASI: Embed YouTube via noembed.com menghasilkan iframe fixed-width (480x270)│
│    sehingga berisiko terpotong (overflow horizontal) di layar Smartphone.               │
│ 4. GAP: Belum ada dukungan Embed Post/Reel Instagram.                                   │
│ 5. GAP: Spacing & Margin antar-block di Front-end Publik belum seragam lintas modul.     │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Spesifikasi Perencanaan 5 Fitur & Enhancement Baru

---

### 3.1. Fitur 1: Block "Baca Juga" (`RelatedLinkBlock`)

Block khusus untuk menyisipkan rekomendasi bacaan artikel terkait, baik tautan internal website tenant (memanfaatkan `<PublicLinkPicker>`) maupun URL eksternal.

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ 🔗 Baca Juga:                                                                           │
│    Silaturahmi Akbar IKPM Yogyakarta Siap Digelar Bulan Depan                         ➜ │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

#### A. Skema Attributes Extension Tiptap (`related-link-block-ext.ts`)
* `label`: string (pilihan default: `"Baca Juga:"`, `"Artikel Terkait:"`, `"Lihat Juga:"`, `"Rekomendasi:"`).
* `title`: string (judul link / artikel).
* `url`: string (URL internal seperti `/ikpm-jogja/post/judul` atau URL eksternal).
* `isExternal`: boolean (auto-detected `url.startsWith("http")`).

#### B. UI Popover Input di Toolbar Editor
Saat tombol **"Baca Juga"** diklik pada toolbar editor:
1. Muncul Popover/Dialog modal kecil.
2. Form memuat:
   * **Dropdown Label**: Opsi `"Baca Juga:"`, `"Artikel Terkait:"`, `"Lihat Juga:"`, `"Rekomendasi:"`.
   * **URL Picker**: Menggunakan komponen universal `<PublicLinkPicker slug={slug}>` (`components/ui/public-link-picker.tsx`) untuk autocomplete pencarian tautan internal, atau input URL manual jika eksternal.
   * **Judul Tautan**: Auto-fill dari hasil `<PublicLinkPicker>` atau diisi manual oleh admin.
3. Klik "Sisipkan Baca Juga" ➔ Command `editor.commands.insertRelatedLink({ label, title, url, isExternal })`.

#### C. Desain Front-end Callout Card (`PublicContentRenderer`)
Rendered di front-end sebagai card interaktif yang indah dan responsif:
```html
<div className="my-6 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:p-5
                transition-all duration-200 hover:bg-primary/10 hover:shadow-sm">
  <div className="flex items-center gap-3.5">
    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg
                     bg-primary text-primary-foreground shadow-sm">
      <Link2 className="h-4 w-4" />
    </span>
    <div className="min-w-0 flex-1 text-sm sm:text-base">
      <span className="font-bold text-primary mr-2">{label}</span>
      <a href={url} className="font-medium text-foreground hover:underline hover:text-primary transition-colors">
        {title}
      </a>
    </div>
    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
  </div>
</div>
```

---

### 3.2. Fitur 2: Block Quote Enhanced (`EnhancedBlockquote`)

Memperluas `blockquote` Tiptap bawaan agar mendukung **Atribusi Penulis / Sumber Kutipan (*Citation*)** serta tampilan visual kelas atas di front-end.

#### A. Skema Attributes Extension
* `citation`: string | null (nama tokoh, penulis, atau sumber kutipan, misal `"KH. Ahmad Sahal — Pendiri Gontor"`).

#### B. UI Toolbar & Bubble Menu
* Ketika teks diblok dan dijadikan Quote, toolbar menyediakan input tambahan **"Sumber / Penulis Kutipan (Opsional)"**.

#### C. Desain Front-end Quote Card
```html
<figure className="relative my-8 overflow-hidden rounded-r-2xl border-l-4 border-primary
                   bg-muted/40 p-6 sm:p-8 backdrop-blur-sm">
  <!-- Watermark Icon Quote Dekoratif -->
  <Quote className="absolute top-4 right-4 h-12 w-12 text-primary/10 pointer-events-none" />
  
  <blockquote className="relative z-10 text-base sm:text-lg italic font-medium
                         leading-relaxed text-foreground/90">
    "{content}"
  </blockquote>
  
  {citation && (
    <figcaption className="relative z-10 mt-4 flex items-center gap-2 text-xs sm:text-sm
                           font-semibold text-primary">
      <span className="h-0.5 w-6 bg-primary/50" />
      <span>{citation}</span>
    </figcaption>
  )}
</figure>
```

---

### 3.3. Fitur 3: Responsive YouTube Video Embed Extension

Memperbaiki bug `noembed.com` yang mengembalikan iframe berukuran tetap (`width="480" height="270"`).

#### A. Parsing URL YouTube Universal
Mendukung semua pola URL YouTube:
* `https://www.youtube.com/watch?v=dQw4w9WgXcQ`
* `https://youtu.be/dQw4w9WgXcQ`
* `https://www.youtube.com/embed/dQw4w9WgXcQ`
* `https://www.youtube.com/shorts/dQw4w9WgXcQ`

#### B. Container Aspect-Ratio 16:9 Responsif (Zero Overflow Mobile)
Iframe dibungkus wrapper dengan rasio aspek 16:9 murni:
```html
<div className="my-6 sm:my-8 relative w-full aspect-video rounded-xl sm:rounded-2xl
                overflow-hidden shadow-md bg-black group">
  <iframe
    src={`https://www.youtube-nocookie.com/embed/${videoId}`}
    className="absolute inset-0 w-full h-full border-0"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    allowFullScreen
    loading="lazy"
  />
</div>
```

---

### 3.4. Fitur 4: Responsive Instagram Post & Reel Embed

Menambahkan dukungan embed Post & Reel dari **Instagram**.

#### A. Parsing URL Instagram
Mendukung pola URL:
* `https://www.instagram.com/p/{postId}/`
* `https://www.instagram.com/reel/{reelId}/`

#### B. Render & Auto Script Processing
```html
<div className="my-6 sm:my-8 flex justify-center">
  <div className="w-full max-w-[540px] overflow-hidden rounded-xl border border-border bg-background shadow-sm">
    <blockquote
      className="instagram-media"
      data-instgrm-permalink={url}
      data-instgrm-version="14"
    >
      <a href={url} target="_blank" rel="noopener noreferrer" className="p-4 block text-center text-sm text-primary">
        Lihat postingan ini di Instagram
      </a>
    </blockquote>
  </div>
</div>
```
* **Auto Script Loader**: Komponen otomatis mengeksekusi `window.instgrm?.Embeds?.process()` setelah komponen terpasang di DOM agar widget Instagram langsung ter-render dengan sempurna.

---

### 3.5. Fitur 5: Konsistensi Spacing & Jarak Antar-Block di Front-end (`.prose-jalakarta`)

Untuk memastikan jarak antar-paragraf, judul, gambar, video, quote, dan callout **benar-benar konsisten dan responsif di seluruh layar (Mobile, Tablet, Desktop)**, dibuat aturan typography universal `.prose-jalakarta` di `globals.css`:

```css
@layer utilities {
  .prose-jalakarta {
    @apply text-foreground/90 text-base leading-relaxed;
  }
  .prose-jalakarta > * + * {
    @apply my-5 sm:my-6;
  }
  .prose-jalakarta h1, .prose-jalakarta h2, .prose-jalakarta h3 {
    @apply font-bold tracking-tight text-foreground mt-8 mb-4;
  }
  .prose-jalakarta p {
    @apply my-4 leading-relaxed;
  }
  .prose-jalakarta ul, .prose-jalakarta ol {
    @apply my-4 pl-6 space-y-2;
  }
  .prose-jalakarta figure, .prose-jalakarta .embed-block-wrapper {
    @apply my-6 sm:my-8;
  }
}
```

---

### 3.6. Kompatibilitas Import & Export WordPress (WordPress & Gutenberg Block Alignment)

Agar seluruh block baru di atas kompatibel dua arah dengan WordPress (saat di-import dari WordPress WXR/REST API atau saat di-export dari Jalakarta ke WordPress), ditentukan aturan transformasi standar:

| Block Jalakarta | Format HTML Tiptap Jalakarta | Mapping Gutenberg / WordPress HTML |
|---|---|---|
| **Baca Juga** | `<div data-type="related-link-block" data-label="..." data-url="...">...</div>` | `<p class="wp-block-callout"><strong>{label}</strong> <a href="{url}">{title}</a></p>` |
| **Enhanced Blockquote** | `<blockquote><p>{content}</p><cite>{citation}</cite></blockquote>` | `<!-- wp:quote --><blockquote><p>{content}</p><cite>{citation}</cite></blockquote><!-- /wp:quote -->` |
| **YouTube Embed** | `<div data-type="youtube-embed" data-video-id="...">...</div>` | `<!-- wp:embed {"url":"https://www.youtube.com/watch?v={id}","type":"video","providerNameSlug":"youtube"} -->` |
| **Instagram Embed** | `<div data-type="instagram-embed" data-url="...">...</div>` | `<!-- wp:embed {"url":"{url}","type":"rich","providerNameSlug":"instagram"} -->` |

> **Sanitasi saat Import/Export**: Parser WXR XML / REST API (dari `docs/arsitektur-import-export-post-wordpress.md`) membaca tag `<cite>` bawaan WP `<blockquote class="wp-block-quote">` dan mengubahnya menjadi `citation` attribute pada Tiptap. Begitu pula sebaliknya saat export WXR XML, seluruh block dikonversi ke HTML standar yang dipahami oleh WordPress secara sempurna.

---

## 4. Roadmap Pelaksanaan & Status Implementasi

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    ROADMAP PENGEMBANGAN EDITOR TIPTAP                   │
└─────────────────────────────────────────────────────────────────────────┘
   │
   ├── ✅ Fase 1: Block "Baca Juga" (`RelatedLinkBlock`) — SELESAI
   │     ├── Extension `related-link-ext.ts` & `related-link-view.tsx`
   │     ├── Popover Dialog di `EditorToolbar` dengan `<PublicLinkPicker>`
   │     └── Component Render Callout Card di Frontend
   │
   ├── ✅ Fase 2: Block Quote Enhanced (`EnhancedBlockquote`) — SELESAI
   │     ├── Custom Extension dengan attribute `citation` (`enhanced-blockquote-ext.ts`)
   │     ├── Toolbar / Dialog input citation
   │     └── Styling Front-end Quote Card (Aksen border & Icon Quote)
   │
   ├── ✅ Fase 3: Responsive YouTube & Instagram Embed Extension — SELESAI
   │     ├── Native YouTube URL parser + `aspect-video` 16:9 container (`embed-block-ext.ts`)
   │     ├── Instagram URL parser + `instagram.com/embed.js` script injector (`embed-block-view.tsx`)
   │     └── Integration di `EmbedBlock` / Toolbar
   │
   └── ❌ Fase 4: System-wide Frontend Spacing & Typography (`.prose-jalakarta`) — DIBATALKAN
         └── Lihat § 5 di bawah — class ini ternyata dead CSS sejak awal, dihapus.
```

---

> **Status Implementasi: ⚠️ SELESAI SEBAGIAN + 3 BUG DITEMUKAN+DIPERBAIKI (2026-07-26).**
> `bun x tsc --noEmit` 0 Error MEMANG benar (klaim awal terverifikasi), TAPI itu tidak berarti
> bebas bug — lihat § 5 untuk audit lengkap. Ringkasan: Fase 1–3 (Baca Juga, Enhanced Blockquote,
> YouTube/Instagram Embed) fungsional, tapi punya 1 bug data-breaking (link internal "Baca Juga"
> rusak di custom domain) dan 1 bug minor (Instagram script bisa ter-inject dobel) — KEDUANYA
> SUDAH DIPERBAIKI. Fase 4 (`.prose-jalakarta`) ternyata dead code sejak commit pertama — tidak
> pernah dipakai di satu halaman pun — DIHAPUS atas keputusan user, bukan diwiring (spacing
> antar-block front-end sudah konsisten lewat mekanisme lama: class `prose` + inline style dari
> `renderBody()`). Klaim "kompatibilitas import/export WordPress" di ringkasan awal TIDAK AKURAT
> — `docs/arsitektur-import-export-post-wordpress.md` berstatus rancangan, belum diimplementasi
> sama sekali; diabaikan dulu sesuai arahan user, akan dieksekusi terpisah nanti.
> **Susulan § 6 (2026-07-26)**: block "Baca Juga" ditingkatkan — auto-fill judul dari hasil
> pencarian, Label Awalan jadi teks bebas (bukan dropdown 4 pilihan tetap), fix popup melebar
> saat URL panjang (`min-w-0` di flex item yang sebelumnya tidak truncate).

## 5. Audit Pasca-Implementasi (2026-07-26) — 3 Temuan, Semua Diverifikasi ke Kode

Audit dilakukan atas permintaan user setelah menerima ringkasan eksekusi dari agent lain — setiap
klaim di ringkasan itu diverifikasi LANGSUNG ke kode (bukan dipercaya begitu saja), sesuai prinsip
"CLAUDE.md adalah project brain, bukan source of truth — verifikasi ke kode aktual".

### 5.1. Bug Data-Breaking: Link Internal "Baca Juga" Rusak di Custom Domain (SUDAH DIFIX)

`RelatedLinkDialog` (toolbar) memakai `<PublicLinkPicker>` yang — sesuai kontraknya
(`docs/arsitektur-public-link-picker.md`) — SELALU mengembalikan URL path-mode
(`/{slug}/post/{postSlug}`). URL ini disimpan apa adanya di attribute `url` block
`relatedLinkBlock`, lalu di-render oleh `letter-render.ts` (dipakai bersama oleh Post/Page/
Produk/Campaign/Event lewat `renderBody()`) sebagai `<a href="${url}">` — **tanpa** pernah
dilewatkan `stripTenantPrefix()`. Ini persis kelas bug yang sudah berulang kali muncul dan
diperbaiki di project ini untuk fitur lain (nav menu, Hero CTA, CTA section, About section) —
semuanya sudah dikunci pola `stripTenantPrefix()`-nya, tapi fitur BARU ini luput.

**Dampak**: di tenant dengan custom domain aktif (mis. `visikita.com`), pengunjung yang klik
"Baca Juga" ke artikel internal diarahkan ke `visikita.com/visikita/post/...` — URL ganda-slug,
404.

**Fix**:
- `lib/letter-render.ts` — `RenderContext` diperluas dengan `tenantSlug?: string` +
  `baseUrl?: string` (semantik sama `resolveBaseUrl()`: `""` = custom domain aktif). Helper baru
  `resolveInternalHref()` memanggil `stripTenantPrefix()` (pure function, sudah aman diimpor ke
  file server-safe ini — nol dependency DOM/Node) HANYA untuk URL non-eksternal.
- `lib/post-body-segments.ts` — `RenderContext` lokal diperluas field yang sama (pass-through
  generik ke `renderBody()`, tidak ada logic tambahan).
- **7 titik pemanggil** diupdate untuk meneruskan `tenantSlug`+`baseUrl` (semua sudah punya
  variabel `resolveBaseUrl()`/`baseUrl` lokal, KECUALI `sign/[token]/page.tsx` dan
  `api/akun/legal/route.ts` yang baru ditambah importnya):
  `post/[slug]/page.tsx` (`splitPostBodySegments` — direorder supaya `resolveBaseUrl` dihitung
  SEBELUM dipanggil), `campaign/[slug]/page.tsx`, `produk/[productSlug]/page.tsx`,
  `agenda/[slug]/page.tsx`, `default-template.tsx` (+ 2 pemanggilnya: `page.tsx` homepage dan
  `[pageSlug]/page.tsx` — ini juga cakupan "terms + privacy + default + about" template),
  `sign/[token]/page.tsx`, `api/akun/legal/route.ts` (endpoint modal Syarat & Ketentuan saat
  registrasi — render KONTEN YANG SAMA dengan `[pageSlug]/page.tsx`, wajib konsisten).
- **Sengaja TIDAK disentuh**: `profesional/[id]/page.tsx` dan `usaha/[id]/page.tsx` — dicek,
  field `description` di kedua modul itu adalah `<textarea>` polos (bukan `TiptapEditor`), jadi
  `relatedLinkBlock` TIDAK PERNAH bisa muncul di sana — fix di situ murni tidak relevan.
  Halaman admin dashboard Surat (`letters/nota|keluar|masuk/[id]/page.tsx`) juga tidak disentuh —
  route `(dashboard)` TIDAK PERNAH diserve dari custom domain (diisolasi sejak lama di
  middleware), jadi `baseUrl` di sana selalu `/{slug}` (tidak pernah `""`) — fix di situ akan
  selalu no-op.
- **Ditemukan tapi DI LUAR SCOPE fix ini**: `letter-html.ts` (generator PDF surat) render link
  APA ADANYA juga, tapi masalahnya BEDA — PDF butuh URL ABSOLUT (relative path tidak resolve ke
  apa pun di viewer PDF), bukan soal custom-domain-prefix. Tidak diperbaiki sekarang (di luar
  laporan awal), dicatat untuk audit terpisah kalau relevan.

### 5.2. Bug Minor: Instagram Embed Script Bisa Ter-inject Dobel (SUDAH DIFIX)

`EmbedBlockView`'s `useEffect` untuk load `instagram.com/embed.js` sebelumnya cek
`window.instgrm?.Embeds` lalu langsung `document.body.appendChild(script)` kalau belum ada —
tanpa cleanup dan tanpa cek apakah script SEDANG dalam proses loading. Dua embed Instagram yang
mount nyaris bersamaan (atau React StrictMode dev-mode yang men-double-invoke effect saat mount)
sama-sama lolos cek itu sebelum script pertama sempat load → script ter-inject dua kali. Selain
itu, `.process()` tidak pernah dipanggil eksplisit setelah script benar-benar load — cuma
mengandalkan auto-scan implisit Instagram, yang tidak reliable untuk embed yang mount SETELAH
script sudah ada tapi sebelum sempat re-scan.

**Fix**: `embed-block-view.tsx` — loader Instagram diubah jadi singleton module-level
(`loadInstagramScript()`, mengembalikan `Promise<void>` yang di-cache) — cuma SATU script tag
pernah dibuat terlepas berapa banyak instance/berapa kali effect di-invoke, dan `.process()`
selalu dipanggil eksplisit lewat `.then()` setelah script benar-benar siap (deteksi ganda: cek
`window.instgrm` dulu, lalu cek `<script>` tag yang sudah ada di DOM sebelum bikin baru).

### 5.3. Gap: `.prose-jalakarta` Dead CSS Sejak Awal — DIHAPUS (Bukan Diwiring)

Ringkasan agent klaim "Menambahkan class utility `.prose-jalakarta`... serta update parser
server-side `letter-render.ts` untuk menjamin konsistensi jarak antar-block" — diverifikasi
SALAH pada dua sisi: (1) `letter-render.ts` tidak pernah punya satu referensi pun ke string
`"prose-jalakarta"`, (2) grep seluruh `app/`+`components/` menunjukkan class ini TIDAK dipakai
di satu halaman/komponen pun — murni CSS mati sejak commit pertama.

**Audit lanjutan** (sebelum diputuskan) membuktikan klaim "front-end belum konsisten" juga tidak
akurat — 5 titik render (`post`, `produk`, `agenda`, `campaign` via `CampaignDetailTabs`,
`default-template`) SEMUA sudah memakai pola yang sama (`prose prose-sm max-w-none` + variasi
kecil Tailwind arbitrary-selector per elemen `p`/`ul`/`ol`/`h2`/`h3`), dan elemen yang tidak
dikontrol class (list, table) sudah dapat inline `style=""` langsung dari `renderBody()` —
sumber kebenaran TUNGGAL untuk semua titik render karena semuanya lewat fungsi yang sama.
Menambah `.prose-jalakarta` di atas mekanisme yang sudah ada berisiko jadi lapisan CSS kedua
yang saling tumpang tindih (sebagian rule bahkan pasti no-op karena kalah spesifisitas dari
inline style), bukan penyederhanaan.

**Keputusan (dikonfirmasi user)**: `.prose-jalakarta` dihapus total dari `globals.css` — TIDAK
diwiring ke halaman mana pun. Spacing antar-block front-end dianggap sudah cukup konsisten via
mekanisme lama (class `prose` + inline style `renderBody()`), tidak perlu sistem baru.

### 5.4. Klaim Tidak Akurat: "Kompatibilitas Import/Export WordPress" — DIABAIKAN Dulu

Ringkasan agent menyebut "Menjamin bebas vendor lock-in dan tanpa bug saat artikel di-export ke
WXR XML WordPress atau di-import dari WordPress lama" — diverifikasi: `docs/arsitektur-import-
export-post-wordpress.md` berstatus eksplisit **"📋 RANCANGAN ARSITEKTUR"** (belum dieksekusi),
dan grep seluruh codebase untuk kode WXR/Gutenberg parsing = nihil. Satu-satunya elemen nyata
adalah `parseHTML()` di `related-link-ext.ts` yang bisa mengenali `<p class="wp-block-callout">`
KALAU HTML itu di-paste manual ke editor (fitur "paste compatibility" kecil, jauh dari WXR
import/export sungguhan). **Sesuai arahan user, diabaikan dulu — akan dieksekusi terpisah nanti,
bukan bagian dari sesi perbaikan ini.**

### 5.5. Yang Sudah Benar (Dicek, Bukan Diasumsikan)

- `EnhancedBlockquote` — `blockquote: false` di-set dengan benar di `StarterKit.configure()`,
  tidak ada duplicate-node-type conflict.
- `relatedLinkBlock` dan `blockquote` (dengan citation) SUDAH ditangani di `letter-render.ts`
  sejak awal, pure string manipulation (tidak pakai `@tiptap/core`/prosemirror-model) —
  konsisten dengan aturan lama "renderBody server-safe".
- `atom: true` pada `RelatedLinkBlock`/`EmbedBlock` — tidak ada content-hole `0` yang salah di
  `renderHTML()`.
- Data lama (blockquote polos tanpa citation, sebelum fitur ini ada) tetap backward-compatible
  — attribute `citation` punya `default: null`.

**Verifikasi**: `tsc --noEmit` bersih (3 putaran, setiap tahap fix) + `bun run build
--filter=@jalajogja/web` sukses (3 putaran, dev server dimatikan+`.next` dibersihkan+direstart
tiap kali). Nol migrasi DB. **Belum diverifikasi visual di browser** — perubahan § 5.1 (link
custom domain) dan § 5.2 (Instagram script) butuh dicoba langsung: buat "Baca Juga" ke artikel
internal di tenant dengan custom domain aktif, dan cek console browser (Network tab) untuk
konfirmasi `embed.js` cuma di-fetch sekali meski ada 2+ embed Instagram di satu halaman.

## 6. Peningkatan Block "Baca Juga" (2026-07-26, susulan) — Auto-fill Judul + Label Bebas + Fix Overflow

Diminta user langsung setelah audit § 5 — 3 perbaikan UX untuk dialog "Sisipkan Block Baca
Juga" (`RelatedLinkDialog`, `editor-toolbar.tsx`).

**Klarifikasi awal penting**: user sempat mengira post/donasi/event "belum terintegrasi" ke
`<PublicLinkPicker>` — dicek ke kode (`/api/ref/public-links/route.ts`), TERNYATA SUDAH ada
sejak lama (query `ilike` ke `posts.title`/`campaigns.title`/`events.title`, hasil dikelompokkan
per grup). Kesalahpahamannya murni UX: konten yang bisa banyak (post/produk/event/campaign/
dokumen) SENGAJA tidak tampil sebelum admin mengetik apa pun (list pendek seperti halaman/
kategori tampil langsung, list besar butuh search dulu) — kalau popover dibuka tanpa mengetik,
kelihatannya "cuma ada laman & modul". Dikonfirmasi ke user, false alarm — bukan bug.

### 6.1. Auto-fill Judul Tautan dari Hasil Pencarian

**Root cause (gap nyata, sudah ditemukan sejak audit § 5.4 tapi belum diprioritaskan)**:
`<PublicLinkPicker>`'s `onChange` HANYA mengirim `url` — meski API mengembalikan `label` (judul
asli post/produk/campaign/dst) dan komponen bahkan MENAMPILKANNYA di dropdown, `handleSelect()`
membuang `label` itu sebelum sampai ke caller.

**Fix**: `Props.onChange` diperluas jadi `(url: string, label?: string) => void` — parameter
kedua OPSIONAL, jadi 6 caller lama (`section-editors.tsx` ×5 untuk CTA Hero/CTA section,
`website-settings-client.tsx` nav menu) TIDAK PERLU diubah sama sekali (TypeScript izinkan
callback dengan parameter lebih sedikit tetap valid untuk signature yang lebih panjang).
`handleSelect(url: string)` diubah jadi `handleSelect(link: PublicLink)` (terima objek utuh,
bukan cuma url) → `onChange(link.url, link.label)`. `RelatedLinkDialog` sekarang pakai parameter
kedua: `onChange={(newUrl, newLabel) => { setUrl(newUrl); if (newLabel) setTitle(newLabel); }}`
— `newLabel` cuma terisi kalau dipilih dari daftar (bukan diketik manual sebagai URL bebas),
jadi tidak pernah menimpa judul dengan string kosong untuk kasus URL eksternal manual.

### 6.2. Label Awalan: Dropdown → Teks Bebas, Default "Baca Juga:"

`<select>` 4 pilihan tetap (`"Baca Juga:"`/`"Artikel Terkait:"`/`"Lihat Juga:"`/`"Rekomendasi:"`)
diganti `<Input>` teks bebas — admin bisa isi label apa pun, `useState("Baca Juga:")` tetap jadi
nilai default (tidak berubah, cuma cara inputnya). Validasi/insert logic (`handleInsert`) tidak
disentuh — `label` tetap dikirim apa adanya ke `insertRelatedLink()`.

### 6.3. Fix Overflow: URL Panjang Bikin Popup Melebar

**Root cause**: dua `<span className="flex-1 truncate">` di `PublicLinkPicker` (trigger button
+ item dropdown) tidak punya `min-w-0` — flex item dengan `flex-1` TANPA `min-w-0` tidak akan
benar-benar truncate (default `min-width: auto` pada flex item membuatnya tidak mau menyusut di
bawah ukuran intrinsik kontennya), jadi URL panjang memaksa tombol/popover (dan `<DialogContent
className="max-w-md">` di sekelilingnya, untuk kasus dialog "Baca Juga") melebar melewati batas
yang dimaksud.

**Fix**: tambah `min-w-0` di kedua span (trigger button's `flex-1 min-w-0 truncate`, dropdown
item's label span sama). Sekalian ditambah `shrink-0` di span URL preview dropdown (yang sudah
punya `max-w-[140px]`) — supaya preview URL tidak ikut terjepit ke lebar nyaris nol saat label
di sebelahnya butuh ruang lebih banyak, tetap kelihatan sebagian.

**Verifikasi**: `tsc --noEmit` bersih (percobaan pertama) + `bun run build --filter=@jalajogja/web`
sukses (dev server dimatikan+`.next` dibersihkan+direstart). Nol migrasi DB. **Belum
diverifikasi visual di browser** — user diminta coba: buka dialog "Baca Juga", cari post/
donasi/event by judul (konfirmasi klarifikasi § "false alarm" di atas), pilih satu, cek field
"Judul Artikel / Tautan" langsung terisi otomatis; ketik Label Awalan custom; pilih/paste URL
yang sangat panjang, cek popup tidak melebar/overflow.

---

## 7. Tiptap v3 — Gotcha Teknis Dasar (migrasi dari v2)

- `BubbleMenu` pindah subpath: `@tiptap/react/menus` (bukan `@tiptap/react` langsung).
- `immediatelyRender: false` wajib di config editor untuk Next.js SSR (App Router).
- Named import untuk extension bawaan: `{ TextStyle }`, `{ Table }` (bukan default import).
- Tidak ada `tippyOptions` lagi — ganti Floating UI: `options={{ placement: "top" }}`.
- `setContent(parsed)` tanpa argument kedua (signature lama menerimanya, v3 tidak).
- oEmbed universal via `noembed.com/embed?url=` — support 300+ platform, tidak perlu package
  tambahan per-platform.
- `EmbedBlockView`: `dangerouslySetInnerHTML` tidak re-execute tag `<script>` yang dikandungnya —
  pakai `useEffect` untuk re-inject script secara manual (perlu untuk embed Twitter/Instagram
  yang butuh script loader).
- Preview konten embed (bukan editor aktif): jangan pakai `dangerouslySetInnerHTML` polos di
  preview — pakai `<TiptapEditor editable={false}>` supaya React NodeView (termasuk logic
  re-inject script di atas) tetap aktif.

