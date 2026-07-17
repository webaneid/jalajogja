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
