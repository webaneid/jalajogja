# Arsitektur: Halaman Detail Surat

## Scope
Dokumen ini mencakup halaman detail surat keluar dan nota dinas — render isi surat,
resolve merge fields, QR code, penandatangan, dan bulk children.

---

## Route
```
app/(dashboard)/[tenant]/letters/keluar/[id]/page.tsx   → detail surat keluar
app/(dashboard)/[tenant]/letters/nota/[id]/page.tsx     → detail nota dinas (sama strukturnya)
```

---

## Alur Data (Server Component)

```
getTenantAccess(slug)
  └─ auth check → redirect /login jika gagal

createTenantDb(slug)
  └─ { db: tenantDb, schema }

Fetch paralel:
  ├─ letters (by id, type=outgoing)
  ├─ letterTypes (nama jenis surat)
  ├─ officers (canSign=true) + memberMap + divisionMap
  ├─ letterSignatures → generateQrDataUrl per signature
  └─ settings (key="general", group="general") → orgData

buildMergeContext({ orgName, orgAddress, ..., signers[] })
  └─ resolveMergeFields(letter.body, mergeCtx)
       └─ renderBody(resolvedBody)
            └─ HTML string → dangerouslySetInnerHTML
```

---

## Render Isi Surat

### File utama
`apps/web/lib/letter-render.ts`

### Prinsip
- **Pure string manipulation** — tidak pakai `@tiptap/core` atau `prosemirror-model`
- Alasan: `prosemirror-model` memanggil `window.document` saat serialisasi → crash di RSC/Node
- Zero DOM dependency → aman di server component, API route, PDF generator

### Fungsi ekspor
```typescript
export function renderBody(body: string | null | undefined): string
```
- Input: JSON string Tiptap atau plain text
- Output: HTML string
- Fallback: jika bukan JSON valid atau bukan `type:"doc"` → `escapeHtml + newline→<br>`

### Node type yang didukung
| Node | Output |
|------|--------|
| `doc` | wrapper, render children |
| `paragraph` | `<p>` + optional `style="text-align:X"` |
| `heading` | `<h1>`–`<h6>` + optional align |
| `text` | escaped text + marks |
| `bulletList` | `<ul>` |
| `orderedList` | `<ol>` |
| `listItem` | `<li>` |
| `blockquote` | `<blockquote>` |
| `codeBlock` | `<pre><code>` |
| `horizontalRule` | `<hr>` |
| `hardBreak` | `<br>` |
| `image` | `<img>` (dari MediaImageExtension) |
| `table` | `<table>` |
| `tableRow` | `<tr>` |
| `tableHeader` | `<th>` |
| `tableCell` | `<td>` |
| `embedBlock` | render `html` attr atau link fallback |
| unknown | render children saja (graceful degradation) |

### Mark type yang didukung
| Mark | Output |
|------|--------|
| `bold` | `<strong>` |
| `italic` | `<em>` |
| `underline` | `<u>` |
| `strike` | `<s>` |
| `code` | `<code>` |
| `link` | `<a href target="_blank" rel="noopener noreferrer">` |
| `textStyle` | `<span style="color:X">` (jika ada color attr) |
| `highlight` | `<mark>` atau `<mark style="background-color:X">` |

---

## Merge Fields

### File
`apps/web/lib/letter-merge.ts`

### Alur
1. `buildMergeContext(params)` → bentuk `MergeContext`
2. `resolveMergeFields(jsonString, ctx)` → replace `{{key}}` di raw JSON string
3. Baru setelah resolve → `renderBody(resolvedString)` → HTML

### Urutan penting
Resolve HARUS dilakukan pada **raw JSON string** sebelum di-parse dan di-render.
Jangan parse JSON dulu baru resolve — regex `{{...}}` bisa muncul di value string dalam JSON.

### Variabel tersedia
```
{{org.name}}               Nama organisasi (dari settings key="site_name" group="general")
{{org.address}}            Alamat organisasi (dari settings key="contact_address" group="contact", field .detail)
{{org.phone}}              Telepon organisasi (dari settings key="contact_phone" group="contact")
{{org.email}}              Email organisasi (dari settings key="contact_email" group="contact")

{{letter.number}}          Nomor surat
{{letter.date}}            Tanggal surat
{{letter.subject}}         Perihal surat
{{letter.sender}}          Pengirim (= nama organisasi, auto-set)
{{letter.recipient}}       Penerima (= field Kepada, nama saja)

{{signer.name}}            Nama penandatangan pertama
{{signer.position}}        Jabatan penandatangan pertama
{{signer.division}}        Divisi penandatangan pertama

{{recipient.name}}         Nama penerima lengkap (= letter.recipient)
{{recipient.title}}        Jabatan/gelar — dari kontak: letter_contacts.title; dari anggota: "Anggota {orgName}"
{{recipient.organization}} Instansi — dari kontak: letter_contacts.organization; dari anggota: orgName
{{recipient.address}}      Alamat — dari kontak: alamat terstruktur; dari anggota: detail + kab dari public.addresses
{{recipient.phone}}        Telepon — dari kontak: letter_contacts.phone; dari anggota: public.contacts.phone
{{recipient.email}}        Email — dari kontak: letter_contacts.email; dari anggota: public.contacts.email
{{recipient.number}}       Nomor anggota (hanya bulk mail merge)
{{recipient.nik}}          NIK penerima (hanya bulk mail merge)

{{today}}                  Tanggal hari ini: DD/MM/YYYY (misal: 15/04/2026)
{{today.roman}}            Bulan Romawi: I–XII (misal: IV)
{{today.year}}             Tahun 4 digit (misal: 2026)
{{today.id}}               Format Indonesia: 1 Januari 2026
```
> Variabel `{{today.*}}` di-resolve **server-side** saat halaman detail di-render atau PDF di-generate — selalu menampilkan tanggal saat itu, bukan tanggal surat.

### Sumber org data
`{{org.*}}` dibaca dari dua settings group yang berbeda:
```typescript
getSettings(tenantClient, "general")  → ["site_name"] → orgName
getSettings(tenantClient, "contact")  → ["contact_address"].detail → orgAddress
                                      → ["contact_phone"]          → orgPhone
                                      → ["contact_email"]          → orgEmail
```
Fallback `orgName`: jika `site_name` kosong → ambil `public.tenants.name`.
**Konsisten di tiga tempat**: `keluar/[id]/page.tsx`, `nota/[id]/page.tsx`, `generate-pdf/route.ts`.

### Alur sinkronisasi data penerima
Saat user memilih kontak atau anggota dari **RecipientCombobox** di form surat:
1. Field `Kepada` (= `letter.recipient`) diisi dengan nama
2. Data lengkap penerima disimpan ke `letter.mergeFields` (JSONB):
   ```json
   {
     "recipient_title":        "Direktur Jenderal",
     "recipient_organization": "Kementerian Perdagangan",
     "recipient_address":      "Jl. MI Ridwan Rais No. 5, Jakarta",
     "recipient_phone":        "021-12345678",
     "recipient_email":        "email@contoh.com"
   }
   ```
3. Saat render detail / generate PDF, data diambil kembali dari `mergeFields` dan diisi ke `MergeContext.recipient`
4. `{{recipient.*}}` di body surat di-resolve otomatis

**Sumber data per tipe penerima:**

| Sumber | name | title | organization | address | phone | email |
|---|---|---|---|---|---|---|
| Kontak (letter_contacts) | ✓ | jabatan kontak | nama instansi kontak | alamat terstruktur kontak | ✓ | ✓ |
| Anggota (public.members) | ✓ | "Anggota {orgName}" | orgName (nama tenant) | detail + kab dari addresses | dari contacts | dari contacts |
| Ketik manual | ✓ | — | — | — | — | — |
| Bulk mail merge | ✓ | — | — | ✓ (dari data anggota) | ✓ | ✓ |

**Jika kosong**: variabel di-resolve ke string kosong `""` — tidak ada literal `{{recipient.title}}` yang muncul di output.

**Catatan penting**: `{{recipient.name}}` bersumber dari `letter.recipient` (kolom langsung), bukan dari `mergeFields`.

### Bug autolink (legacy data)
Surat lama yang disimpan saat `autolink: true` aktif di TiptapEditor menyimpan `{{variable}}`
sebagai kombinasi: text node `{{` + link node `variable` + text node `}}`.
`renderBody` menangani ini dengan benar karena renderer custom tidak peduli struktur link —
link node dengan href = `http://variable` tetap di-render sebagai `<a>`, bukan crash.

---

## Penandatangan & QR

### Komponen
`components/letters/letter-signing-section.tsx` (client component)

### QR Code
- Di-generate **server-side** di page.tsx saat halaman dimuat
- `generateQrDataUrl(verifyUrl)` → base64 PNG via `qrcode` package
- `buildVerifyUrl(slug, hash)` → URL ke halaman publik verifikasi
- Optimistic state setelah sign: `qrDataUrl: null` → tampilkan placeholder, muncul setelah refresh

### Halaman verifikasi publik
`app/(public)/[tenant]/verify/[hash]/page.tsx`
- Route group `(public)` — di luar `(dashboard)`, tidak ada auth gate
- Tampilkan "Tanda Tangan Tidak Valid" jika hash tidak ditemukan (bukan 404)

---

## Bulk Children

### Kondisi tampil
`letter.isBulk === true` → tampilkan section BulkChildrenSection + warning banner

### Komponen
`components/letters/bulk-children-section.tsx` (client component)

---

## Catatan Pengembangan

- **Jangan ganti `renderBody` ke `@tiptap/core` generateHTML** — prosemirror-model akses `window`, crash di server
- **Jangan pakai linkedom/jsdom** — menambah dependency berat untuk masalah yang sudah solved
- Untuk node type baru di editor: tambah case di `renderNode()` di `letter-render.ts`
- Untuk mark baru: tambah case di `applyMark()` di `letter-render.ts`
- CSS styling di halaman detail: inline Tailwind prose di `dangerouslySetInnerHTML` wrapper,
  bukan inline style di HTML yang di-generate (keduanya bisa koeksistensi)

---

## Lessons Learned — Debugging Render JSON→HTML (2026-04)

Sesi debugging ini cukup panjang. Dicatat agar tidak mengulang jalur yang sama.

### Kronologi masalah

**Symptom awal**: Isi surat di halaman detail tampil sebagai raw JSON string, bukan HTML.

**Root cause ternyata berlapis:**

#### Layer 1 — `renderBody` tidak dipanggil sama sekali
Halaman awalnya menggunakan `<TiptapEditor editable={false}>` (client component) untuk
menampilkan konten read-only. Di server component, TiptapEditor butuh JS hydration —
jika hydration belum selesai atau gagal, konten tidak muncul sama sekali.
**Fix**: ganti ke `dangerouslySetInnerHTML={{ __html: renderBody(body) }}`.

#### Layer 2 — `renderBody` memanggil `generateHTML` dari `@tiptap/core` yang crash
`@tiptap/core` menggunakan `prosemirror-model` untuk serialisasi HTML.
`prosemirror-model` memanggil `window.document` sebagai **free variable** (bukan via `globalThis`)
saat fungsi `serializeFragment` berjalan.

Stack trace yang menunjukkan root cause:
```
ReferenceError: window is not defined
  at doc (prosemirror-model/dist/index.js:3377)       ← di sini crash
  at serializeFragment (prosemirror-model/dist/index.js:3270)
  at getHTMLFromFragment (@tiptap/core/dist/index.js:1298)
  at generateHTML (...)
```

Karena `renderBody` membungkus dengan `try/catch`, crash ini ditelan diam-diam →
fallback ke `escapeHtml(body)` → output raw JSON ter-escape → tampak seperti "raw JSON".

#### Layer 3 — Empty text nodes dari bug autolink lama
Surat yang disimpan saat `autolink: true` aktif memecah `{{recipient.name}}` menjadi:
- text node: `{{`
- link node: `recipient.name` (href: `http://recipient.name`)
- text node: `` (kosong)

`generateHTML` dari Tiptap melempar `RangeError: Empty text nodes are not allowed`.
Ini juga ditelan `try/catch` → fallback ke raw JSON.

#### Layer 4 — Duplikat extension name
Setelah mengganti `Link` dan `Table` dengan versi server-safe, muncul warning:
`[tiptap warn]: Duplicate extension names found: ['underline', 'link']`
karena StarterKit v3 sudah bundle keduanya secara internal.
Fix: `StarterKit.configure({ underline: false, link: false })`.

**Namun semua fix di atas tidak menyelesaikan root cause** — `prosemirror-model` tetap
akses `window` terlepas dari extension apa yang dipakai.

### Pendekatan yang dicoba dan tidak berhasil

| Pendekatan | Kenapa gagal |
|---|---|
| `TiptapEditor editable={false}` di server component | Butuh JS hydration, konten tidak muncul di SSR |
| Ganti `Link`/`Table` dengan server-safe Mark/Node | Bukan penyebab utama — `prosemirror-model` tetap crash |
| `globalThis.window = {}` polyfill | RSC menggunakan execution scope terpisah, polyfill tidak propagate |
| `StarterKit.configure({ link: false, underline: false })` | Benar tapi tidak cukup — root cause ada di prosemirror-model, bukan extension |

### Solusi yang benar

**Buang `@tiptap/core` sepenuhnya dari `letter-render.ts`.**

Tulis custom renderer berbasis pure string manipulation di `lib/letter-render.ts`:
- Recursive `renderNode(node)` — switch berdasarkan `node.type`
- Recursive `applyMark(text, mark)` — switch berdasarkan `mark.type`
- Zero dependency pada Tiptap/ProseMirror/DOM
- Fully server-safe, bisa jalan di Node, Bun, Edge runtime

### Cara mendiagnosis masalah serupa di masa depan

1. **Jangan percaya `try/catch` diam-diam** — tambah `console.error` di catch block sementara
   untuk lihat error aslinya sebelum ditelan fallback
2. **Test di luar Next.js terlebih dahulu**:
   ```bash
   bun --eval "import { renderBody } from './lib/letter-render.ts'; console.log(renderBody(...))"
   ```
3. **Lihat stack trace penuh** — `e.stack`, bukan hanya `e.message`
4. **Isolasi extension satu per satu** jika curiga Tiptap — coba StarterKit saja dulu,
   baru tambah extension lain satu per satu
5. **Ingat**: `generateHTML` dari `@tiptap/core` = `prosemirror-model` DOMSerializer = butuh `window`.
   Tidak ada cara memakainya di server tanpa DOM polyfill berat.
