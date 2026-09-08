# Arsitektur Modul Event

> Status: **Step 1–6 (Core) ✅ | E7 (Schema donation prompt) ✅ | E8 (EventCard+Section) ✅ | E9 (Arsip+Detail publik) ✅ | E10 (Donation Prompt UI) ✅**

> **Fitur tambahan post-Step 6:**
> - Migration 0020 — Tiket Wajib Anggota (`requires_membership`) ✅
> - Migration 0022 — Dynamic Custom Form Fields (`custom_form_fields`) ✅
> - Migration 0023 — Tab Peserta & Statistik (`show_attendee_stats`, `attendee_stats_by`) ✅
> - Migration 0024 — Donation Prompt schema (`show_donation_prompt`, `linked_campaign_id`) ✅
> - Migration 0025 — Linked Product (`linked_product_id`) ✅

## Konsep

Modul Event adalah sistem manajemen kegiatan organisasi — seminar, halal bihalal, kajian, rapat, dll.
Peserta bisa mendaftar lewat halaman publik, memilih tiket (gratis atau berbayar), dan mendapat bukti pendaftaran.

### Perbedaan dengan Modul Donasi
| | Donasi | Event |
|---|---|---|
| Entitas utama | Campaign (penggalangan dana) | Event (kegiatan dengan jadwal) |
| Transaksi | Sumbangan bebas nominal | Tiket dengan harga tetap |
| Peserta | Donatur (anonim oke) | Pendaftar (butuh identitas) |
| Output | Sertifikat donasi (roadmap) | Sertifikat kehadiran (roadmap) |
| Akuntansi | Dana Titipan → Pendapatan manual | Langsung Pendapatan Event |

---

## Entitas Database

### 1. `event_categories` — Kategori event
```
id, name, slug, sort_order, created_at
```
CRUD inline oleh admin di `/event/kategori`.

### 2. `events` — Event utama
```
id, slug, title, description (Tiptap HTML)
category_id FK → event_categories
event_type: offline | online | hybrid
status: draft | published | cancelled | completed
starts_at, ends_at
location, location_detail  -- untuk offline/hybrid
maps_url                   -- Google Maps URL (opsional, offline/hybrid saja)
online_link                -- untuk online/hybrid
organizer_name             -- penyelenggara (bisa beda dari nama tenant)
max_capacity               -- null = tidak terbatas
show_attendee_list         -- tampilkan daftar peserta di halaman publik
show_ticket_count          -- tampilkan sisa kuota tiket
require_approval           -- pendaftaran perlu konfirmasi admin
show_donation_prompt       -- tampilkan prompt donasi setelah/selama pendaftaran (migration 0024)
linked_campaign_id FK → campaigns  -- campaign terkait untuk prompt donasi
custom_form_fields JSONB[]  -- field form dinamis (migration 0022, type/label/required/options)
show_attendee_stats BOOLEAN -- tampilkan tab Peserta & Statistik (migration 0023)
attendee_stats_by JSONB[]   -- breakdown: ["angkatan","kabupaten","provinsi","profesi"]
cover_id FK → media
certificate_template_id    -- roadmap: FK ke letter_templates
11 kolom SEO (sama dengan posts/campaigns)
created_by FK → officers, created_at, updated_at
```

### 3. `event_tickets` — Jenis tiket per event
```
id, event_id FK → events (CASCADE DELETE)
name, description
price NUMERIC (0 = gratis)
quota INTEGER (null = tidak terbatas)
sort_order
is_active BOOLEAN
requires_membership BOOLEAN  -- tiket hanya untuk anggota terdaftar cabang (migration 0020)
sale_starts_at, sale_ends_at  -- periode penjualan
created_at
```

### 4. `event_registrations` — Pendaftaran peserta
```
id, registration_number TEXT UNIQUE  -- EVT-YYYYMM-NNNNN
event_id FK → events (CASCADE DELETE)
ticket_id FK → event_tickets
member_id FK → public.members (nullable — publik tanpa akun)
attendee_name, attendee_phone, attendee_email
custom_fields JSONB  -- jawaban field dinamis (migration 0022, key=labelToKey(label), value=user input)
status: pending | confirmed | cancelled | attended
checked_in_at, checked_in_by  -- check-in hari-H
certificate_url, certificate_sent_at  -- roadmap
created_at, updated_at
```

### 5. `event_registration_sequences` — Counter nomor EVT
```
id, year, month, counter
UNIQUE (year, month)
```

---

## Alur Pembayaran Tiket

### Alur Baru — Invoice Universal (alur aktif saat ini)

```
Tiket gratis (price=0):
  → Daftar → status langsung "confirmed" (atau "pending" jika require_approval=true)
  → Tidak ada payments record

Tiket berbayar (alur publik via cart):
  → Daftar → INSERT event_registrations (status="pending")
  → INSERT invoices (source_type='event_registration', source_id=reg.id)
  → User upload bukti bayar → INSERT payments (source_type='invoice', source_id=invoice.id, status='submitted')
  → invoice.status → 'waiting_verification'
  → Admin konfirmasi → confirmEventInvoicePaymentAction(slug, paymentId)
    → payments.status → 'paid'
    → invoices.status → 'paid' / 'partial'
    → recordIncome()
    → registration.status → 'confirmed'
```

### Alur Lama — Direct Payment (legacy, masih ada data historis)

```
Tiket berbayar (alur lama):
  → INSERT payments (source_type='event_registration', source_id=registration.id)
  → Admin konfirmasi → confirmRegistrationPaymentAction(slug, paymentId)
  → payments.status → 'paid' → registration.status → 'confirmed'
```

**Dua alur ada secara bersamaan di admin detail event.** `EventRegistrationList` mendeteksi alur:
- Invoice flow: `invoiceStatus === 'waiting_verification'` → tombol `confirmEventInvoicePaymentAction`
- Legacy flow: `paymentStatus === 'submitted' && !isWaiting` → tombol `confirmRegistrationPaymentAction`

**Akuntansi tiket berbayar:**
- Berbeda dengan donasi yang memakai Dana Titipan (2200)
- Event: langsung ke Pendapatan Event (4xxx) saat dikonfirmasi admin
- Alasan: tiket adalah layanan yang sudah "dikonsumsi" saat event berlangsung

---

## Nomor Pendaftaran

Format: `EVT-YYYYMM-NNNNN`
Contoh: `EVT-202604-00001`

Generator: `generateRegistrationNumber(tenantDb)` — atomic SELECT FOR UPDATE via `event_registration_sequences`.

---

## Struktur Route

```
app/(dashboard)/[tenant]/event/
├── layout.tsx              → event shell: EventNav (sub-nav kiri) + slot konten kanan
├── page.tsx                → redirect ke /event/acara
├── acara/
│   ├── page.tsx            → list event: tabel + filter + search
│   ├── new/page.tsx        → form buat event baru (create-on-save)
│   └── [id]/
│       ├── page.tsx        → detail event: stats + list pendaftaran + konfirmasi
│       ├── edit/page.tsx   → full editor: EventForm (Tiptap + TicketManager + SeoPanel)
│       └── checkin/page.tsx → check-in hari-H (EventCheckinClient)
└── kategori/
    └── page.tsx            → CRUD inline kategori event

app/(public)/[tenant]/event/[slug]/page.tsx  → halaman publik event + form pendaftaran

app/api/events/[id]/certificate/[regId]/route.ts  → POST: generate PDF sertifikat
```

---

## Server Actions (event/actions.ts)

```typescript
// Event
createEventAction(slug, data: EventData)               → buat event + tiket awal
updateEventAction(slug, eventId, data: EventData)      → update event + sync tiket (diff)
deleteEventAction(slug, eventId)                       → guard: no registrations, delete tiket dulu

// Kategori
createEventCategoryAction(slug, { name, slug })
updateEventCategoryAction(slug, categoryId, { name, slug })
deleteEventCategoryAction(slug, categoryId)            → guard: no events in category

// Registrasi (PUBLIC — tanpa auth)
registerForEventAction(slug, data: RegisterData)              → insert registration + payment (jika berbayar)

// Registrasi admin
confirmRegistrationPaymentAction(slug, paymentId)             → konfirmasi bayar LEGACY (payment.sourceType='event_registration')
confirmEventInvoicePaymentAction(slug, paymentId)             → konfirmasi bayar BARU (payment.sourceType='invoice') — butuh permission "event"
approveRegistrationAction(slug, registrationId)               → setujui pending (requireApproval)
cancelRegistrationAction(slug, registrationId)                → batalkan + cancel payment jika belum bayar
checkInRegistrationAction(slug, registrationId)               → status → attended + checkedInAt
```

---

## Komponen

```
components/event/
├── event-nav.tsx                    → sub-nav kiri: Acara, Kategori
├── event-form.tsx                   → full editor (Tiptap + TicketManager + SeoPanel + sidebar)
├── event-list-client.tsx            → CreateEventButton + EventTable (+ Eye link ke detail)
├── event-category-manage-client.tsx → inline CRUD kategori
├── event-register-form.tsx          → form publik: pilih tiket, data peserta, metode bayar, konfirmasi
├── event-registration-list.tsx      → admin: list pendaftar + konfirmasi bayar + setujui + batalkan + sertifikat
├── event-checkin-client.tsx         → check-in hari-H: search + tombol check-in + flash sukses
└── event-certificate-button.tsx     → generate + buka PDF sertifikat kehadiran
```

### EventForm Layout
```
[Header: ← Acara | StatusBadge | Batalkan | Simpan | Publikasikan]
[Main area]                     [Sidebar 288px]
  Judul                           Kategori (Combobox)
  Slug                            ──────
  ── Detail Event ──              Cover Image (MediaPicker)
  Jenis: pill (Offline/Online/
    Hybrid)
  Waktu Mulai + Selesai
  Lokasi (jika offline/hybrid)
  Alamat Lokasi
  Link Google Maps (opsional)
  Link Online (jika online/hybrid)
  Penyelenggara
  Kapasitas Maks
  ── Deskripsi ──
  TiptapEditor
  ── Pengaturan Tampilan ──
  showAttendeeList toggle
  showTicketCount toggle
  requireApproval toggle
  ── Tiket ──
  TicketManager (dynamic list):
    Per tiket: nama, toggle Gratis/
    Berbayar, input harga (disabled
    saat Gratis), kuota, aktif/
    nonaktif, periode jual,
    expand/collapse
  ── SEO ──
  SeoPanel (contentType="event")
```

### TicketManager
- Local state `tickets: TicketLocal[]` — setiap item punya `_key` (React key lokal), `_expanded` (UI toggle), dan `_isGratis` (toggle harga)
- Tiket baru: `id: null` → `createEventAction` INSERT baru; default `_expanded: true, _isGratis: true`
- Tiket lama: `id: string` → `updateEventAction` UPDATE existing; `_isGratis = price === 0` saat load
- Tiket dihapus: hilang dari array → `syncTickets` DELETE di DB (guard: no registrations)
- Diff logic di `syncTickets(tenantDb, eventId, tickets)` — helper di actions.ts

### Gratis / Berbayar Toggle
- `_isGratis: true` → price dikirim sebagai `0`, tidak ada payments record
- `_isGratis: false` → price input aktif, validasi `price >= 1`
- Input harga **selalu tampil** (disabled jika Gratis) — tidak disembunyikan saat Gratis dipilih. Alasan: jika disembunyikan, user tidak tahu di mana mengisi harga setelah toggle ke Berbayar
- Field `_isGratis`, `_key`, `_expanded` di-strip di `buildData()` — tidak dikirim ke server

### EventRegistrationList — Filter per Tiket + Export per Tiket (2026-09-08)

> Status: **SELESAI.** Ditulis di sini sebelum eksekusi sesuai disiplin `CLAUDE.md` § "Cara Claude
> Harus Bekerja" poin 7 — bukan RENCANA ditunda, langsung dieksekusi sesi yang sama.

**Masalah:** Sebelumnya `EventRegistrationList` di halaman admin `acara/[id]` cuma satu tabel
gabungan semua tiket + satu search box. Kalau event punya >1 jenis tiket (mis. tiket reuni Batch
1 & Batch 2), admin tidak bisa lihat peserta per jenis tiket secara terpisah, dan dua tombol
export ("Export ke Excel" = hanya confirmed/attended, "Export Semua Peserta" = semua status)
selalu men-download SEMUA tiket sekaligus — tidak ada cara export per tiket tanpa filter manual
di Excel setelahnya.

**Desain:**
1. **`RegistrationRow`** (`event-registration-list.tsx`) — tambah field `ticketId: string | null`
   (sebelumnya cuma ada `ticketName` string, tidak cukup untuk filter yang akurat — dua tiket
   idealnya tidak boleh sama nama tapi lebih aman filter by ID). Di-populate di
   `acara/[id]/page.tsx` dari `r.ticketId` (registrasi asli) dan `c.ticketId` (baris virtual
   "checkout belum lunas" dari `getPendingTicketCheckouts`).
2. **Tab/pill filter tiket** — di atas search box, computed dari prop baru `tickets: {id, name}[]`
   (dikirim server, urutan ikut `sort_order`, TERMASUK tiket yang belum punya pendaftar sama
   sekali — supaya admin tetap lihat tab-nya walau kosong). Tab "Semua" selalu ada di depan.
   Setiap tab tampilkan jumlah baris (badge angka) — dihitung client-side dari `rows`, bukan
   query server terpisah. Tab hanya dirender kalau `tickets.length > 1` (event 1 tiket tidak
   perlu filter — konsisten dengan pola `tickets.length > 1` yang sama di `EventRegisterForm`
   publik).
3. **Filter gabungan** — `ticketFilter` (state baru) DAN `search` (sudah ada) jalan bersamaan,
   bukan saling menggantikan (AND, bukan OR).
4. **Export ikut tab aktif** — tombol "Export ke Excel" / "Export Semua Peserta" DIPINDAH dari
   server component (`acara/[id]/page.tsx`) ke dalam `EventRegistrationList` (client), supaya
   href-nya bisa baca `ticketFilter` yang sedang aktif dan menambahkan `&ticketId={id}` ke query
   string saat tab bukan "Semua". Tab "Semua" tidak mengirim `ticketId` sama sekali — perilaku
   lama (export semua tiket) tetap identik, tidak ada breaking change buat event 1 tiket.
5. **API `/api/events/[id]/export-participants`** — tambah query param opsional `ticketId`.
   Kalau ada: filter `event_registrations` dengan `eq(ticketId, ...)` DAN filter
   `pendingCheckouts` (mode `all=1`) dengan `c.ticketId === ticketId` (helper
   `getPendingTicketCheckouts` sendiri tidak diubah — filter dilakukan setelah hasilnya diambil,
   helper itu dipakai bersama tempat lain jadi tidak boleh diberi parameter baru yang spesifik
   kasus ini). Nama file export ikut tersisip nama tiket (slug) saat difilter, supaya admin tidak
   tertukar file mana untuk tiket mana.

**File yang diubah:** `components/event/event-registration-list.tsx`,
`event/acara/[id]/page.tsx`, `api/events/[id]/export-participants/route.ts`.

**Fix susulan (2026-09-08) — error export tampil sebagai JSON mentah:** Tombol export
sebelumnya `<a href>` langsung ke API route — kalau API balas error (mis. peserta kosong untuk
tiket yang dipilih), browser navigasi ke halaman JSON mentah (`{"error": "..."}`), pengalaman
jelek. Diubah jadi `fetch()` dari client: response OK → trigger download manual dari blob
(`URL.createObjectURL` + `<a download>` sintetis, nama file dari header `Content-Disposition`);
response error → parse JSON, tampilkan `toast.error()` (sonner, sudah global di `app/layout.tsx`)
alih-alih navigasi. Tidak perlu ubah kontrak response API route sama sekali — cukup ubah cara
client mengonsumsinya.

---

## Status Event

```
draft → published → completed
draft → published → cancelled
cancelled/completed → draft (reopen)
```

| Status | Aksi Tersedia |
|--------|--------------|
| `draft` | "Simpan Draft" + "Publikasikan" |
| `published` | "Simpan Perubahan" + "Selesaikan" + "Batalkan" |
| `cancelled` / `completed` | "Jadikan Draft" |

---

## SEO

- `contentType="event"` di SeoPanel
- Schema options: `["Event", "WebPage"]` (dari `SCHEMA_ORG_TYPES.event`)
- Default `schemaType: "Event"` (berbeda dari campaign yang default "WebPage")
- Semua 11 kolom SEO identik dengan posts/campaigns

---

## Sidebar Navigation

Event masuk ke sidebar utama setelah Donasi:
```
...
Donasi     → /donasi
Event      → /event      ← CalendarDays icon
Toko       → /toko
...
```

---

## Implementasi yang Sudah Selesai

- [x] **Step 1 — Schema**: 5 tabel baru, enums, index, DDL, ALTER TABLE tenant existing
- [x] **Step 2 — UI + Actions**: EventForm, TicketManager, EventNav, list, CRUD kategori, sidebar
- [x] **Step 3 — Halaman Publik**: `/(public)/[tenant]/agenda/[slug]` — EventRegisterForm: pilih tiket, isi data peserta, pilih metode bayar, konfirmasi
- [x] **Step 4 — Pendaftaran Admin**: `event/acara/[id]` — stats, list pendaftaran, konfirmasi pembayaran (dua alur), setujui, batalkan
- [x] **Step 5 — Check-in**: `event/acara/[id]/checkin` — EventCheckinClient: search real-time, satu tombol check-in, flash konfirmasi
- [x] **Step 6 — Sertifikat PDF**: `POST /api/events/[id]/certificate/[regId]` — HTML landscape A4, upload MinIO, EventCertificateButton di list pendaftaran
- [x] **Mig 0020 — Tiket Wajib Anggota**: `requires_membership` per tiket + Opsi A (tampil, bukan blokir) + guard dua lapis (client + server)
- [x] **Mig 0022 — Dynamic Custom Form Fields**: `custom_form_fields JSONB[]` di events + `custom_fields JSONB` di registrations + CustomFieldBuilder di EventForm + render dinamis di EventRegisterForm
- [x] **Mig 0023 — Tab Peserta & Statistik**: `show_attendee_stats + attendee_stats_by` di events + EventDetailTabs (tab Detail/Peserta/Statistik) di halaman publik
- [x] **Step E7 — Donation Prompt Schema**: `show_donation_prompt + linked_campaign_id` di events + UI di EventForm — migration 0024 untuk tenant existing
- [x] **Step E8 — EventCard + EventsSection**: 3 variant (grid/list/ringkas) + 3 design (Grid/Utama/Agenda) di `components/website/public/event-cards/` + `sections/events/`
- [x] **Step E9 — Halaman Arsip + Detail Publik**: `/(public)/[tenant]/agenda/page.tsx` + `/(public)/[tenant]/agenda/[slug]/page.tsx`

---

## Front-end Publik — Step 7–10 (SELESAI)

> **Status**: Step E7–E10 sudah diimplementasikan semua.

---

### Keputusan Arsitektur yang Dikunci

**1. URL public event = `/agenda`** (bukan `/event` — konflik dengan dashboard admin)
```
/{slug}/agenda              → arsip semua event mendatang
/{slug}/agenda/{slug}       → detail event + form registrasi
                              (pindah dari /event/{slug} yang sudah ada)
nav-menu.ts case "event" → update ke /{slug}/agenda
```

**2. Alur registrasi: tetap direct (bukan cart)**
- Event gratis: form → confirmed → donation prompt (jika admin aktifkan)
- Event berbayar: pilih tiket → add ke cart → di keranjang: donation prompt → checkout
- Alasan: data peserta (nama, HP, email) per tiket tidak fit di cart model

**3. Donation Prompt — Opsi B (di keranjang)**
Prompt donasi tampil di halaman `/keranjang` saat ada tiket event yang punya `linked_campaign_id`.
Bukan di event detail page — agar tidak mengejutkan user yang baru saja add ke cart.

**4. EventCard + EventsSection menggantikan placeholder di landing-template**
`EventsSection` di `landing-template.tsx` saat ini adalah komponen inline sederhana.
Diganti dengan sistem Card+Section yang proper (3 variant, 3 design) sesuai arsitektur universal.

---

### Step 7 — Schema Tambahan

**Dua kolom baru di `events`:**

```sql
-- Drizzle schema (createEventsTable)
showDonationPrompt: boolean("show_donation_prompt").notNull().default(false),
linkedCampaignId:   uuid("linked_campaign_id"),  -- FK → campaigns.id via DDL

-- DDL (create-tenant-schema.ts)
ALTER TABLE "{s}".events
  ADD COLUMN IF NOT EXISTS show_donation_prompt BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS linked_campaign_id   UUID REFERENCES "{s}".campaigns(id) ON DELETE SET NULL;
```

**EventForm — tambah section "Donasi Terkait":**
```
┌─────────────────────────────────────────────────┐
│  Prompt Donasi (opsional)                       │
│  [ ] Tampilkan prompt donasi setelah pendaftaran│
│                                                 │
│  Campaign:                                      │
│  [Pilih campaign aktif ▼]  ← combobox           │
│  Nominal dari setting donasi tenant             │
└─────────────────────────────────────────────────┘
```

Muncul di sidebar EventForm, setelah section Pengaturan Tampilan.
Combobox berisi semua campaign `status=active` — tidak filter tipe (donasi/zakat/wakaf/qurban bebas).

---

### Step 8 — EventCard + EventsSection (Card+Section System)

#### EventCardData

```typescript
// lib/event-card-templates.ts (file baru)
export type EventCardData = {
  id:           string;
  title:        string;
  slug:         string;
  description:  string | null;
  eventType:    "offline" | "online" | "hybrid";
  coverUrl:     string | null;
  coverVariants?: Record<string, string> | null;
  categoryName: string | null;
  startsAt:     string | null;   // ISO string
  endsAt:       string | null;
  location:     string | null;
  lowestPrice:  string | null;   // null = gratis; MIN(price) dari tiket aktif
  status:       "published" | "completed";
};

export const EVENT_CARD_VARIANTS = ["grid", "list", "ringkas"] as const;
```

#### Card Variants

| Variant | Deskripsi | Dipakai di |
|---------|-----------|------------|
| `grid` | Cover + badge tanggal + judul + lokasi + harga/gratis | Design 1, Design 2 (kecil) |
| `list` | Horizontal: tanggal besar di kiri + judul + info | Design 3 (Agenda) |
| `ringkas` | Cover + tanggal + judul saja | Design 2 (featured besar) |

**Badge tanggal** menjadi elemen visual kunci EventCard — merah/primary, menonjol.

#### Section Designs

```typescript
// lib/events-section-designs.ts (file baru)
export type EventsSectionData = {
  title:        string;
  count:        number;          // default 6
  categoryId:   string | null;
  upcomingOnly: boolean;         // default true
};

// Design 1 — Grid Event: 3 kolom event-card-grid, badge tanggal menonjol
// Design 2 — Event Utama: 1 featured besar + list 3 event lain (event-card-list)
// Design 3 — Agenda: event-card-list vertikal, tanggal di kolom kiri sebagai aksen
```

#### Integrasi Landing Page

Replace `EventsSection` placeholder di `landing-template.tsx`:
```typescript
// Sebelum: inline EventsSection lokal di landing-template.tsx
// Sesudah: import EventsSection dari sections/events/events-section.tsx

import { EventsSection } from "@/components/website/public/sections/events/events-section";

case "events": return (
  <EventsSection
    data={section.data as EventsSectionData}
    variant={(section.variant ?? "1") as EventsSectionDesignId}
    tenantClient={tenantClient}
    tenantSlug={tenantSlug}
  />
);
```

**Update section-editors.tsx** — ganti EventsEditor yang sederhana dengan editor yang support `categoryId` + `upcomingOnly` toggle.

---

### Step 9 — Halaman Arsip `/{slug}/agenda`

```
app/(public)/[tenant]/agenda/
├── page.tsx              → arsip event mendatang
└── [slug]/
    └── page.tsx          → pindah dari /event/[slug] (atau redirect)
```

**Archive page** (`/agenda`):
- Filter kategori (chips horizontal)
- Toggle: "Mendatang" vs "Semua"
- Grid 3 kolom EventCard grid
- Tidak ada pagination — event biasanya sedikit (max 20)

**Detail page** (`/agenda/{slug}`):
- Pindah konten dari `/(public)/[tenant]/event/[slug]`
- Halaman lama `/event/{slug}` → redirect 301 ke `/agenda/{slug}` (backward compat)
- Form registrasi tetap sama (EventRegisterForm)

**Setelah registrasi berhasil (gratis):**
- Jika `event.show_donation_prompt = true` → tampilkan DonationPromptModal
- Modal berisi info campaign + nominal chips (dari `settings.donation_config.recommended_amounts`)
- "Ya, Donasi" → addToCartAction → redirect ke `/keranjang`
- "Tidak" → tampilkan halaman konfirmasi biasa

---

### Step 10 — Donation Prompt di Keranjang

**Untuk event berbayar** dengan `show_donation_prompt = true`:

Halaman `/keranjang` sudah ada. Tambah logika:
1. Saat render keranjang, fetch events dari ticket `itemId`-nya untuk cek `show_donation_prompt + linked_campaign_id`
2. Jika ada tiket event yang linked campaign-nya belum ada di cart → tampilkan banner:

```
┌──────────────────────────────────────────────────────────┐
│  💚  Dukung kampanye "Beasiswa IKPM Gontor"              │
│  Yuk, tambahkan donasi sekalian untuk event ini!         │
│                                                          │
│  [Rp 10K] [Rp 25K] [Rp 50K] [Nominal lain...]          │
│                                              [Tambahkan] │
└──────────────────────────────────────────────────────────┘
```

3. Klik "Tambahkan" → `addToCartAction(itemType:"donation", itemId:campaign.id)` → banner hilang → checkout bersama

**Catatan**: Banner hanya tampil sekali per session (atau sampai donasi ditambahkan). Jika user sudah add donasi dari campaign yang sama → banner tidak tampil.

---

### Urutan Implementasi

```
Step E7: Schema
  - Tambah show_donation_prompt + linked_campaign_id ke events (Drizzle + DDL)
  - Update EventForm: toggle + campaign combobox
  - Migration tenant existing

Step E8: EventCard + EventsSection
  - lib/event-card-templates.ts
  - lib/events-section-designs.ts
  - EventCard 3 variant (grid/list/ringkas)
  - EventsSection 3 design (Grid/Utama/Agenda)
  - Replace placeholder di landing-template.tsx
  - Update section-editors.tsx

Step E9: Halaman Arsip + Detail
  - app/(public)/[tenant]/agenda/page.tsx — arsip
  - app/(public)/[tenant]/agenda/[slug]/page.tsx — detail (pindah dari /event/[slug])
  - Redirect /event/{slug} → /agenda/{slug}
  - nav-menu.ts update: "event" → /agenda

Step E10: Donation Prompt — ✅ SELESAI
  - DonationPromptModal: tampil setelah registerForEventAction sukses (alur lama, no linked items)
  - DonationBannerCart: tampil di /keranjang, support campaign + linkedProduct (mig 0024+0025)
  - addEventTicketToCartAction: alur baru (event dengan linked_campaign_id/linked_product_id)
  - Routing kondisional: hasLinkedItems → cart flow; tidak ada → registerForEventAction
  - linkedProductId (mig 0025): satu invoice untuk tiket + donasi + produk sekaligus
  - Catatan: event_registrations dari cart_items.notes belum dibuat otomatis saat konfirmasi invoice
```

---

### Status Implementasi

| Fitur | Status |
|-------|--------|
| Schema + admin UI (Step 1–6) | ✅ Done |
| Tiket Wajib Anggota (mig 0020) | ✅ Done |
| Dynamic Custom Form Fields (mig 0022) | ✅ Done |
| Tab Peserta & Statistik (mig 0023) | ✅ Done |
| **Step E7** — Schema show_donation_prompt + linked_campaign_id (mig 0024) | ✅ Done |
| **Step E8** — EventCard + EventsSection (3 variant + 3 design) | ✅ Done |
| **Step E9** — Archive `/agenda` + Detail `/agenda/{slug}` | ✅ Done |
| **Step E10** — Donation Prompt UI (post-register + keranjang) | ✅ Done |
| linked_product_id (mig 0025) — satu invoice ticket+campaign+produk | ✅ Done |
| event_registrations dari cart_items saat konfirmasi invoice | 🔲 Belum (Phase berikutnya) |

---

## Lessons Learned

### TicketManager: diff tidak delete-all
Sync tiket pakai diff (delete yang hilang, update yang ada, insert baru) — tidak delete-all + insert-all.
Alasan: tiket yang sudah ada pendaftaran tidak boleh dihapus. Guard via `count(event_registrations WHERE ticket_id IN toDeleteIds)`.

### Public action tanpa auth
`registerForEventAction` tidak punya `getTenantAccess()` guard — siapapun bisa mendaftar event. Validasi tetap dilakukan: cek event published, tiket aktif + periode jual, kuota.

### ticketId nullable di registrations
Kolom `ticket_id` di `event_registrations` dideklarasikan tanpa `notNull()` → tipe TypeScript `string | null`. Selalu guard dengan `r.ticketId ?? ""` sebelum pakai sebagai Map key atau argumen `eq()`.

### Ticket gratis vs berbayar
`price = 0` = gratis → tidak perlu payments record. Cukup insert registration dengan status "confirmed" langsung.
Validasi dilakukan di halaman publik (Step 3), bukan di EventForm admin.

### Input conditional: selalu tampil, disabled bukan hidden
Untuk input yang bergantung pada toggle (Gratis/Berbayar), jangan sembunyikan input saat kondisi off —
tampilkan tapi disable. User tidak tahu di mana mengisi nilai jika inputnya tidak kelihatan sama sekali.
Pattern yang salah: `{!isGratis && <Input ... />}` → user bingung.
Pattern yang benar: `<Input disabled={isGratis} placeholder={isGratis ? "0 (Gratis)" : "Masukkan harga"} />`
Berlaku untuk semua input conditional di seluruh aplikasi.

### payments.source_type
Drizzle enum `PAYMENT_SOURCE_TYPES` DAN DDL CHECK constraint di `create-tenant-schema.ts` harus diperbarui bersamaan saat menambah source_type baru. Jika hanya update salah satu → runtime error saat insert.

### Default tiket terpilih harus skip tiket yang terkunci (fix 2026-09-08)
**Masalah:** Saat event punya >1 jenis tiket dan salah satunya terkunci (sale window berakhir,
kuota habis, dll), banner ringkasan di bawah daftar tiket ("Penjualan tiket ini telah berakhir
pada ...") tetap muncul walau tiket LAIN masih aktif dan bisa dibeli. User mengira seluruh
penjualan event sudah tutup padahal cuma satu jenis tiket yang tutup.
**Root cause:** `selectedTicketId` di `EventRegisterForm` di-default ke `tickets[0]?.id` — tiket
pertama menurut `sort_order`, tanpa cek status lock-nya. Kartu tiket yang terkunci dirender
sebagai `<div>` (bukan `<button>`), jadi user tidak bisa mengklik untuk memindah pilihan —
banner salah ini nempel terus kalau tiket pertama dalam urutan kebetulan yang terkunci.
**Fix:** Default `selectedTicketId` diubah supaya memilih tiket pertama yang TIDAK terkunci
(kalau ada), baru fallback ke `tickets[0]` kalau semua tiket memang terkunci. Efeknya: banner
ringkasan sekarang betul-betul hanya muncul kalau **seluruh** tiket event terkunci — persis
model mental yang diharapkan ("penjualan berakhir" = tidak ada satupun tiket yang bisa dibeli).
**Pencegahan:** Kalau ada state "terpilih secara default" dari sebuah list yang punya elemen
ter-disable, jangan default ke index pertama secara buta — cari elemen valid/available pertama
dulu. Pola ini berpotensi berulang di list-picker lain (produk variasi, dsb) — cek kalau
menambah fitur serupa.

**Fix susulan — alasan terkunci campuran (2026-09-08, SUPERSEDED beberapa jam kemudian, lihat
entry di bawah):** Fix di atas cuma menutup KEBANYAKAN kasus — kalau **SEMUA** tiket event
kebetulan terkunci untuk viewer tertentu (mis. tiket A sale sudah berakhir, tiket B butuh
keanggotaan dan viewer belum jadi anggota), `selectedTicketId` fallback ke `tickets[0]`, dan
banner ringkasan menampilkan pesan SPESIFIK tiket pertama itu ("Penjualan tiket ini telah
berakhir...") — padahal alasan tiket lain berbeda sama sekali. Percobaan fix saat itu: ganti
jadi pesan generik "Semua tiket untuk event ini sedang tidak tersedia untuk Anda saat ini..."
kalau alasannya campuran. **User menolak pendekatan ini** (lihat entry "Banner ringkasan
dihapus total" di bawah) — pesan generik itu sendiri dianggap bikin calon pendaftar takut
padahal salah satu tiket sebenarnya masih bisa didaftar (cuma perlu lengkapi keanggotaan dulu,
bukan dead-end). **Jangan coba pendekatan "pesan generik saat alasan campuran" ini lagi** —
sudah dicoba dan ditolak, bukan sekadar belum terpikirkan.

### Banner ringkasan tiket terkunci dihapus total (2026-09-08)
**Masalah dengan DUA percobaan fix sebelumnya** (default-selection + pesan generik di atas):
keduanya masih mempertahankan konsep "banner ringkasan" di bawah daftar tiket untuk kondisi
"tiket terpilih terkunci". User keberatan pada prinsipnya, bukan cuma redaksi katanya — alasan:
1. **Kalau masih ada tiket yang bisa dijual/didaftar, TIDAK PERLU notifikasi apapun** di luar
   status masing-masing kartu tiket. Ini sudah otomatis benar sejak fix pertama (banner cuma
   tampil kalau tiket TERPILIH terkunci, dan default-selection sudah skip ke tiket yang tidak
   terkunci kalau ada) — tapi user menegaskan ini sebagai prinsip yang tidak boleh dilanggar ke
   depannya, bukan cuma kebetulan sudah benar.
2. **Kartu tiket individual sudah cukup sebagai "notifikasi"** — badge ("Anggota", "Tidak
   Tersedia") + link CTA per kartu (mis. `<a href="/akun/lengkapi">Lengkapi Keanggotaan →</a>`,
   sudah ada jauh sebelum sesi ini, tidak pernah diubah) sudah menjelaskan situasi per tiket.
   Banner ringkasan tambahan di bawahnya redundan DAN — untuk tiket yang cuma butuh lengkapi
   keanggotaan (bukan benar-benar tutup) — menyesatkan ke arah sebaliknya: bikin situasi yang
   sebenarnya masih bisa ditindaklanjuti (`isipun keanggotaan → tiket kebuka`) terlihat seperti
   dead-end "semua tidak tersedia".

**Fix final:** Hapus SELURUH banner ringkasan (`{selectedTicketLocked && tickets.length > 1 &&
(...)}`) beserta variable pendukungnya (`allTicketLocks`, `allTicketsLocked`, `mixedLockReasons`,
`summaryLockMessage`). `selectedTicketLocked` tetap dipertahankan HANYA untuk gate section
form+submit di bawahnya (`{!selectedTicketLocked && (<>...form...</>)}`) — kalau tiket yang
terpilih terkunci, form peserta memang tidak boleh tampil, itu bukan "notifikasi", itu mencegah
submit ke tiket yang tidak valid. Yang TIDAK diubah sama sekali: pesan+badge per kartu tiket
individual (baris terkunci maupun tidak) — itu sudah benar sejak awal dan tidak pernah jadi
masalah, keluhan user selalu soal banner ringkasan tambahan di bawahnya, bukan info per kartu.
**Pencegahan:** Kalau ke depan ada dorongan menambah "ringkasan gabungan" dari status per-item
sebuah list (di modul manapun) — pertimbangkan dulu apakah info per-item saja sudah cukup
sebelum menambah lapisan ringkasan baru. Lapisan ringkasan gampang jadi kurang presisi
dibanding info per-item aslinya begitu ada campuran kondisi (persis kasus ini, dua kali).

### Kartu tiket tersedia dibuat lebih menonjol (2026-09-08)
Sebelumnya kartu tiket terpilih hanya diberi `border-primary bg-primary/5` (tint tipis 5%) —
kurang kontras dibanding kartu terkunci yang berwarna solid abu-abu, jadi tiket yang justru
BISA dibeli malah kurang menonjol secara visual. Diubah jadi solid `bg-primary
text-primary-foreground` (bukan hardcode `text-white` — projek ini multi-tenant, warna primary
ikut setting `/settings/display` per tenant, jadi teks kontrasnya wajib ikut token
`--primary-foreground`, bukan warna tetap).

---

## Registry Desain Kartu Arsip (Grid Desktop / List Mobile)

> **Status: SELESAI — diimplementasikan 2026-07-17.** Mengikuti pola yang sudah selesai dibangun
> untuk modul Donasi (`docs/arsitektur-donasi.md` § 14j–14m — bentuk final, § 14j dan § 14l di
> sana adalah draft yang sudah superseded, jangan diikuti). **Migration
> `packages/db/migrations/0031_settings_group_event.sql` wajib dijalankan di VPS sebelum deploy**
> — menambah `'event'` ke CHECK constraint `settings.group` (grup baru, belum pernah dipakai
> modul Event sebelumnya, beda dari Donasi/Toko yang grupnya sudah ada duluan).

**Latar belakang**: `EventCard` (`components/website/public/event-cards/event-card.tsx`) sudah
punya 3 variant layout — `grid` | `list` | `ringkas` (`lib/event-card-templates.ts`). Halaman
arsip `/agenda` hardcode `variant="grid"` (baris ~181), tanpa cara mengubahnya, dan grid
`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` di layar sempit sama kurang nyamannya seperti yang
sudah dialami di modul Donasi sebelum diperbaiki.

**Keputusan yang dibawa dari § 14m Donasi (bukan didesain ulang)**:
- Setting **tetap ada** di halaman pengaturan modul — bukan dihapus, bukan hardcode tunggal.
- Setting berbentuk **registry bernomor** ("Desain 1", nanti "Desain 2" dst), pola sama
  Header/Footer/Hero/Strip Modul/Campaign — BUKAN pilihan Grid/List/Ringkas langsung ke admin.
- **Aturan wajib untuk SETIAP desain di registry ini, sekarang dan nanti**: grid di desktop
  (`md:` ke atas), list di mobile (di bawah `md:`) — baseline konstrain, bukan pilihan per-desain.
- Dua blok markup (grid desktop + list mobile) di-render SEKALIGUS di server via CSS breakpoint
  (`hidden md:grid` + `md:hidden`) — bukan JS/`window.innerWidth`, SSR-safe, tanpa `"use client"`.

**Gap infrastruktur yang perlu ditutup dulu (beda dari Donasi)**: grup setting `"event"` **belum
ada** di `SETTING_GROUPS` (`packages/db/src/schema/tenant/settings.ts`) — Donasi sudah punya grup
`"donasi"` sejak awal jadi tidak perlu migration DDL, tapi Event perlu:
1. Tambah `"event"` ke `SETTING_GROUPS` const.
2. Update DDL CHECK constraint string di `create-tenant-schema.ts` (untuk tenant baru).
3. Migration SQL baru (`packages/db/migrations/003X_settings_group_event.sql`) — `DO $$ LOOP`
   semua tenant aktif, `ALTER TABLE ... DROP CONSTRAINT settings_group_check, ADD CONSTRAINT
   settings_group_check CHECK ("group" IN (...))` termasuk `'event'` — pola sama migration
   `0020_event_ticket_requires_membership.sql` (loop per-tenant via `public.tenants WHERE
   is_active = true`). **Wajib dijalankan di VPS sebelum deploy kode** yang menulis ke grup ini.

**File yang akan dibuat**:
```
lib/event-archive-card-designs.ts                                    → registry (pola campaign-archive-card-designs.ts)
components/website/public/event-cards/event-archive-cards-design-1.tsx → Desain 1: grid desktop/list mobile
components/website/public/event-cards/event-archive-cards.tsx        → dispatcher
app/(dashboard)/app/[tenant]/event/pengaturan/page.tsx                → halaman baru, belum ada sama sekali
app/(dashboard)/app/[tenant]/event/pengaturan/actions.ts              → saveEventArchiveDesignAction
components/event/event-archive-design-form.tsx                       → picker client component
```

**File yang akan diubah**:
```
packages/db/src/schema/tenant/settings.ts        → SETTING_GROUPS += "event"
packages/db/src/helpers/create-tenant-schema.ts  → CHECK constraint string += 'event'
components/event/event-nav.tsx                   → tambah item nav "Pengaturan"
app/(public)/[tenant]/agenda/page.tsx             → baca setting, dispatch via EventArchiveCards
```

**Setting** — group `event` (baru), key `event_archive_design`:
```json
key   = "event_archive_design"
group = "event"
value = { "design": "1" }
```

**Titik sentuh publik — hanya 1** (beda dari Donasi yang punya 2, dan Produk yang punya 3):
Event tidak punya halaman "kategori" terpisah dengan URL sendiri (filter kategori di `/agenda`
pakai query param `?category=`, bukan sub-route), dan tidak punya section "Event Lainnya" di
halaman detail `/agenda/{slug}` (dicek: grep `EventCard`/`Lainnya`/`Terkait` di file itu nihil).
Jadi cuma `/agenda/page.tsx` yang perlu diubah.

**Urutan implementasi**:
```
Step EV1: Migration DB — tambah "event" ke SETTING_GROUPS + DDL + migration SQL, jalankan di VPS
Step EV2: Registry + dispatcher + Desain 1 (copy pola campaign-archive-cards-design-1.tsx,
          ganti CampaignCard→EventCard, sesuaikan jumlah kolom grid jika perlu)
Step EV3: event/pengaturan/ (page + actions + nav item baru "Pengaturan" di event-nav.tsx)
Step EV4: agenda/page.tsx — baca setting, ganti hardcode variant="grid" jadi EventArchiveCards
Step EV5: tsc --noEmit + build, verifikasi 0 error sebelum lanjut ke modul Produk
```

**Realisasi**: rencana di atas diikuti tanpa deviasi. Kolom grid dipertahankan 3 (sama dengan
grid existing `/agenda` sebelumnya) — tidak perlu disesuaikan. `hasFullAccess(access.tenantUser,
"event")` dipakai untuk guard `saveEventArchiveDesignAction` (bukan `canManageUsers`, konsisten
dengan pola Donasi — setting tampilan bukan setting sensitif finansial). Migration 0031 **belum
dijalankan di VPS** — jalankan sebelum deploy build ini.

### Coupling ke Landing Section "Grid Event" (§ menyusul Desain Kartu Arsip Donasi § 14o)

> **Status: SELESAI — diimplementasikan 2026-07-17.** Menerapkan prinsip yang dikunci di
> `docs/arsitektur-donasi.md` § 14o: setting "Desain Kartu Arsip" adalah satu sumber kebenaran,
> section landing "Grid X" WAJIB otomatis ikut, bukan pilihan terpisah.

`EventsDesign1` ("Grid Event", landing section) sekarang terima prop `cardDesign` — di-fetch oleh
`EventsSection` dari setting `event_archive_design` yang sama dipakai `/agenda`. Karena registry
arsip Event baru punya **1 desain** ("Klasik"), dispatch di `EventsDesign1` untuk saat ini selalu
jatuh ke `default` (perilaku identik sebelum perubahan) — ini murni **plumbing untuk masa depan**:
begitu Desain 2 ditambah ke `lib/event-archive-card-designs.ts`, landing section otomatis ikut
tanpa kode tambahan, persis seperti yang terjadi di Campaign.

**Mobile TIDAK diubah** — dikonfirmasi eksplisit oleh user: `EventsDesign1` sudah pakai
`variant="list"` di bawah breakpoint `sm:` (bukan grid sempit) sejak awal, treatment ini sudah
dianggap benar dan dipertahankan apa adanya. Beda dari Campaign (landing = slider) dan Produk
(landing baru ditambah slider) — Event landing SENGAJA tetap list, bukan diseragamkan jadi
slider. Tiga modul boleh punya treatment mobile landing yang berbeda, tidak masalah.

**File yang diubah**: `lib/events-section-designs.ts` (`EventsSectionProps += cardDesign`),
`events-section.tsx` (fetch `event_archive_design`, pass `cardDesign`), `events-design-1.tsx`
(terima `cardDesign`, dispatch internal — untuk sekarang selalu 1 cabang).

**Drive-by fix di luar scope literal permintaan**: `EventsEditor` (`section-editors.tsx`) ternyata
punya bug pre-existing yang SAMA PERSIS dengan `CampaignsEditor` sebelum § 14n — tidak pernah
destructure `variant`/`onVariantChange`, jadi admin tidak pernah bisa memilih "Event Utama"/
"Agenda" dari UI, selalu terkunci ke Desain 1. Difix bersamaan (tambah blok "Design Layout"
picker, pola identik) karena secara langsung melayani tujuan "berlaku untuk semua card design" —
kalau tidak, admin tetap tidak bisa memanfaatkan registry 3-desain section Event yang sudah lama
ada.

### Timezone — Semua Input & Tampilan Jam Mengikuti Setting Tenant (SELESAI, 2026-07-19)

> Detail lengkap (root cause, desain helper, cakupan fix): `docs/lessons-learned.md` —
> ""Hari ini" via new Date().toISOString() selalu salah jam 00:00-06:59 WIB; state dari prop
> via useState tidak auto-sync setelah router.refresh()".

Bug kritis ditemukan: `EventForm` kirim string `datetime-local` mentah (tanpa offset) ke server
action, yang langsung `new Date(string)` — di server (biasanya UTC), ini bisa menggeser jam
event **7+ jam** dari yang dimaksud admin. Semua field waktu (`starts_at`, `ends_at`,
`sale_starts_at`, `sale_ends_at`) rawan bug ini.

**Fix**: input form dikonversi ke UTC ISO via `localDatetimeToUtcIso(value, tenantTimezone)`
SEBELUM dikirim ke server (di client, `EventForm.buildData()`) — diinterpretasikan sesuai
timezone yang di-setting tenant di `/settings/general` (WIB/WITA/WIT/UTC), BUKAN timezone
browser admin. Form edit prefill via `utcIsoToLocalDatetime()` kebalikannya. Semua tampilan
tanggal/jam event (kartu publik, detail admin, check-in, sertifikat, cron reminder) juga
diubah dari hardcode `"Asia/Jakarta"` jadi dinamis mengikuti setting tenant, di-thread sebagai
prop `timezone` dari server page ke seluruh rantai komponen (termasuk 5-lapis
`EventArchiveCards` → ... → `EventCard` → `EventCardGrid`).

Helper terpusat: `packages/db/src/helpers/tenant-timezone.ts` (re-export dari
`@/lib/tenant-timezone` di apps/web) — `getTenantTimezone`, `localDatetimeToUtcIso`,
`utcIsoToLocalDatetime`, `formatInTz`, `todayInTz`, `anchorTodayUtc`.

---

## RENCANA — Multi-Tiket per Transaksi (Quantity + Multi-Peserta)

> Status: **RENCANA, belum dieksekusi.** Dicatat dari investigasi 2026-09-07/08, dieksekusi
> nanti setelah instruksi eksplisit. Ditulis di sini DULU sebelum kode, sesuai disiplin
> `CLAUDE.md` § "Cara Claude Harus Bekerja" poin 7.

### Masalah Saat Ini (Root Cause)

Model data hari ini: **1 `event_registrations` = 1 orang = 1 tiket.** Tidak ada field quantity
di mana pun. Konsekuensinya, satu orang tidak bisa beli/daftarkan beberapa tiket sekaligus
dalam satu transaksi — tiga titik kode yang menegaskan ini:

1. **`addEventTicketToCartAction`** ([event/actions.ts:1006-1038](../apps/web/app/(dashboard)/app/[tenant]/event/actions.ts)) —
   `cart_items.quantity` di-hardcode `1`. Kalau tiket **jenis yang sama** sudah ada di cart lalu
   ditambahkan lagi, kode TIDAK membuat baris cart_item baru — ia menemukan item lama
   (`cartId + itemId`) dan **menimpa `notes`-nya** (data peserta lama hilang tertimpa peserta
   baru).
2. **`createEventRegistrationsFromInvoiceTickets`** (`lib/event-registration-sync.server.ts`) —
   membuat persis **1 baris registrasi per `invoice_items` bertipe "ticket"**, tidak ada loop
   berdasarkan quantity sama sekali.
3. **Kuota tiket** — soft-check di `addEventTicketToCartAction` (`used >= ticket.quota`) tidak
   memperhitungkan permintaan >1 sekaligus, dan checkout (`checkoutAction` di
   `cart/actions.ts`) **tidak punya hard lock kuota tiket sama sekali** di dalam transaction
   (beda dengan alur lama `registerForEventAction` yang sudah `FOR UPDATE` kunci baris tiket —
   lihat § "Guard 'sudah ada sebelumnya'..." di `docs/lessons-learned.md`). Kalau quantity>1
   dibuka tanpa menambal ini, oversell kuota jadi jauh lebih mudah terjadi.

### Tujuan Fitur

Satu orang bisa checkout **N tiket sekaligus** (dari jenis tiket yang sama atau campuran), isi
nama peserta untuk tiap tiket, dalam satu invoice — dengan UI yang enak dipakai (bukan submit
form berkali-kali).

### Desain yang Diusulkan

**1. Data model cart — `cart_items.notes` jadi array, bukan objek tunggal**
```
// Sekarang (1 attendee):
{ attendeeName, attendeePhone, attendeeEmail, customFieldAnswers }

// Rencana (N attendee, quantity = attendees.length):
{ attendees: [
    { attendeeName, attendeePhone, attendeeEmail, customFieldAnswers },
    { attendeeName, attendeePhone, attendeeEmail, customFieldAnswers },
    ...
  ] }
```
`cart_items.quantity` diisi `attendees.length` (kolom ini sudah ada, generik, dipakai benar
oleh produk — tiket tinggal ikut pola yang sama). `unitPrice` tetap harga per-tiket; total baris
tetap `unitPrice * quantity` (logic ini sudah generik di `checkoutAction`, tidak perlu diubah).

**Kompatibilitas mundur** — invoice/cart lama masih simpan `notes` sebagai objek tunggal (bukan
`{attendees: [...]}`). `parseAttendeeFromInvoiceItem()` wajib deteksi dua format: kalau ada key
`attendees` (array) → format baru, loop; kalau tidak → treat sebagai 1 attendee format lama.
Jangan migrasi data lama, cukup dual-parse.

**2. `addEventTicketToCartAction` → jadi "tambah 1 peserta ke baris tiket ini di cart"**
- Ganti perilaku "tiket sama → timpa notes" jadi "tiket sama → **append** ke array `attendees`,
  quantity naik 1".
- Soft quota check: `used + (currentQuantityInCart + 1) > ticket.quota` → tolak, bukan cuma
  `used >= quota`.
- Perlu aksi baru untuk **hapus 1 peserta** dari baris tiket di cart (bukan hapus seluruh baris)
  — UI keranjang publik (`/{slug}/keranjang`) perlu list per-peserta dengan tombol hapus per
  baris, bukan cuma per jenis tiket.

**3. UI form pendaftaran (`event-register-form.tsx`)**
- Tambah quantity stepper (atau tombol "+ Tambah Peserta") di bawah pilihan tiket — tiap klik
  render 1 card form peserta baru (nama/HP/email + custom form jika aktif).
- Toggle "Gunakan data yang sama untuk semua peserta" (default ON untuk field custom-form yang
  masuk akal dibagi, mis. "Asal Cabang"; OFF untuk field yang jelas per-orang seperti nama) —
  ini yang dimaksud user sebagai "UI-nya keren" — jangan paksa isi ulang semua field N kali kalau
  jawabannya sama, tapi tetap kasih opsi override per-peserta.
- Guard kuota di client harus baca sisa kuota REAL-TIME terhadap quantity yang diminta, bukan
  cuma "kuota ada/tidak" seperti sekarang.
- Alur lama (`registerForEventAction`, non-cart) **TIDAK ikut didapat fitur ini** — cukup cart
  flow (sudah pakai invoice universal, lebih siap untuk multi-item). Alur lama tetap 1
  tiket/submit seperti sekarang.

**4. Hubungan dengan Custom Form (migration 0022, `custom_form_fields`)**
Ini poin yang diminta user secara eksplisit — custom form per event saat ini diisi SEKALI per
registrasi (1 attendee). Dengan multi-peserta:
- Tiap peserta tambahan pada dasarnya punya jawaban custom form sendiri (`customFieldAnswers`
  per-attendee, sudah tercermin di struktur data § 1 di atas).
- Tapi banyak field custom form logically SAMA untuk semua peserta dalam satu transaksi (mis.
  "Instansi/Kantor", "Kelompok Rombongan") — bukan per-orang (mis. "Ukuran Kaos"). Perlu
  keputusan produk saat desain UI: apakah `CustomFormField` butuh flag baru
  `perAttendee: boolean` (field yang `perAttendee=false` diisi sekali dan disalin ke semua
  attendee; yang `true` diisi manual tiap kartu peserta)? Kalau tidak, default aman: SEMUA field
  ditawarkan "sama untuk semua" dengan opsi override per toggle (§ 3), tidak perlu ubah schema
  `custom_form_fields`.

**5. `createEventRegistrationsFromInvoiceTickets` → loop per attendee**
- Parse `attendees[]` dari `invoice_items.description` (§ 1), loop insert 1
  `event_registrations` per elemen.
- Idempotency check saat ini (`ticketId + customFields->>'sourceInvoiceId' = invoiceId`, ambil 1
  baris) tidak cukup untuk N baris per invoice_item — perlu tag tambahan per baris, mis.
  `customFields.sourceInvoiceItemAttendeeIndex` (0-based), supaya re-run (retry pembayaran,
  webhook duplikat) tetap idempotent per-attendee, bukan cuma per-invoice.
- Setiap attendee generate `registrationNumber` sendiri (`EVT-YYYYMM-NNNNN`) via
  `generateEventRegNumber()` yang sudah ada — tidak perlu helper baru.

**6. Kuota — tambah hard lock di checkout**
Di dalam transaction `checkoutAction` (`cart/actions.ts`), sebelum insert registrasi: `SELECT
... FROM event_tickets WHERE id = ANY(ticketIds) FOR UPDATE`, hitung ulang `used` DI DALAM
transaction, tolak checkout kalau `used + requestedQty > quota` untuk tiket manapun. Pola ini
sudah ada persis di `registerForEventAction` (alur lama) — tinggal diterapkan juga di
`checkoutAction`, bukan pola baru yang perlu didesain dari nol.

### Pertanyaan Terbuka (perlu keputusan sebelum eksekusi)
- Ada batas maksimum quantity per baris/checkout (mis. 10 tiket/transaksi) untuk cegah abuse?
- Kalau salah satu attendee dalam satu baris kena kuota habis di tengah proses (partial), apakah
  seluruh checkout gagal (all-or-nothing) atau hanya sebagian attendee ter-daftar? — rekomendasi:
  all-or-nothing per baris tiket, konsisten dengan pola transaction lain di project ini.
- `perAttendee` flag di custom form fields — dibuat sekarang (butuh migration schema baru) atau
  ditunda ke iterasi berikutnya (default semua field "sama untuk semua" + override manual)?

### File yang Akan Tersentuh Saat Eksekusi
```
apps/web/app/(dashboard)/app/[tenant]/event/actions.ts   → addEventTicketToCartAction (append bukan timpa)
apps/web/app/(public)/[tenant]/cart/actions.ts            → checkoutAction (hard lock kuota tiket)
apps/web/lib/event-registration-sync.server.ts            → loop per attendee + idempotency per index
apps/web/components/event/event-register-form.tsx         → UI quantity + multi-peserta + toggle "sama untuk semua"
apps/web/components/event/public/...                      → UI keranjang: list per-peserta per baris tiket
docs/arsitektur-event.md                                  → update status setelah eksekusi (bagian ini)
```

---

## Check-in via Scan Kamera (QR) — ✅ SELESAI (2026-09-08)

> Status: **Kode selesai + type-check + production build bersih.** Migration sudah jalan di dev
> lokal. **Belum di-deploy ke VPS** (migration 0063 belum jalan di production, kode belum
> di-push). Investigasi awal 2026-09-08 (user minta cek visibilitas dulu), lanjut dieksekusi
> sesi yang sama setelah user konfirmasi "langsung jalankan rencana kamu". Keputusan yang diambil
> di 2 pertanyaan terbuka: **Opsi B** (kolom `checkin_token` baru, bukan reuse `id`) dan
> **library siap pakai `html5-qrcode`** (bukan `jsqr` manual) — sesuai rekomendasi awal, user
> tidak membantah.

### Kenapa Sekarang Tidak Bisa "Scan untuk Check-in"
QR di tiket peserta (muncul di `/{slug}/akun/event`, lihat § "Arsitektur Login Universal") **bukan
QR fungsional** — isinya cuma teks polos (nama event, tiket, nomor, nama, HP, email, status),
di-generate `generateQrDataUrl()` di [`akun/event/page.tsx`](../apps/web/app/(public)/[tenant]/akun/event/page.tsx).
Kalau di-scan pakai scanner HP apa pun, cuma menampilkan teks itu — tidak ada link, tidak ada
token, tidak trigger apa pun.

Di sisi admin, halaman check-in (`event/acara/[id]/checkin`, komponen `EventCheckinClient`)
**100% manual**: search nama/nomor/HP → klik tombol "Check-in". Tidak ada kamera, tidak ada
decode QR, tidak ada endpoint yang menerima hasil scan. `jsqr` yang sudah jadi dependency project
cuma dipakai di `api/decode-qr/route.ts` untuk decode gambar QRIS pembayaran — sama sekali tidak
tersentuh oleh flow event.

Codebase ini **sudah punya pola QR fungsional** untuk kasus lain — QR tanda tangan surat encode
URL asli ke halaman publik `/verify/[hash]` (`buildVerifyUrl()` di `lib/qr-code.ts`). Event tiket
tidak pakai pola ini sama sekali.

### Verdict Feasibility
**Layak, dan ini pola umum di aplikasi ticketing** — browser modern (mobile maupun desktop)
mendukung akses kamera via `getUserMedia()` di halaman HTTPS (produksi `jalakarta.com` sudah
HTTPS, tidak ada blocker). Baik HP (kamera belakang) maupun webcam laptop bisa dipakai — API-nya
sama, cuma constraint kamera yang beda (`facingMode: "environment"` untuk minta kamera belakang
di HP; laptop biasanya cuma punya satu kamera jadi otomatis dipakai). Tidak perlu native app,
tidak perlu izin khusus di luar izin kamera browser standar.

### Desain yang Diusulkan

**1. QR peserta harus encode TOKEN, bukan teks polos**
Ganti isi QR dari blok teks jadi identifier yang bisa langsung dipakai memanggil aksi check-in.
Info manusiawi (nama/HP/email/no. registrasi) **tidak hilang** — itu semua sudah tampil sebagai
teks biasa di bawah QR di kartu tiket yang sama (lihat screenshot user), jadi mengganti isi QR
jadi token tidak mengurangi apa pun yang terlihat mata.

Dua opsi, perlu keputusan sebelum eksekusi:
| Opsi | Isi QR | Migration | Trade-off |
|---|---|---|---|
| **A — pakai ulang `registration.id`** | UUID PK yang sudah ada | Tidak perlu migration sama sekali | Simpel & cepat. Tapi QR = PK asli tidak bisa "dicabut" tanpa mengubah identitas baris (kalau tiket hilang/discreenshot orang lain, tidak bisa regenerate QR baru tanpa insert ulang baris) |
| **B — kolom baru `checkin_token`** (nanoid random, unik) | Token terpisah dari PK | 1 migration kecil (tenant table pattern, ADR-0003) | Token bisa di-regenerate kapan saja (invalidate QR lama) tanpa ganggu baris registrasi — standar praktik ticketing (QR hilang/dibagi ke orang lain → admin klik "Reset QR") |

**Rekomendasi: Opsi B** — biaya migration kecil, tapi dapat kemampuan revoke/regenerate yang
biasanya dibutuhkan begitu sistem dipakai sungguhan (orang kehilangan HP, screenshot QR
tersebar, dll). Opsi A valid sebagai jalan pintas MVP kalau mau coba cepat dulu.

**2. Validasi saat check-in via scan (beda dari klik manual)**
`checkInRegistrationAction(slug, registrationId)` yang sudah ada ([actions.ts:1432](../apps/web/app/(dashboard)/app/[tenant]/event/actions.ts:1432))
BELUM validasi bahwa registrasi yang di-check-in benar-benar milik event yang sedang dibuka
halaman check-in-nya — aman untuk klik manual (list sudah di-scope ke event yang benar dari
server), tapi TIDAK aman untuk scan (QR dari event lain yang kebetulan discan di halaman event
ini seharusnya ditolak, bukan diam-diam check-in ke event yang salah). Tambah param
`expectedEventId` + validasi `reg.eventId === expectedEventId` sebelum update — reuse fungsi yang
sama, bukan bikin action baru terpisah.

Kondisi lain yang harus dibedakan pesannya (bukan cuma "gagal" generik):
- Token tidak ditemukan → "QR tidak dikenali."
- Token ada tapi `eventId` beda → "QR ini bukan untuk event ini."
- Sudah `attended` sebelumnya → tampilkan sebagai **info**, bukan error (nama + jam check-in
  sebelumnya) — scan ulang orang yang sama bukan serangan, cuma normal (staff kadang scan dobel
  tanpa sadar).
- Status `cancelled` → "Pendaftaran ini sudah dibatalkan."
- Status lain (`pending` tanpa alur cash-at-door) → ikut aturan yang sudah ada di action existing.

**3. Komponen scanner kamera — halaman baru, bukan modal di atas list yang sama**
Tambah toggle "Scan QR" di halaman `checkin/page.tsx`, di samping search box yang sudah ada
(search **tetap ada** sebagai fallback — HP mati, QR rusak, walk-in tanpa pra-daftar, dll, semua
kasus ini butuh manual search, jangan dihilangkan).

Alur:
- Tombol "Aktifkan Kamera" (WAJIB via user gesture — browser tidak bisa auto-request kamera saat
  page load) → `getUserMedia({ video: { facingMode: "environment" } })`, fallback ke kamera
  default kalau `environment` tidak tersedia (kasus laptop webcam)
- Preview video full-width, loop scan tiap ~200-300ms: gambar frame ke `<canvas>` tersembunyi →
  decode dengan `jsqr` (sudah jadi dependency, tidak perlu nambah baru) → kalau ketemu QR valid,
  panggil action
- **Debounce hasil scan** — begitu 1 QR sukses diproses, jangan proses ulang QR yang sama dalam
  ~3 detik (kamera terus menyala, QR yang sama masih ada di frame beberapa detik) — tanpa ini,
  1 orang discan bisa ke-check-in berkali-kali dalam sesi yang sama (tidak merusak data karena
  idempotent, tapi bikin banyak call sia-sia + flash sukses berulang membingungkan)
- Feedback visual jelas & besar (halaman ini dipakai sambil berdiri di pintu, bukan duduk depan
  laptop) — flash hijau + nama peserta untuk sukses, flash merah + alasan untuk gagal, lanjut
  scanning otomatis tanpa perlu tap apa pun lagi
- Kalau user tolak izin kamera browser → tampilkan pesan jelas + tombol balik ke mode search
  manual, jangan biarkan halaman blank/stuck

**4. Pilihan library: pakai `jsqr` mentah vs library scanner siap pakai**
`jsqr` sendiri cuma fungsi decode (kasih raw pixel data → keluar hasil teks) — TIDAK menghandle
akses kamera, loop render, UI pemilihan kamera (device dengan >1 kamera), dsb. Itu semua harus
ditulis manual kalau pakai `jsqr` polos.

| Opsi | Kelebihan | Kekurangan |
|---|---|---|
| **`jsqr` + tulis sendiri getUserMedia/canvas loop** | Tidak nambah dependency baru, kontrol penuh | Banyak edge-case browser (autoplay iOS Safari, permission race, orientasi video) harus ditangani manual — riskan bug di device yang belum sempat dites |
| **Library scanner siap pakai** (mis. `html5-qrcode` atau `@zxing/library`) | Sudah handle edge-case cross-browser, ada UI pemilihan kamera bawaan | Dependency baru, perlu dicek ukuran bundle + kompatibilitas Next.js App Router (client component) |

**Rekomendasi: pakai library siap pakai** untuk bagian kamera+scanning-loop (bukan `jsqr` manual)
— area ini justru yang paling gampang buggy kalau ditulis dari nol (terutama iOS Safari), dan
project sudah terbiasa nambah dependency kecil kalau memang menyelesaikan masalah nyata (lihat
`react-image-crop`, `qrcode`, dll di `apps/web/package.json`). `jsqr` yang sudah ada tetap bisa
dipertahankan untuk kegunaannya semula (decode gambar QRIS statis), tidak perlu dihapus.

**5. Halaman check-in butuh perhatian responsive KHUSUS, di luar backlog umum**
User sendiri sudah sadar dashboard admin secara umum belum responsive. Halaman ini beda kelas —
tujuannya memang dipakai berdiri di pintu masuk pakai HP, jadi harus dapat perlakuan mobile-first
walau bagian admin lain belum. Scope perbaikan responsive **dibatasi ke halaman checkin ini
saja** (tombol besar, preview kamera full-width, layout satu kolom) — bukan alasan untuk
merombak keseluruhan shell dashboard sekalian (di luar scope permintaan ini).

**6. Kompatibel laptop/webcam sekaligus HP — tidak perlu kode terpisah**
`getUserMedia()` adalah API yang sama persis di kedua kasus — bedanya cuma constraint kamera
mana yang diminta (`facingMode`) dan berapa banyak kamera yang terdeteksi
(`navigator.mediaDevices.enumerateDevices()`). Kalau device (laptop) cuma punya 1 kamera,
otomatis dipakai tanpa perlu UI pemilihan; kalau lebih dari 1 (HP dengan depan+belakang, atau
laptop dengan kamera eksternal terpasang), baru tampilkan dropdown pilih kamera. Tidak perlu
membangun dua jalur kode berbeda untuk "mode HP" vs "mode laptop".

### Keputusan yang Diambil (sudah dieksekusi)
- **Opsi B dipilih** — kolom `checkin_token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE` baru
  di `event_registrations`, terpisah dari `id`. Sama seperti `id`, di-generate DB-level via
  `defaultRandom()` di Drizzle — TIDAK ada kode INSERT (registerForEventAction,
  addEventTicketToCartAction, createEventRegistrationsFromInvoiceTickets) yang perlu diubah,
  token otomatis terisi di semua jalur pembuatan registrasi yang sudah ada.
- **`html5-qrcode` dipilih** (bukan `jsqr` manual) — handle akses kamera + loop scanning +
  fallback kamera sendiri. `jsqr` yang sudah ada TETAP dipertahankan untuk kegunaan semula
  (decode gambar QRIS statis di `api/decode-qr/route.ts`), tidak disentuh.
- **Tombol "Reset/Regenerate QR" — DITUNDA**, tidak dibuat di versi pertama ini. Token statis
  seumur hidup registrasi untuk sekarang; gampang ditambah nanti (satu UPDATE
  `checkin_token = gen_random_uuid()` per baris) kalau kebutuhannya muncul.
- **Notifikasi ke peserta soal QR lama yang berubah isinya — DITUNDA/tidak dianggap perlu.**
  Peserta tidak pernah melihat isi mentah QR-nya (cuma gambar QR + info teks di sampingnya, yang
  TIDAK berubah) — jadi tidak ada yang terlihat beda dari sisi peserta. Halaman `/akun/event`
  selalu generate QR fresh dari `checkin_token` saat ini setiap kali dibuka, jadi otomatis benar
  tanpa aksi apa pun dari peserta.

### Ringkasan Implementasi
- **Migration**: `packages/db/migrations/0063_event_checkin_token.sql` — loop semua tenant aktif,
  `ADD COLUMN IF NOT EXISTS`. Sudah dijalankan di dev lokal, **belum di VPS**.
- **Schema**: `packages/db/src/schema/tenant/events.ts` (kolom Drizzle) +
  `packages/db/src/helpers/create-tenant-schema.ts` (DDL untuk tenant baru).
- **QR generation**: `apps/web/app/(public)/[tenant]/akun/event/page.tsx` — `generateQrDataUrl()`
  sekarang dikasih `r.checkinToken`, bukan blok teks. Info manusiawi (nama/HP/email/no.
  registrasi) tidak hilang — tetap tampil sebagai teks biasa di kartu yang sama.
- **Server action baru**: `checkInByTokenAction(slug, eventId, token)` di
  `apps/web/app/(dashboard)/app/[tenant]/event/actions.ts` — validasi `eventId` cocok (celah yang
  tidak ada di `checkInRegistrationAction` lama, aman untuk klik manual tapi tidak untuk scan),
  bedakan hasil "sudah check-in sebelumnya" (info, bukan error) dari check-in baru (return
  `attendeeName` + `eventTitle` untuk pesan "Selamat datang"). **Fix susulan (security review
  pakai skill `jalakarta-security-review`, 2026-09-08)**: `checkInRegistrationAction` (yang lama,
  dipakai tombol check-in manual) ditambah parameter opsional `expectedEventId` + validasi yang
  sama — sebelumnya aman cuma karena `registrationId` yang dikirim selalu dari list yang
  sudah di-scope server-side, bukan dijamin di level action itu sendiri. Defense-in-depth,
  konsisten dengan `checkInByTokenAction`. `event-checkin-client.tsx` sudah kirim `eventId`
  (prop yang sudah ada) di pemanggilannya.
- **Komponen scanner baru**: `apps/web/components/event/event-qr-scanner.tsx` — kamera TIDAK
  pernah tertutup sendiri antar-scan (sesuai permintaan user), cooldown 3 detik per token supaya
  QR yang sama yang masih di frame tidak diproses berkali-kali, fallback otomatis dari
  `facingMode:"environment"` (HP) ke kamera pertama yang terdeteksi (laptop/webcam) kalau
  `environment` tidak tersedia.
- **Integrasi**: `event-checkin-client.tsx` dapat toggle "Cari Manual" (default, tetap ada sebagai
  fallback) vs "Scan QR". `checkin/page.tsx` kirim `eventId` sebagai prop baru.
- **Verifikasi**: `bun run type-check` + `bun run build --filter=@jalajogja/web` bersih (termasuk
  route `checkin` ter-build sebagai dynamic route, ~114kB bundle sendiri — tidak crash SSR
  meski `html5-qrcode` di-import dari client component, dikonfirmasi `require()` langsung di
  Node tidak melempar error modul). **Belum bisa dites end-to-end di browser sungguhan** — halaman
  admin perlu login, tidak ada akses SSH/kredensial dev dari sesi ini.
- **Responsive halaman checkin**: TIDAK disentuh di iterasi ini — toggle + scanner memakai
  komponen `Button` full-width yang sudah reasonably mobile-friendly secara default, tapi belum
  ada audit/pass responsive khusus seperti direncanakan di § 5 rencana awal. Kalau di tes nyata
  di HP ternyata kurang nyaman, perlu sesi lanjutan.

### File yang Disentuh
```
packages/db/src/schema/tenant/events.ts                  → kolom checkinToken
packages/db/src/helpers/create-tenant-schema.ts           → DDL checkin_token
packages/db/migrations/0063_event_checkin_token.sql       → migration baru
apps/web/app/(public)/[tenant]/akun/event/page.tsx        → QR isi checkinToken, bukan teks
apps/web/app/(dashboard)/app/[tenant]/event/actions.ts    → checkInByTokenAction baru
apps/web/components/event/event-qr-scanner.tsx            → BARU — komponen scanner kamera
apps/web/components/event/event-checkin-client.tsx        → toggle Cari Manual / Scan QR
apps/web/app/(dashboard)/app/[tenant]/event/acara/[id]/checkin/page.tsx → kirim prop eventId
apps/web/package.json                                     → dependency baru html5-qrcode
docs/arsitektur-event.md                                  → dokumen ini
```

---

## RENCANA — Modul Event Responsive (Mobile)

> Status: **RENCANA, belum dieksekusi.** Dicatat 2026-09-08 sebelum eksekusi (disiplin
> `CLAUDE.md` § "Cara Claude Harus Bekerja" poin 7). **Scope sengaja dibatasi ke modul Event
> saja** — dashboard admin lain BELUM responsive dan TIDAK disentuh di rencana ini (keputusan
> user: mulai dari satu modul konkret dulu, bukan audit menyeluruh dashboard sekaligus).

### Prinsip Pembagian Effort (keputusan user)
Tiga tingkat perlakuan berbeda, bukan satu treatment untuk semua:
1. **Nav/submenu Event** — full fix sekarang (jadi strip horizontal-scroll di mobile)
2. **Tabel biasa (Acara list, Peserta list di detail acara)** — fix ringan "sementara": cuma
   bisa di-scroll horizontal kayak Excel, BUKAN dirombak jadi card. Sengaja kecil biar
   perubahannya tidak besar
3. **Halaman Check-in** — SATU-SATUNYA yang dapat perlakuan "super responsive": di mobile jadi
   card menurun ke bawah (bukan tabel sama sekali)

Alasan pembagian ini (dari user): halaman check-in memang didesain dipakai berdiri pakai HP di
pintu masuk acara (lihat § "Check-in via Scan Kamera (QR)" di atas) — jadi itu yang paling butuh
pengalaman mobile penuh. Tabel lain masih dipakai duduk di depan laptop, jadi cukup bisa
di-scroll, tidak perlu dirombak total sekarang. **Catatan user**: kalau nanti mau lebih jauh,
SEMUA tabel jadi card-menurun-ke-bawah di mobile itu arah yang lebih baik jangka panjang — tapi
itu di luar scope rencana ini, dicatat sebagai arah masa depan saja.

### 1. `EventNav` — sudah 1 komponen, tinggal dibuat adaptif
Sudah dicek: `components/event/event-nav.tsx` MEMANG sudah satu-satunya sumber sub-nav Event
(dipakai sekali di `event/layout.tsx`, membungkus SEMUA halaman Event — Acara/Kategori/
Pengaturan/detail acara/checkin). Jadi "componentize supaya edit sekali kena semua" yang
diminta **sudah terpenuhi secara struktural** — tidak perlu refactor pemisahan komponen, cukup
buat isinya adaptif per breakpoint.

**Masalah saat ini**: `w-48 shrink-0 border-r ... py-4` — SELALU render sebagai kolom vertikal
lebar tetap 192px, di layar HP sempit itu makan porsi besar dari viewport secara permanen,
tidak ada logic mobile sama sekali.

**Fix**: ubah container jadi responsive — di bawah breakpoint (`md`), render sebagai strip
horizontal di ATAS konten (bukan kolom kiri), item-nya scroll ke samping
(`flex flex-row overflow-x-auto whitespace-nowrap`, tiap item `shrink-0` supaya tidak
kegencet). Di atas `md`, tetap kolom vertikal seperti sekarang (tidak berubah untuk desktop).
`event/layout.tsx` ikut berubah: `flex h-full` → `flex flex-col md:flex-row h-full` (nav di
atas konten saat mobile, di samping saat desktop).

### 2. Tabel biasa — ganti `overflow-hidden` jadi `overflow-x-auto`
Dicek: DUA tabel di modul Event pakai `overflow-hidden` di div pembungkus — ini SALAH untuk
mobile, bukan cuma "belum responsive": `overflow-hidden` bikin kolom yang kepotong di layar
sempit hilang sama sekali (tidak bisa diakses), bukan bisa di-scroll. Persis kebalikan dari
yang diminta user ("kayak Excel, bisa discroll").
- `components/event/event-list-client.tsx` (Acara list) — baris ~109
- `components/event/event-registration-list.tsx` (Peserta list di detail acara — BUKAN
  halaman checkin, itu beda file dan sudah tidak pakai `<table>` sama sekali)

Fix: ganti `overflow-hidden` → `overflow-x-auto` di kedua tempat. Perubahan minimal, sesuai
prinsip "jangan besar-besar dulu" dari user.

(`event-category-manage-client.tsx` sudah aman — itu list `divide-y`, bukan `<table>`, tidak
ada masalah overflow horizontal.)

### 3. Halaman Check-in — audit + polish "super responsive"
Sudah dicek: `event-checkin-client.tsx` **sudah** render baris peserta sebagai card
(`<div className="flex items-center gap-3 rounded-lg border p-3">`), BUKAN `<table>` — jadi
fondasi "card menurun ke bawah" yang diminta user **sudah ada dari awal**, bukan perlu
dirombak dari nol. Yang perlu dicek/dipoles saat eksekusi (bukan redesign besar):
- Baris kartu peserta: pastikan di layar sangat sempit (~320-375px) nama+meta+tombol aksi
  tidak saling gencet — mungkin perlu `flex-wrap` atau susun ulang jadi 2 baris (info di atas,
  tombol aksi full-width di bawah) khusus breakpoint mobile.
- Stats strip (`grid grid-cols-3 gap-3`) — 3 kolom sama lebar, cek angka+label tidak terlalu
  mepet di layar sempit, kecilkan font/padding kalau perlu.
- Toggle "Cari Manual"/"Scan QR" (`grid grid-cols-2 gap-2`) — sudah 2 kolom, kemungkinan besar
  sudah oke, verifikasi saja.
- Scanner kamera (`EventQrScanner`) — video full-width, `html5-qrcode` biasanya auto-sizing ke
  container, verifikasi tidak overflow horizontal di viewport sempit.
- Header halaman (`checkin/page.tsx`, sticky top) — link balik + judul event + tanggal, cek
  tidak wrap berantakan kalau judul event panjang.

### File yang Akan Tersentuh Saat Eksekusi
```
apps/web/components/event/event-nav.tsx                    → jadi adaptif (strip mobile / kolom desktop)
apps/web/app/(dashboard)/app/[tenant]/event/layout.tsx      → flex-col md:flex-row
apps/web/components/event/event-list-client.tsx             → overflow-hidden → overflow-x-auto
apps/web/components/event/event-registration-list.tsx       → overflow-hidden → overflow-x-auto
apps/web/components/event/event-checkin-client.tsx          → polish spacing/wrap di layar sempit
apps/web/app/(dashboard)/app/[tenant]/event/acara/[id]/checkin/page.tsx → cek header sticky
docs/arsitektur-event.md                                    → update status setelah eksekusi
```

### Verifikasi Setelah Eksekusi
`resize_window` (mobile preset) via browser tool lokal untuk tiap halaman di atas — bukan cuma
type-check, karena ini murni perubahan visual/layout yang type-checker tidak bisa validasi.

### Susulan — Layout Create/Edit (`event-form.tsx`) juga responsive (2026-09-08)
User laporan lanjutan: halaman create/edit (bukan cuma list/checkin) di Event, Donasi, Toko
sama-sama belum responsive — ternyata KETIGANYA pakai pola layout editor yang identik: sidebar
`w-72` (288px) TETAP nempel di samping, `flex flex-1 overflow-hidden` dua-panel-independen-scroll
tanpa logic mobile sama sekali. Diperbaiki di ketiga form sekaligus (`event-form.tsx`,
`campaign-form.tsx` di Donasi, `product-form.tsx` di Toko — lihat masing-masing doc modul untuk
detail per-file):
- Header: `flex items-center justify-between` → stack vertikal + wrap tombol di mobile
  (`flex-col sm:flex-row ... flex-wrap` pada baris tombol) — EventForm py header paling ramai
  (sampai 4 tombol: Hapus/Batalkan/Simpan/Publikasikan), paling butuh ini.
- Body: `flex flex-1 overflow-hidden` → `flex flex-col md:flex-row flex-1 overflow-y-auto
  md:overflow-hidden` — mobile jadi SATU kolom scroll natural (sidebar di bawah main), desktop
  tetap dua panel independen scroll seperti semula.
- Main area & sidebar: `overflow-y-auto` yang tadinya unconditional diubah jadi `md:overflow-y-auto`
  (mobile: ikut alur scroll body, tidak scroll sendiri — nested-scroll-di-dalam-scroll itu UX
  buruk di touchscreen). Sidebar `w-72 shrink-0 border-l` → `w-full md:w-72 md:shrink-0 border-t
  md:border-t-0 md:border-l` (full-width + border atas saat ditumpuk di bawah main, kolom+border
  kiri seperti semula di desktop).
- **Kasus khusus `product-form.tsx`**: sidebar-nya punya trik tambahan (footer tombol simpan flex
  sibling biasa, BUKAN sticky — sengaja dibikin begitu sebelumnya untuk cegah footer menutupi
  konten saat scroll, lihat komentar di file). Trik itu butuh `flex-1`+`overflow-y-auto` di
  wrapper konten sidebar — diubah jadi `md:flex-1 md:overflow-y-auto` (bukan dihapus) supaya
  trik-nya tetap jalan di desktop, tapi di mobile kontennya mengalir natural tanpa area scroll
  bersarang.
**Belum diverifikasi visual** — perlu login admin untuk screenshot di viewport mobile beneran.
