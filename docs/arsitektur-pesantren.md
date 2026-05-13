# Arsitektur Data Pesantren — jalajogja

> Status: **SELESAI** — sudah dieksekusi dan ter-commit (commit `dbc933e`).

---

## Konsep Utama

"Data Pesantren" bukan relasi anggota ke direktori pesantren.
Data pesantren adalah **data pesantren yang dimiliki/dikelola oleh anggota IKPM** —
identik konsepnya dengan `member_businesses` (data usaha).

Anggota IKPM bisa punya satu atau lebih pesantren yang mereka kelola.
Data ini self-reported, tidak butuh verifikasi admin.

---

## Yang Salah di Implementasi Lama

| Aspek | Lama (SALAH) | Baru (BENAR) |
|-------|-------------|--------------|
| Konsep | Pivot relasi anggota ↔ direktori pesantren | Pesantren yang dimiliki/dikelola anggota |
| Tabel | `member_pesantren` (pivot ke `pesantren`) | `member_owned_pesantren` (standalone) |
| Field utama | `pesantrenId`, `peran` (alumni/pengasuh/dll) | `name`, kurikulum, model, statistik santri |
| Lookup | Search dari direktori pesantren | Input langsung oleh anggota |
| API | `/api/akun/member-pesantren` → pivot table | `/api/akun/member-pesantren` → owned table |
| Form | PesantrenSearch + peran/tahun | Form lengkap seperti usaha |

---

## Schema DB Baru: `public.member_owned_pesantren`

Pola identik dengan `member_businesses` — satu row per pesantren, helper FK opsional.

```sql
CREATE TABLE public.member_owned_pesantren (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id       UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,

  -- Identitas
  name            TEXT NOT NULL,
  tahun_berdiri   INTEGER,               -- tahun berdiri (e.g. 1985)
  luas_area       TEXT,                  -- free text, e.g. "2 hektar"
  nama_pimpinan   TEXT,                  -- nama pimpinan/pengasuh saat ini
  hp_pimpinan     TEXT,                  -- nomor HP pimpinan, format E.164

  -- Klasifikasi
  kurikulum       TEXT CHECK (kurikulum IN (
                    'KMI Gontor', 'DIKNAS', 'KEMENAG', 'Salafiah', 'Lainnya'
                  )),
  jenis_pondok    TEXT CHECK (jenis_pondok IN ('Wakaf', 'Milik Keluarga')),
  model_pendidikan TEXT CHECK (model_pendidikan IN (
                    'Murni KMI Gontor',
                    'KMI dan Tahfidz',
                    'KMI dan Kewirausahaan',
                    'Pesantren Salafiah',
                    'Pesantren Tahfidz',
                    'Sekolah Umum',
                    'DIKNAS dan Tahfidz',
                    'KEMENAG dan Tahfidz',
                    'Sekolah Kejuruan'
                  )),
  kategori_santri TEXT CHECK (kategori_santri IN (
                    'Putra', 'Putra dan Putri', 'Putri'
                  )),

  -- Statistik (auto-total dikalkulasi di client/display, tidak disimpan)
  santri_putra    INTEGER,               -- jumlah santri putra
  santri_putri    INTEGER,               -- jumlah santri putri
  asatidz         INTEGER,               -- jumlah asatidz (pengajar putra)
  asatidzah       INTEGER,               -- jumlah asatidzah (pengajar putri)

  -- Helper FKs (kondisional, null jika kosong)
  contact_id      UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  address_id      UUID REFERENCES public.addresses(id) ON DELETE SET NULL,
  social_media_id UUID REFERENCES public.social_medias(id) ON DELETE SET NULL,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_member_owned_pesantren_member_id
  ON public.member_owned_pesantren(member_id);
```

**Catatan field:**
- `hp_pimpinan` = nomor HP pimpinan pesantren, disimpan E.164 via `normalizePhone()`, bukan FK ke `contacts`
- `contact_id` = kontak pesantren secara umum (HP pesantren, WA, email) — helper table seperti usaha
- Total santri dan total asatidz adalah kalkulasi client: `santri_putra + santri_putri`, `asatidz + asatidzah`

---

## Drizzle Schema

**File baru:** `packages/db/src/schema/public/member-owned-pesantren.ts`

```typescript
export const memberOwnedPesantren = pgTable("member_owned_pesantren", {
  id:       uuid("id").primaryKey().defaultRandom(),
  memberId: uuid("member_id").notNull()
              .references(() => members.id, { onDelete: "cascade" }),

  name:          text("name").notNull(),
  tahunBerdiri:  integer("tahun_berdiri"),
  luasArea:      text("luas_area"),
  namaPimpinan:  text("nama_pimpinan"),
  hpPimpinan:    text("hp_pimpinan"),

  kurikulum:       text("kurikulum", {
                     enum: ["KMI Gontor","DIKNAS","KEMENAG","Salafiah","Lainnya"],
                   }),
  jenisPondok:     text("jenis_pondok", {
                     enum: ["Wakaf","Milik Keluarga"],
                   }),
  modelPendidikan: text("model_pendidikan", {
                     enum: [
                       "Murni KMI Gontor","KMI dan Tahfidz","KMI dan Kewirausahaan",
                       "Pesantren Salafiah","Pesantren Tahfidz","Sekolah Umum",
                       "DIKNAS dan Tahfidz","KEMENAG dan Tahfidz","Sekolah Kejuruan",
                     ],
                   }),
  kategoriSantri:  text("kategori_santri", {
                     enum: ["Putra","Putra dan Putri","Putri"],
                   }),

  santriPutra:  integer("santri_putra"),
  santriPutri:  integer("santri_putri"),
  asatidz:      integer("asatidz"),
  asatidzah:    integer("asatidzah"),

  contactId:     uuid("contact_id")
                   .references(() => contacts.id,    { onDelete: "set null" }),
  addressId:     uuid("address_id")
                   .references(() => addresses.id,   { onDelete: "set null" }),
  socialMediaId: uuid("social_media_id")
                   .references(() => socialMedias.id, { onDelete: "set null" }),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  memberIdx: index("idx_member_owned_pesantren_member_id").on(t.memberId),
}));
```

---

## API Routes

### `GET /api/akun/member-pesantren`

Auth: `members.betterAuthUserId = session.user.id`
Query: LEFT JOIN ke contacts, addresses, socialMedias, dan **ref wilayah** (wajib ikut nama).

Response per row:
```json
{
  "id": "uuid",
  "name": "Pesantren Al-Falah",
  "tahunBerdiri": 1995,
  "luasArea": "2 hektar",
  "namaPimpinan": "KH. Ahmad Fauzi",
  "hpPimpinan": "+6281234567890",
  "kurikulum": "KMI Gontor",
  "jenisPondok": "Wakaf",
  "modelPendidikan": "KMI dan Tahfidz",
  "kategoriSantri": "Putra dan Putri",
  "santriPutra": 120,
  "santriPutri": 80,
  "asatidz": 15,
  "asatidzah": 10,
  "phone": "+6281234567890",
  "whatsapp": "+6281234567890",
  "email": "pesantren@email.com",
  "isPhonePublic": false,
  "isWhatsappPublic": false,
  "addressCountry": null,
  "addressProvinceId": 12,
  "addressProvinceName": "Jawa Tengah",
  "addressRegencyId": 1234,
  "addressRegencyName": "Kabupaten Magelang",
  "addressDistrictId": 12345,
  "addressDistrictName": "Tempuran",
  "addressVillageId": 123456,
  "addressVillageName": "Sidorejo",
  "addressDetail": "Jl. Pesantren No. 1",
  "addressPostalCode": "56161",
  "instagram": "@pesantrenalfalah",
  ...
}
```

### `POST /api/akun/member-pesantren`

Replace-all pattern (identik dengan usaha):
1. `DELETE FROM member_owned_pesantren WHERE member_id = {id}`
2. For each valid entry (wajib: `name`):
   - INSERT contacts (kondisional jika ada phone/wa/email)
   - INSERT addresses (kondisional jika ada wilayah/detail)
   - INSERT social_medias (kondisional jika ada platform)
   - INSERT member_owned_pesantren dengan FK hasil di atas

Filter valid: `e.name?.trim()` — hanya nama yang wajib.

---

## UX Frontend: Three-View Pattern

Sama persis dengan `/akun/usaha`:

```
LIST VIEW (default)
  Table: Nama Pesantren | Kurikulum | Model Pendidikan | Aksi [Detail][Edit][Hapus]
  Tombol "Tambah Pesantren" di bawah

DETAIL VIEW (dialog popup)
  Section 1 — Identitas: nama, berdiri sejak, luas area
  Section 2 — Pimpinan: nama pimpinan, HP pimpinan
  Section 3 — Klasifikasi: kurikulum, jenis pondok, model pendidikan, kategori santri
  Section 4 — Statistik:
    Santri: Putra X | Putri Y | Total X+Y
    Pengajar: Asatidz X | Asatidzah Y | Total X+Y
  Section 5 — Kontak: telepon, WA, email
  Section 6 — Alamat: hirarki wilayah + detail + kode pos
  Section 7 — Sosial Media: platform yang terisi saja

EDIT VIEW (full-page replace)
  Breadcrumb: "← Data Pesantren / Nama Pesantren"
  Form per section (lihat Form Layout di bawah)
```

---

## Form Layout (Edit View)

### Section 1 — Identitas Pesantren
| Field | Tipe | Wajib |
|-------|------|-------|
| Nama Pesantren | text input | Ya |
| Berdiri Sejak | number input (tahun, min 1800 max 2025) | Tidak |
| Luas Area | text input (free text, placeholder "2 hektar") | Tidak |

### Section 2 — Pimpinan
| Field | Tipe | Wajib |
|-------|------|-------|
| Nama Pimpinan | text input | Tidak |
| Nomor HP Pimpinan | PhoneInput | Tidak |

### Section 3 — Klasifikasi
| Field | Tipe | Pilihan | Wajib |
|-------|------|---------|-------|
| Kurikulum Pendidikan | Combobox | KMI Gontor, DIKNAS, KEMENAG, Salafiah, Lainnya | Tidak |
| Jenis Pondok | Combobox | Wakaf, Milik Keluarga | Tidak |
| Model Pendidikan | Combobox | Murni KMI Gontor, KMI dan Tahfidz, KMI dan Kewirausahaan, Pesantren Salafiah, Pesantren Tahfidz, Sekolah Umum, DIKNAS dan Tahfidz, KEMENAG dan Tahfidz, Sekolah Kejuruan | Tidak |
| Kategori Santri | Combobox | Putra, Putra dan Putri, Putri | Tidak |

### Section 4 — Data Pesantren (Statistik)
| Field | Tipe | Catatan |
|-------|------|---------|
| Santri Putra | number input | ≥ 0 |
| Santri Putri | number input | ≥ 0 |
| Total Santri | read-only | auto: putra + putri |
| Asatidz | number input | pengajar putra, ≥ 0 |
| Asatidzah | number input | pengajar putri, ≥ 0 |
| Total Asatidz | read-only | auto: asatidz + asatidzah |

### Section 5 — Kontak Pesantren
- Telepon (PhoneInput, opsional) + checkbox Publik
- WhatsApp (PhoneInput, opsional) + checkbox "Sama dengan telepon" + checkbox Publik
- Email (text input, opsional)

### Section 6 — Alamat
- Toggle Indonesia / Luar Negeri
- Indonesia: WilayahSelect
- Luar Negeri: input nama negara
- Detail Alamat (textarea, opsional)
- Kode Pos (input, opsional)

### Section 7 — Sosial Media
- SocialMediaInput (7 platform, semua opsional)

---

## Admin Wizard: Step 5

File: `components/members/wizard/step5-pesantren.tsx`
Action: `saveMemberOwnedPesantrenAction()` di `members/actions.ts`

Rewrite total — hapus semua logic terkait `pesantrenId`, `peran`, `PesantrenSearch`.
Ganti dengan form identik dengan front-end tapi menggunakan server action (bukan API route langsung).

Satu entry per card, pola `BusinessCard` yang sama (`focusedId` state).

---

## File yang Perlu Dibuat / Diubah

### Baru
| File | Keterangan |
|------|-----------|
| `packages/db/src/schema/public/member-owned-pesantren.ts` | Drizzle schema tabel baru |
| SQL migration (inline di create-tenant-schema? tidak — ini public) | DDL untuk jalankan via psql |

### Diubah Total (rewrite)
| File | Keterangan |
|------|-----------|
| `packages/db/src/schema/public/index.ts` | Tambah export `member-owned-pesantren` |
| `packages/db/src/index.ts` | Re-export jika perlu |
| `app/api/akun/member-pesantren/route.ts` | Rewrite: query `memberOwnedPesantren` |
| `app/(public)/[tenant]/akun/pesantren/page.tsx` | Rewrite: three-view pattern |
| `components/members/wizard/step5-pesantren.tsx` | Rewrite: form baru |
| `app/(dashboard)/[tenant]/members/actions.ts` | Rewrite `saveMemberPesantrenAction` → `saveMemberOwnedPesantrenAction` |
| `app/(dashboard)/[tenant]/members/[id]/member-data-sections.tsx` | Update display pesantren |

---

## Urutan Eksekusi (✅ Semua Selesai)

```
Step 1 — Schema DB ✅
  1a. Buat file Drizzle: member-owned-pesantren.ts
  1b. Export dari index.ts
  1c. Buat SQL migration file + jalankan via psql

Step 2 — API Route ✅
  2a. Rewrite GET: query memberOwnedPesantren + LEFT JOIN semua helper + ref wilayah
  2b. Rewrite POST: replace-all dengan insert helper tables kondisional

Step 3 — Frontend (public) ✅
  3a. Rewrite pesantren/page.tsx: three-view pattern (usaha-client style)
      - Entry type + ApiRow type dengan nama wilayah
      - DetailDialog: tampil semua info termasuk statistik auto-total
      - EntryEditForm: 7 section
      - Fokus satu entry saat tambah (same as step4)

Step 4 — Admin Wizard ✅
  4a. Rewrite step5-pesantren.tsx: form identik dengan frontend
  4b. Rewrite saveMemberOwnedPesantrenAction di actions.ts
  4c. Update member-data-sections.tsx: tampil data baru

Step 5 — TypeScript check + commit ✅
  TypeScript 0 errors. Commit: dbc933e
```

---

## File Aktual yang Dibuat / Diubah

| File | Status |
|------|--------|
| `packages/db/src/schema/public/member-owned-pesantren.ts` | ✅ Dibuat |
| `packages/db/src/schema/public/index.ts` | ✅ Diperbarui |
| `docs/migration-member-owned-pesantren.sql` | ✅ Dibuat + dijalankan |
| `apps/web/app/api/akun/member-pesantren/route.ts` | ✅ Ditulis ulang |
| `apps/web/app/(public)/[tenant]/akun/pesantren/page.tsx` | ✅ Ditulis ulang |
| `apps/web/components/members/wizard/step5-pesantren.tsx` | ✅ Ditulis ulang |
| `apps/web/app/(dashboard)/[tenant]/members/actions.ts` | ✅ Diperbarui |
| `apps/web/app/(dashboard)/[tenant]/members/[id]/member-data-sections.tsx` | ✅ Diperbarui |
| `apps/web/app/(dashboard)/[tenant]/members/[id]/page.tsx` | ✅ Diperbarui |

---

## Aturan Yang Tidak Boleh Dilanggar

1. **Hanya satu field yang wajib**: `name` — semua field lain opsional
2. **`PhoneInput` wajib** untuk `hp_pimpinan` dan field kontak phone/WA — tidak boleh `<input type="tel">`
3. **`normalizePhone()`** di server sebelum INSERT untuk `hp_pimpinan`, `contacts.phone`, `contacts.whatsapp`
4. **Wilayah wajib resolve ke nama** di API GET — LEFT JOIN ke ref tables, sertakan nama + ID
5. **Auto-total kalkulasi di client** — tidak disimpan ke DB (`santri_putra + santri_putri`, `asatidz + asatidzah`)
6. **Three-view pattern** — list ringkas, detail popup, edit full-page
7. **Jangan emoji** di display apapun
8. **Fokus satu entry saat tambah** — entry lain tersembunyi (same as step4-business)
