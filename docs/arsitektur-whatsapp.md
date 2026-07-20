# Arsitektur WhatsApp Gateway — jalakarta

> Dokumen ini adalah referensi tunggal untuk semua hal terkait integrasi WhatsApp di platform jalakarta.
> Terkoneksi dengan: `CLAUDE.md` § "WhatsApp Gateway", `docs/arsitektur-billing.md`, `docs/arsitektur-login-universal.md`, `docs/arsitektur-fulfillment.md`, `docs/arsitektur-event.md`.

> **STATUS (2026-07-19): Fase 1, 2, 3, 4, 5, 7, 8 (Cicilan) SELESAI + cron reminder SELESAI.
> Fase 6 SEBAGIAN SELESAI (surat ✅, member_welcome ✅ + profile_incomplete_reminder ✅ [fitur
> baru di luar rencana awal], officer_invite 🔲 belum). Self-hosted VPS aktif dan tested.**
> GOWA berjalan di VPS jalakarta (72.61.215.7), subdomain `gowa.jalakarta.com`.
> Device `pc-ikpm-jogjakarta` aktif terhubung — QR scan, send message, status polling semua confirmed working.
> Lihat § 16 "Penyimpangan dari Desain Awal" untuk perbedaan antara dokumen ini dan kode aktual —
> termasuk § 16.8 (template editable per tenant + `notifyWa()` wrapper, ditambahkan di luar rencana awal).
> Bagian 3.2, 4, dan 10 menjelaskan **desain awal** (addon installation + quota) — kode aktual tidak memakai ini. Baca § 16 dulu.
> **Belum dikerjakan**: `officer_invite` (§ 6.5), quota enforcement (§ 16.2 — sengaja
> ditunda atas permintaan user 2026-07-15).

---

## 1. Visi & Tujuan

WhatsApp adalah kanal komunikasi utama di Indonesia — penetrasinya jauh lebih tinggi dari email.
jalakarta mengintegrasikan WA sebagai lapisan notifikasi universal yang:

1. **Meningkatkan konversi** — konfirmasi pembayaran real-time vs email yang sering diabaikan
2. **Mengurangi beban admin** — notifikasi otomatis menggantikan pesan manual
3. **Meningkatkan kepercayaan** — penerima tahu status pesanan/donasi/event mereka

WhatsApp Gateway adalah **add-on berbayar** (bukan modul inti) — tenant memilih untuk mengaktifkannya.

---

## 2. Infrastruktur

### 2.1 GOWA (go-whatsapp-web-multidevice)

Library open-source karya **aldinokemal** ([GitHub](https://github.com/aldinokemal/go-whatsapp-web-multidevice)).
Bekerja dengan WhatsApp Web Multi-Device — tidak memerlukan nomor bisnis berbayar.

**Cara kerja:**
- Admin scan QR code sekali via browser → sesi tersimpan permanen
- GOWA expose REST API 70+ endpoint termasuk: kirim pesan, cek status device, QR login
- Multi-account via `device_id` — satu instance GOWA melayani semua tenant

**Docker image:**
```
aldinokemal2104/go-whatsapp-web-multidevice:latest
```

**Autentikasi ke GOWA:**
- Basic Auth header: `Authorization: Basic base64(user:pass)`
- `device_id` dikirim via query param atau header `X-Device-Id`

### 2.2 Hosting: Self-Hosted di VPS jalakarta

> **Update 2026-06-30**: Sumopod (hosting sebelumnya) telah menutup layanan.
> GOWA sekarang berjalan di **VPS jalakarta yang sama** (72.61.215.7) via Docker.
>
> Detail lengkap deployment, Nginx config, langkah setup, monitoring:
> → **`docs/arsitektur-gowa-deployment.md`**

**Keputusan self-hosted:**
- Sumopod menutup layanan → tidak ada pilihan eksternal yang setara dari segi harga + latency
- GOWA adalah binary Go ringan: ~50MB base RAM, bukan Chromium-based yang boros
- VPS sudah punya Docker — menambah satu service sangat minim overhead
- Latency ~0ms (same machine vs cross-datacenter ke Sumopod)

**Service di `docker-compose.yml`:**
```yaml
gowa:
  image: aldinokemal2104/go-whatsapp-web-multidevice:latest
  restart: unless-stopped
  ports:
    - "3002:3000"   # host port 3002, agar tidak clash dengan Next.js (3000)
  volumes:
    - gowa_data:/app/storages
  environment:
    - BASIC_AUTH_CREDENTIAL=${WHATSAPP_API_USER}:${WHATSAPP_API_PASS}
```

**Environment variables di `.env.local` VPS:**
```env
# PM2 (Next.js) membaca ini
WHATSAPP_SERVICE_URL=https://gowa.jalakarta.com
WHATSAPP_API_USER=jalajogja
WHATSAPP_API_PASS=GANTI_DENGAN_PASSWORD_KUAT_MINIMAL_32_CHAR
```

**Nginx subdomain** `gowa.jalakarta.com` → `localhost:3002` + SSL via certbot.
QR image perlu akses dari browser admin → subdomain publik diperlukan (lihat § 8 dalam arsitektur-gowa-deployment.md).

### 2.3 Topologi

```
┌─────────────────────────────────────────────────────┐
│  VPS Utama (72.61.215.7)                            │
│                                                     │
│  ┌──────────────────┐    POST /send/message         │
│  │  Next.js (PM2)   │ ─────────────────────────────▶│
│  │  Port 3000       │ ◀─────────────────────────────│
│  └──────────────────┘    200 OK / ERROR             │
│                                                     │
│  ┌──────────────────┐    http://localhost:3002       │
│  │  GOWA (Docker)   │ ◀─────────────────────────────│
│  │  Port 3002       │ ─────────────────────────────▶│  WhatsApp
│  └──────────────────┘                               │
│                                                     │
│  ┌──────────────────┐                               │
│  │  PostgreSQL       │                              │
│  │  (settings tabel) │                              │
│  └──────────────────┘                               │
└─────────────────────────────────────────────────────┘

Browser admin → https://gowa.jalakarta.com (Nginx → localhost:3002)
             → lihat QR image (statics/qrcode/*.png)
```

### 2.4 GOWA API Endpoints (Confirmed Working — versi `latest` 2026-07-02)

| Operasi | Method | Path | Header / Body |
|---------|--------|------|---------------|
| Buat device | POST | `/devices` | Body JSON: `{"device_id": "slug"}`. Return 500 jika sudah ada (treat as success) |
| QR login | GET | `/app/login` | Header: `X-Device-Id: {slug}` |
| List devices / status | GET | `/app/devices` | Header: `X-Device-Id: {slug}`. Cek `results[].jid` — kosong = belum connect |
| Kirim pesan | POST | `/send/message` | Header: `X-Device-Id: {slug}`. Body: `{"phone":"628xxx@s.whatsapp.net","message":"..."}` |
| Logout / putuskan | GET | `/app/logout` | Header: `X-Device-Id: {slug}` |

**Quirks GOWA `latest`:**
- `POST /devices` return HTTP 500 (bukan 409) untuk device yang sudah ada → kode cek `text.includes("already exists")`
- QR link dari `/app/login` berisi `http://localhost:3002/...` → perlu rewrite ke `https://gowa.jalakarta.com/...`
- Phone format untuk send: `628xxx@s.whatsapp.net` (tanpa `+`, dengan suffix WA)
- Status terhubung: `jid !== ""` — format `628xxx@s.whatsapp.net` jika connected
- `GET /app/devices` **TIDAK di-filter oleh `X-Device-Id`** — selalu return SEMUA device
  terdaftar terlepas header apa yang dikirim (dikonfirmasi 2026-07-20). Header itu tetap WAJIB
  dikirim (server menolak 400 tanpanya), tapi jangan berharap response-nya ter-scope.

**Endpoint gaya baru (ditemukan 2026-07-20, tersedia di versi GOWA yang deploy saat ini —
BELUM dipakai kode kita, dicatat untuk referensi diagnosa/future work):**

| Operasi | Method | Path | Keterangan |
|---------|--------|------|------------|
| List devices | GET | `/devices` | Sertakan `state` per device (`"logged_in"`, dst) — lebih informatif dari `/app/devices` |
| Status 1 device | GET | `/devices/{id}/status` | `{is_connected, is_logged_in}` — **per-device sungguhan**, dipakai untuk diagnosa § 14.2 |
| Reconnect | POST | `/devices/{id}/reconnect` | Paksa reconnect device yang sesinya stale |
| Hapus device | DELETE | `/devices/{id}` | **Belum pernah dipakai kode kita** — `connectWhatsAppAction`/`deactivateWhatsAppAction` cuma logout (`/app/logout`), tidak pernah delete. Kandidat kalau nanti mau "Nonaktifkan" benar-benar menghapus device dari GOWA, bukan cuma logout. |

---

## 3. Schema Database

Schema ada di `packages/db/src/schema/public/`.

### 3.0 `public.otp_tokens` — OTP Verifikasi Phone (✅ Ditambahkan 2026-06-30)

```sql
-- migration 0016_otp_tokens.sql
CREATE TABLE public.otp_tokens (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  phone      TEXT        NOT NULL,          -- E.164: "+628xxx"
  code       TEXT        NOT NULL,          -- 6 digit string
  type       TEXT        NOT NULL CHECK (type IN ('register', 'reset_password')),
  slug       TEXT        NOT NULL,          -- tenant slug
  expires_at TIMESTAMPTZ NOT NULL,          -- DEFAULT: NOW() + 5 menit
  used_at    TIMESTAMPTZ,                   -- NULL = belum dipakai; NON-NULL = sudah dipakai
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_otp_tokens_phone_type ON public.otp_tokens (phone, type, expires_at);
```

**Aturan:**
- OTP berlaku 5 menit (`expires_at < now()` = kadaluarsa)
- OTP sekali pakai (`used_at IS NOT NULL` = sudah dipakai)
- Rate limit: max 3 OTP per phone per 60 menit (cek via `COUNT WHERE created_at > NOW() - 1 hour`)
- OTP lama yang belum dipakai dihapus sebelum insert baru (per phone+type)
- **Tidak pakai Redis** — cukup PostgreSQL dengan `expires_at` + `used_at`

### 3.1 `public.addons` — Katalog Add-on

Baris WA sudah di-seed di migration 0003:

| slug | nama | harga | quota/bulan |
|------|------|-------|-------------|
| `whatsapp-starter` | WhatsApp Starter | Rp 49.000 | 200 pesan |
| `whatsapp-pro` | WhatsApp Pro | Rp 129.000 | 1.000 pesan |
| `whatsapp-unlimited` | WhatsApp Unlimited | Rp 299.000 | ∞ |

### 3.2 `public.tenant_addon_installations` — Instalasi per Tenant

```typescript
// Field `config` untuk WhatsApp add-on (JSONB):
type WhatsAppConfig = {
  device_id:    string;        // "tenant-ikpm-001" — ID unik di GOWA
  phone_number: string;        // "6281234567890" — nomor yang di-scan
  verified:     boolean;       // true = sudah scan QR, koneksi aktif
  notifications: {
    // ── Billing / Pembayaran ──
    payment_submitted:        boolean; // customer upload bukti bayar
    payment_confirmed:        boolean; // admin konfirmasi pembayaran
    payment_rejected:         boolean; // admin tolak bukti bayar
    invoice_created:          boolean; // invoice baru dibuat untuk customer
    invoice_reminder:         boolean; // H-1 sebelum jatuh tempo
    // ── Toko / Pengiriman ──
    order_processing:         boolean; // admin mulai proses pesanan
    order_shipped:            boolean; // pesanan dikirim + resi
    order_delivered:          boolean; // pesanan tiba / selesai
    // ── Event ──
    event_registered:         boolean; // pendaftaran berhasil
    event_reminder:           boolean; // H-1 atau H-3 sebelum event
    event_certificate_ready:  boolean; // sertifikat siap diunduh
    // ── Donasi ──
    donation_received:        boolean; // konfirmasi donasi diterima
    // ── Anggota / Organisasi ──
    member_welcome:           boolean; // sambutan anggota baru
    officer_invite:           boolean; // link aktivasi pengurus
    // ── Surat ──
    letter_sign_request:      boolean; // notifikasi perlu TTD
    // ── OTP / Auth ──
    otp_register:             boolean; // OTP verifikasi saat daftar
    otp_reset_password:       boolean; // OTP reset password via WA
  };
};
```

### 3.3 `public.addon_usage` — Tracking Quota

```
tenant_id + addon_id + year + month → count
```
Satu row per tenant per bulan. `count` naik +1 setiap pesan terkirim berhasil.

---

## 4. Helper Pengiriman — `lib/whatsapp.ts`

> ⚠️ **Kode di bawah ini adalah DESAIN AWAL — lihat § 16.1, 16.2, 16.3 untuk perbedaan dari kode
> aktual** (tidak ada quota/addon_installations check di `sendWaNotification()` aktual). Untuk
> memanggil notifikasi dari business logic, **jangan** panggil `sendWaNotification()` langsung —
> pakai wrapper `notifyWa()` dari `lib/wa-notify.ts` (lihat § 16.8) yang sudah handle resolve
> orgName, URL absolut, dan template editable sekaligus.

File ini adalah **satu-satunya** entry point untuk kirim WA. Tidak ada fetch langsung ke GOWA dari kode lain.

```typescript
// apps/web/lib/whatsapp.ts

import { db, tenantAddonInstallations, addons, addonUsage, tenants } from "@jalajogja/db";
import { eq, and, sql } from "drizzle-orm";

export type WaNotifKey = keyof WhatsAppConfig["notifications"];

type SendOptions = {
  slug:    string;          // tenant slug
  event:   WaNotifKey;     // tipe notifikasi — cek toggle sebelum kirim
  to:      string;          // nomor tujuan dalam format E.164: "+6281234567890"
  message: string;          // teks pesan (sudah dirender dengan variabel)
};

export type WaSendResult =
  | { ok: true }
  | { ok: false; reason: "addon_inactive" | "event_disabled" | "quota_exceeded" | "send_failed" | "not_configured" };

/**
 * Kirim notifikasi WhatsApp untuk satu tenant.
 * Melakukan semua pengecekan sebelum kirim:
 * 1. Add-on WA aktif untuk tenant ini
 * 2. Toggle notifikasi untuk event ini diaktifkan admin
 * 3. Quota bulan berjalan belum habis
 * 4. Device terkoneksi di GOWA
 */
export async function sendWaNotification(opts: SendOptions): Promise<WaSendResult> {
  const { slug, event, to, message } = opts;

  // Ambil tenant ID
  const [tenantRow] = await db.select({ id: tenants.id })
    .from(tenants).where(eq(tenants.slug, slug)).limit(1);
  if (!tenantRow) return { ok: false, reason: "addon_inactive" };

  // Ambil instalasi add-on WA (salah satu dari tiga tier)
  const WA_SLUGS = ["whatsapp-starter", "whatsapp-pro", "whatsapp-unlimited"];
  const [installation] = await db
    .select({
      id:           tenantAddonInstallations.id,
      status:       tenantAddonInstallations.status,
      quotaMonthly: tenantAddonInstallations.quotaMonthly,
      config:       tenantAddonInstallations.config,
      addonQuota:   addons.quotaMonthly,
    })
    .from(tenantAddonInstallations)
    .innerJoin(addons, and(
      eq(addons.id, tenantAddonInstallations.addonId),
      sql`${addons.slug} = ANY(ARRAY[${sql.join(WA_SLUGS.map(s => sql`${s}`), sql`, `)}])`
    ))
    .where(and(
      eq(tenantAddonInstallations.tenantId, tenantRow.id),
      eq(tenantAddonInstallations.status, "active"),
    ))
    .limit(1);

  if (!installation) return { ok: false, reason: "addon_inactive" };

  const config = installation.config as WhatsAppConfig;
  if (!config.device_id || !config.verified) return { ok: false, reason: "not_configured" };

  // Cek toggle event
  if (!config.notifications?.[event]) return { ok: false, reason: "event_disabled" };

  // Cek quota
  const quota = installation.quotaMonthly ?? installation.addonQuota ?? null;
  if (quota !== null) {
    const now = new Date();
    const [usageRow] = await db
      .select({ count: addonUsage.count })
      .from(addonUsage)
      .where(and(
        eq(addonUsage.tenantId, tenantRow.id),
        eq(addonUsage.addonId, installation.id),
        eq(addonUsage.year, now.getFullYear()),
        eq(addonUsage.month, now.getMonth() + 1),
      ))
      .limit(1);

    if ((usageRow?.count ?? 0) >= quota) return { ok: false, reason: "quota_exceeded" };
  }

  // Kirim via GOWA
  const serviceUrl = process.env.WHATSAPP_SERVICE_URL;
  const user       = process.env.WHATSAPP_API_USER;
  const pass       = process.env.WHATSAPP_API_PASS;
  if (!serviceUrl || !user || !pass) return { ok: false, reason: "not_configured" };

  const basicAuth = Buffer.from(`${user}:${pass}`).toString("base64");
  const phone     = to.replace(/^\+/, "");  // GOWA expects tanpa +

  const res = await fetch(`${serviceUrl}/send/message`, {
    method:  "POST",
    headers: {
      "Authorization": `Basic ${basicAuth}`,
      "Content-Type":  "application/json",
      "X-Device-Id":   config.device_id,
    },
    body: JSON.stringify({ phone, message }),
  });

  if (!res.ok) return { ok: false, reason: "send_failed" };

  // Increment usage counter (upsert)
  const now = new Date();
  await db.insert(addonUsage).values({
    tenantId: tenantRow.id,
    addonId:  installation.id,
    year:     now.getFullYear(),
    month:    now.getMonth() + 1,
    count:    1,
  }).onConflictDoUpdate({
    target: [addonUsage.tenantId, addonUsage.addonId, addonUsage.year, addonUsage.month],
    set:    { count: sql`${addonUsage.count} + 1` },
  });

  return { ok: true };
}

// ── Helper: normalisasi nomor ke E.164 ───────────────────────────────────────
// Input: "08123456789" | "628123456789" | "+628123456789"
// Output: "+628123456789"
export function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("62"))  return `+${digits}`;
  if (digits.startsWith("0"))   return `+62${digits.slice(1)}`;
  return `+${digits}`;
}
```

---

## 5. Template Pesan per Event

> ⚠️ **Kode di bawah masih format LAMA** (fungsi JS `(v) => string`, sebelum direfaktor jadi
> editable). Kode aktual: `WA_TEMPLATE_DEFAULTS` adalah `Record<string, string>` dengan placeholder
> `{{var}}`, di-render via `renderTemplateString()`. Isi teksnya sama persis (cuma sintaksnya
> berubah dari `${v.x}` ke `{{x}}`) — lihat § 16.8 untuk detail lengkap + alasan perubahan.

Semua template ada di `lib/wa-templates.ts`. Format: teks biasa (tidak ada HTML).
WhatsApp mendukung bold `*teks*`, italic `_teks_`, monospace `` `teks` ``.

```typescript
// apps/web/lib/wa-templates.ts

export type WaTemplateVars = Record<string, string>;

const templates: Record<string, (v: WaTemplateVars) => string> = {

  // ── Billing ──────────────────────────────────────────────────────────────────

  payment_submitted: (v) =>
    `✅ *Bukti Pembayaran Diterima*\n\nHalo ${v.name}, bukti pembayaran untuk invoice *${v.invoiceNumber}* sudah kami terima.\n\nTotal: Rp ${v.amount}\n\nAdmin sedang memverifikasi. Kami akan konfirmasi segera. Terima kasih! 🙏`,

  payment_confirmed: (v) =>
    `🎉 *Pembayaran Dikonfirmasi*\n\nHalo ${v.name}, pembayaran Anda untuk *${v.invoiceNumber}* sudah dikonfirmasi.\n\nTotal: Rp ${v.amount}\n\nTerima kasih atas kepercayaan Anda kepada ${v.orgName}. 🙏`,

  payment_rejected: (v) =>
    `❌ *Bukti Pembayaran Ditolak*\n\nHalo ${v.name}, maaf bukti pembayaran untuk *${v.invoiceNumber}* tidak dapat diverifikasi.\n\nAlasan: ${v.reason}\n\nSilakan upload ulang bukti pembayaran atau hubungi admin.`,

  invoice_created: (v) =>
    `📄 *Invoice Baru*\n\nHalo ${v.name}, invoice *${v.invoiceNumber}* telah dibuat.\n\nTotal: Rp ${v.amount}\nJatuh Tempo: ${v.dueDate}\n\nLihat detail: ${v.invoiceUrl}`,

  invoice_reminder: (v) =>
    `⏰ *Pengingat Invoice*\n\nHalo ${v.name}, invoice *${v.invoiceNumber}* akan jatuh tempo besok (${v.dueDate}).\n\nTotal: Rp ${v.amount}\n\nSilakan lakukan pembayaran segera: ${v.invoiceUrl}`,

  // ── Toko / Pengiriman ─────────────────────────────────────────────────────────

  order_processing: (v) =>
    `🏭 *Pesanan Diproses*\n\nHalo ${v.name}, pesanan *${v.orderNumber}* sedang kami siapkan.\n\nEstimasi pengiriman: ${v.estimasi}\n\nTerima kasih sudah berbelanja di ${v.orgName}!`,

  order_shipped: (v) =>
    `🚚 *Pesanan Dikirim*\n\nHalo ${v.name}, pesanan *${v.orderNumber}* sudah dikirim!\n\nKurir: ${v.courier}\nNomor Resi: *${v.trackingNumber}*\n\nPantau pengiriman di: ${v.trackingUrl}`,

  order_delivered: (v) =>
    `✅ *Pesanan Selesai*\n\nHalo ${v.name}, pesanan *${v.orderNumber}* telah selesai.\n\nTerima kasih sudah berbelanja di ${v.orgName}! Semoga puas dengan produknya. 😊`,

  // ── Event ─────────────────────────────────────────────────────────────────────

  event_registered: (v) =>
    `🎫 *Pendaftaran Event Berhasil*\n\nHalo ${v.name}, pendaftaran Anda untuk *${v.eventName}* telah diterima.\n\nNomor Registrasi: *${v.regNumber}*\nTanggal: ${v.eventDate}\nTempat: ${v.location}\n\nDetail: ${v.eventUrl}`,

  event_reminder: (v) =>
    `📅 *Pengingat Event Besok*\n\nHalo ${v.name}, jangan lupa!\n\n*${v.eventName}*\n🗓 ${v.eventDate}\n📍 ${v.location}\n\nNomor Registrasi: ${v.regNumber}`,

  event_certificate_ready: (v) =>
    `🏆 *Sertifikat Siap Diunduh*\n\nHalo ${v.name}, sertifikat kehadiran untuk *${v.eventName}* sudah tersedia.\n\nUnduh sertifikat: ${v.certUrl}`,

  // ── Donasi ────────────────────────────────────────────────────────────────────

  donation_received: (v) =>
    `🤲 *Donasi Diterima*\n\nJazakumullahu khairan, ${v.name}!\n\nDonasi Anda untuk *${v.campaignName}* sebesar Rp ${v.amount} telah kami terima dan sedang diverifikasi.\n\nDoa kami menyertai kebaikan Anda. 🙏`,

  // ── Anggota ───────────────────────────────────────────────────────────────────

  member_welcome: (v) =>
    `🌟 *Selamat Datang di ${v.orgName}!*\n\nHalo ${v.name}, selamat bergabung!\n\nNomor Anggota: *${v.memberNumber}*\n\nLengkapi profil Anda di: ${v.profileUrl}\n\nWassalamu'alaikum wr. wb.`,

  officer_invite: (v) =>
    `📨 *Undangan Menjadi Pengurus*\n\nAssalamu'alaikum ${v.name},\n\nAnda diundang menjadi *${v.role}* di ${v.orgName}.\n\nAktifkan akun Anda melalui tautan berikut:\n${v.inviteUrl}\n\nTautan berlaku ${v.expiry}.`,

  // ── Surat ─────────────────────────────────────────────────────────────────────

  letter_sign_request: (v) =>
    `✍️ *Permintaan Tanda Tangan*\n\nAssalamu'alaikum ${v.name},\n\nAnda diminta untuk menandatangani surat:\n*${v.letterSubject}*\n${v.letterNumber ? `Nomor: ${v.letterNumber}\n` : ""}Silakan tanda tangan melalui tautan berikut:\n${v.signUrl}\n\nTautan berlaku 30 hari.`,

  // ── OTP ───────────────────────────────────────────────────────────────────────

  otp_register: (v) =>
    `🔐 *Kode Verifikasi ${v.orgName}*\n\nKode OTP Anda: *${v.otp}*\n\nBerlaku ${v.expiry} menit. Jangan bagikan kode ini kepada siapapun.`,

  otp_reset_password: (v) =>
    `🔑 *Reset Password ${v.orgName}*\n\nKode OTP untuk reset password Anda: *${v.otp}*\n\nBerlaku ${v.expiry} menit. Jika bukan Anda yang meminta, abaikan pesan ini.`,
};

export function renderWaTemplate(event: string, vars: WaTemplateVars): string | null {
  const fn = templates[event];
  if (!fn) return null;
  return fn(vars);
}
```

---

## 6. Peta Notifikasi per Modul

### 6.1 Billing & Pembayaran — ✅ SELESAI (2026-07-13/14, commit `e93318b`)

| Event | Trigger | Penerima | Template |
|-------|---------|----------|----------|
| Bukti bayar diterima | `submitPaymentProofAction` | Customer | `payment_submitted` |
| Pembayaran dikonfirmasi | `verifySubmittedPaymentAction` / `confirmInvoicePaymentAction` | Customer | `payment_confirmed` |
| Pembayaran ditolak | `rejectPaymentAction` | Customer | `payment_rejected` |
| Invoice baru | `checkoutAction` | Customer | `invoice_created` |
| Invoice jatuh tempo H-1 | Cron `invoice-reminder` | Customer | `invoice_reminder` |

**Nomor tujuan (kode aktual — berbeda dari desain awal):** BUKAN live lookup `resolveIdentity()`
saat kirim notifikasi — melainkan **snapshot** `invoices.customerPhone` yang sudah tersimpan saat
invoice dibuat (di-resolve sekali oleh `resolveIdentity()` di dalam `checkoutAction`, lalu disimpan
ke kolom `customer_phone`). Semua notifikasi billing berikutnya (submitted/confirmed/rejected)
tinggal baca kolom itu — tidak resolve ulang identitas tiap kali kirim notif.

### 6.2 Toko / Fulfillment — ✅ SELESAI (2026-07-15, commit `876fe91`)

| Event | Trigger | Penerima | Template |
|-------|---------|----------|----------|
| Pesanan diproses | `updateFulfillmentStatusAction` (→ processing) | Customer | `order_processing` |
| Pesanan dikirim | `updateFulfillmentStatusAction` (→ shipped) | Customer | `order_shipped` |
| Pesanan selesai | `updateFulfillmentStatusAction` (→ delivered) | Customer | `order_delivered` |

Stage `packed` sengaja TIDAK punya notifikasi (tidak ada template untuk itu). `trackingUrl` di
template diisi link halaman invoice publik (`/invoice/{id}`), BUKAN link tracking resi asli —
RajaOngkir tracking proxy (`/api/ongkir/track`) belum dibuat (technical debt terpisah, lihat
`docs/arsitektur-fulfillment.md`).

### 6.3 Event — ✅ SELESAI (2026-07-15, commit `876fe91`)

| Event | Trigger | Penerima | Template |
|-------|---------|----------|----------|
| Registrasi berhasil (alur direct) | `registerForEventAction` | Peserta | `event_registered` |
| Registrasi berhasil (alur cart/E10) | Auto-create block di `confirmInvoicePaymentAction` / `verifySubmittedPaymentAction` | Peserta | `event_registered` |
| Pengingat H-1 | Cron `event-reminder` | Peserta confirmed | `event_reminder` |
| Sertifikat siap | `POST /api/events/[id]/certificate/[regId]` (selesai upload MinIO) | Peserta attended | `event_certificate_ready` |

**`event_registered` sengaja punya DUA trigger berbeda** (bukan duplikat, dua alur berbeda):
1. Alur **direct** (bukan cart) — `registerForEventAction` fire segera setelah insert registrasi
   (gratis maupun berbayar). Satu-satunya touchpoint untuk alur ini karena `createLinkedInvoice`
   (dipakai di sini untuk tiket berbayar) hidup di `packages/db` — package terpisah yang **tidak
   bisa** import `apps/web/lib/wa-notify.ts` (arah dependency: apps/web → packages/db, bukan
   sebaliknya). Tiket berbayar via alur direct karena itu tidak pernah dapat `invoice_created`.
2. Alur **cart (E10 donation prompt)** — auto-create block di dua fungsi konfirmasi pembayaran
   billing, fire setelah `event_registrations` ter-insert dari tiket cart. Titik PERTAMA nomor
   registrasi ada untuk alur ini (tidak ada sebelumnya) — TIDAK redundan dengan `payment_confirmed`
   generik yang fire di titik yang sama (pesan beda: satu soal pembayaran, satu soal detail tiket).

### 6.4 Donasi — ✅ SELESAI (2026-07-15, commit `876fe91`)

| Event | Trigger | Penerima | Template |
|-------|---------|----------|----------|
| Donasi diterima | `submitPaymentProofAction` (per item `itemType='donation'`) | Donatur | `donation_received` |
| Donasi dikonfirmasi | `verifySubmittedPaymentAction` / `confirmInvoicePaymentAction` | Donatur | `payment_confirmed` |

**Trigger `donation_received` beda dari rencana awal di atas** (yang menyebut `checkoutAction`) —
dipindah ke `submitPaymentProofAction` karena teks template eksplisit *"telah kami terima dan
**sedang diverifikasi**"* — semantiknya cocok dengan tahap submit-bukti-bayar, bukan tahap
checkout/buat-invoice (belum ada apa-apa yang "diterima" saat itu). Query invoice diambil per
`invoice_items WHERE itemType='donation'` (satu invoice bisa campur produk+tiket+donasi),
`campaignName` = `item.name` (sudah snapshot nama campaign sejak `addToCartAction`, tidak perlu
JOIN ke tabel campaigns).

**Scope yang sengaja tidak disentuh**: `createDonationAction`/`confirmDonationAction`
(`donasi/actions.ts`) — jalur admin manual untuk donasi offline/cash. Ini alur **legacy**
(`donations` table historis, lihat § "Donasi = Alur Cart Universal" di CLAUDE.md) — donatur via
cart (jalur aktif) sudah tercakup penuh di atas.

### 6.5 Anggota & Pengurus — SEBAGIAN SELESAI (2026-07-15)

| Event | Trigger | Penerima | Template |
|-------|---------|----------|----------|
| Anggota baru | `POST /api/akun/member-education` (step 3 wizard `/akun/lengkapi` selesai) | Anggota | `member_welcome` |
| Pengingat lengkapi profil | Cron `profile-incomplete-reminder` (14 hari setelah welcome, sekali kirim) | Anggota | `profile_incomplete_reminder` |
| Undangan pengurus | `createInviteAction` | Calon pengurus | `officer_invite` — **belum dikerjakan** |

**`member_welcome` trigger BERUBAH dari rencana awal** (yang menyebut `createMemberAction`, alur
admin) — dipindah ke selesainya wizard self-service `/akun/lengkapi` karena Step 1 admin wizard
tidak punya field nomor HP sama sekali (nomor baru diisi Step 2, seringkali sesi terpisah) — tidak
ada nomor tujuan valid di titik `createMemberAction`. Kolom idempoten `members.welcome_sent_at` +
`members.welcome_sent_tenant_slug` (migration `0029` + `0030`) mencegah kirim berulang.

**`profile_incomplete_reminder` — fitur baru di luar 7 fase rencana awal**, muncul dari diskusi
`member_welcome`. Kondisi kirim (dikunci setelah klarifikasi berulang dengan user): riwayat
pendidikan kosong ATAU (usaha DAN pesantren DAN profesional kosong semua). Cron
`app/api/cron/profile-incomplete-reminder/route.ts` — **tidak loop per tenant** (beda dari
invoice-reminder/event-reminder) karena data member semuanya di `public` schema, cukup satu scan
global + batch-count 4 tabel. Kirim via `welcome_sent_tenant_slug` (tenant yang sama dengan saat
welcome dulu terkirim). Sekali kirim saja (`profile_reminder_sent_at` flag), bukan berulang.

`officer_invite` (`createInviteAction`) masih genuinely belum dikerjakan — dicek via grep
2026-07-15, nol hasil `notifyWa()` di file itu.

### 6.6 Surat — ✅ SELESAI (2026-07-15, commit `876fe91`)

| Event | Trigger | Penerima | Template |
|-------|---------|----------|----------|
| Permintaan TTD | `syncSignatureSlotsAction` (slot dapat token baru) | Officer (per slot) | `letter_sign_request` |

**Catatan:** Kirim hanya ke officer yang slotnya dapat token BARU (insert slot baru / officer
berubah / token hilang). Officer yang tokennya dipertahankan (officer sama, link lama masih
berlaku) TIDAK dapat notif ulang. Resolusi nomor: `officers.memberId → public.members.contactId →
public.contacts.(whatsapp || phone)` — 3-level cross-schema lookup, di-batch (bukan per-officer
query) untuk efisiensi saat ada banyak slot dalam satu surat.

### 6.7 Auth / OTP — ✅ SELESAI (2026-06-30)

| Event | Trigger | Penerima | Template |
|-------|---------|----------|----------|
| OTP daftar | `POST /api/akun/send-otp` (type=register) | Pendaftar | `otp_register` |
| OTP reset password | `POST /api/akun/send-otp` (type=reset_password) | User | `otp_reset_password` |

**Kondisi aktif:** hanya jika admin mengaktifkan toggle "OTP Daftar Akun" / "OTP Reset Password"
di `/app/{slug}/settings/notifications`.

**Alur register dengan OTP:**
1. User isi form → klik Daftar
2. Front-end cek `GET /api/wa/available?slug=` → jika `registerOtp=true`
3. `POST /api/akun/send-otp` → OTP terkirim ke nomor HP user
4. User masukkan 6 digit kode → `POST /api/akun/verify-otp`
5. Jika valid → lanjut `POST /api/akun/register`
6. Jika WA tidak dikonfigurasi → skip OTP, langsung daftar

**Alur forgot-password dengan OTP:**
1. User buka `/forgot-password` → tab "Via WhatsApp" muncul jika `resetOtp=true`
2. User masukkan nomor HP → `POST /api/akun/send-otp` (type=reset_password)
3. User masukkan 6 digit kode → `POST /api/akun/verify-otp`
4. Server cari `betterAuthUserId` dari nomor → inject token ke `public.verification`
5. Redirect ke `/{slug}/reset-password?token={token}` → halaman reset existing bekerja normal

### 6.8 Cicilan — ✅ SELESAI (2026-07-19)

> Detail lengkap: `docs/arsitektur-billing.md` § "Program Cicilan — Detail" → "Fase C".
> Lesson CLAUDE.md "[2026-07-19] Notifikasi WhatsApp untuk Program Cicilan — 5 Event Baru".

| Event | Trigger | Penerima | Template |
|-------|---------|----------|----------|
| Invoice diubah jadi cicilan | `convertInvoiceToInstallmentAction` | Customer | `installment_converted` |
| Bukti bayar termin diterima | `submitPaymentProofAction` (tambahan, jika `installmentPlanId` terisi) | Customer | `installment_payment_submitted` |
| Pembayaran termin dikonfirmasi | `confirmInvoicePaymentAction` / `verifySubmittedPaymentAction` (tambahan, HANYA jika masih ada termin tersisa) | Customer | `installment_payment_confirmed` |
| Pengingat termin H-1 | Cron `installment-reminder` | Customer | `installment_reminder` |
| Pengingat termin hari ini | Cron `installment-reminder` | Customer | `installment_due_today` |

**Pelunasan penuh cicilan TIDAK dapat notifikasi khusus** — cukup `payment_confirmed` +
`event_registered` standar (sudah otomatis benar sejak Fase B, keputusan eksplisit user: "kalau
lunas ya notifikasi standar seperti biasa"). Guard `newStatus !== "paid"` di
`installment_payment_confirmed` bergantung pada `invoices.uniqueCode` di-nolkan saat konversi
(bug ditemukan+difix di audit pra-commit sesi ini — lihat `arsitektur-billing.md`) — tanpa fix
itu, invoice cicilan tidak pernah benar-benar mencapai `newStatus === "paid"` dan notifikasi ini
akan terkirim berulang tanpa henti.

Cron `app/api/cron/installment-reminder/route.ts` — **terpisah** dari `invoice-reminder` karena
`invoices.dueDate` di-freeze ke termin pertama saja saat konversi (tidak pernah diupdate untuk
termin ke-2 dst) — reminder termin ke-2 dst hanya bisa dideteksi dari
`installment_schedules.due_date`. **Belum dijadwalkan di crontab VPS.**

---

## 7. Dashboard Admin — Setup & Konfigurasi

Route: `/app/{slug}/settings/notifications` — tab "WhatsApp"

### 7.1 Alur Setup

```
1. Admin klik "Hubungkan WhatsApp"
2. System call GOWA: POST /devices { device_id: slug } (idempotent — 500 jika sudah ada = ok)
3. System simpan whatsapp_config ke tenant.settings (device_id, verified: false)
4. Frontend tampilkan QR modal → GET /api/wa/qr → GET /app/login + X-Device-Id → QR image
5. Admin scan QR dengan nomor WA organisasi
6. Frontend polling GET /api/wa/status tiap 3 detik → GET /app/devices → cek jid != ""
7. Setelah terdeteksi terhubung → confirmWaConnectionAction → verified: true, phone_number tersimpan
8. Modal tutup, toggle notifikasi muncul
9. Admin aktifkan toggle yang diinginkan → Simpan
```

### 7.2 State Machine Koneksi

```
unregistered → scanning (QR ditampilkan) → connected → disconnected
                                                    ↑              ↓
                                              (reconnect)    (scan ulang)
```

### 7.3 UI Component

```
/app/{slug}/settings/notifications → <WhatsAppSetupClient>
  ├── Section "Koneksi"
  │   ├── Status badge: ● Terhubung (nomor +6281xxx) | ○ Belum terhubung
  │   ├── Tombol "Scan QR" → modal dengan QR + polling status tiap 3 detik
  │   └── Tombol "Putuskan Koneksi"
  └── Section "Toggle Notifikasi" (hanya tampil jika sudah terhubung)
      ├── Group: Pembayaran (4 toggle)
      ├── Group: Toko & Pengiriman (3 toggle)
      ├── Group: Event (3 toggle)
      ├── Group: Donasi (1 toggle)
      ├── Group: Anggota & Pengurus (2 toggle)
      ├── Group: Surat (1 toggle)
      └── Group: Verifikasi (OTP) — ✅ ditambahkan 2026-06-30
          ├── OTP Daftar Akun (otp_register)
          └── OTP Reset Password (otp_reset_password)
```

---

## 8. API Routes

### 8.1 QR Code untuk Setup

```
GET /api/wa/qr?slug={slug}
  → Fetch QR dari GOWA untuk device_id tenant ini
  → Return { qrBase64: "data:image/png;base64,..." }
  → Auth: harus admin tenant
```

### 8.2 Status Device

```
GET /api/wa/status?slug={slug}
  → Check device status di GOWA
  → Return { connected: boolean, phone: string | null }
  → Dipakai oleh frontend polling tiap 5 detik saat modal QR terbuka
```

### 8.3 Ketersediaan WA untuk Frontend

```
GET /api/wa/available?slug={slug}
  Publik, tidak perlu auth — hanya return boolean.
  Return: { available: boolean, registerOtp: boolean, resetOtp: boolean }
  Dipakai: register form + forgot-password untuk memutuskan tampilkan OTP step atau tidak.
```

### 8.4 Kirim OTP — ✅ SELESAI

```
POST /api/akun/send-otp
Body: { phone: string, type: "register" | "reset_password", slug: string }
  → toE164(phone)
  → Rate limit: max 3 OTP per phone per 60 menit (cek DB)
  → Hapus OTP lama belum dipakai untuk phone+type ini
  → Generate 6 digit: Math.floor(100000 + Math.random() * 900000)
  → INSERT public.otp_tokens (expires_at = NOW() + 5 menit)
  → renderWaTemplate(eventKey, { orgName, otp, expiry: "5" })
  → sendWaNotification(...)
  → Return { ok: true, expiresIn: 5 } | 429 jika rate limit | 503 jika WA belum dikonfigurasi
```

### 8.5 Verifikasi OTP — ✅ SELESAI

```
POST /api/akun/verify-otp
Body: { phone: string, code: string, type: "register" | "reset_password", slug: string }
  → Cari OTP: phone + code + type, expires_at > now(), used_at IS NULL
  → Jika tidak ketemu → 400 "Kode tidak valid"
  → UPDATE otp_tokens SET used_at = now()

  Jika type = "register":
    → Return { valid: true }
    → Frontend lanjut POST /api/akun/register

  Jika type = "reset_password":
    → findBetterAuthUserByPhone(phone)
        cek profiles.phone (akun publik)
        cek contacts.whatsapp/phone → members.betterAuthUserId (anggota IKPM)
    → Jika tidak ditemukan → 404 "Nomor tidak terdaftar"
    → generateToken24() → hex string 24 karakter via crypto.getRandomValues
    → INSERT public.verification { identifier: "reset-password:{token}", value: betterAuthUserId, expiresAt: +15 menit }
    → Return { valid: true, token: string }
    → Frontend redirect ke /{slug}/reset-password?token={token}
    → Halaman reset-password yang sudah ada (authClient.resetPassword) bekerja tanpa modifikasi
```

---

## 9. Cron Jobs — ✅ SELESAI (2026-07-14/15, commit `8ae10ff`)

Dua cron job, dijadwalkan via **crontab VPS** (bukan `CronCreate` platform — belum ada mekanisme
in-app untuk cron per-tenant). Auth: header `x-cron-secret` dicek terhadap `process.env.CRON_SECRET`,
pola sama dengan `cleanup-images`/`verify-domains` yang sudah lebih dulu ada.

### 9.1 Invoice Reminder (Harian)

```
Schedule: 0 8 * * *   (setiap hari jam 8 pagi, dikonfigurasi manual via crontab -e)
File: apps/web/app/api/cron/invoice-reminder/route.ts

Logic (kode aktual — lebih ketat dari rencana awal):
- Per tenant aktif, cari invoice dengan status IN ('pending', 'partial') — BUKAN "!= paid"
  (menghindari kirim reminder ke invoice waiting_verification/cancelled/overdue yang tidak relevan)
  DAN due_date = TOMORROW
- amount dihitung (total + uniqueCode) - paidAmount — sisa tagihan sesungguhnya, bukan total mentah
  (konsisten dengan aturan kode unik yang dikunci di docs/arsitektur-kode-unik.md)
- Untuk setiap invoice dengan customerPhone: kirim notif via notifyWa()
```

### 9.2 Event Reminder (Harian)

```
Schedule: 0 9 * * *   (setiap hari jam 9 pagi, dikonfigurasi manual via crontab -e)
File: apps/web/app/api/cron/event-reminder/route.ts

Logic:
- Per tenant aktif, cari event status='published' dengan starts_at::date = TOMORROW
- Per event, cari registrasi status='confirmed'
- eventDate diformat timezone Asia/Jakarta eksplisit + suffix "WIB"
- Kirim pengingat ke tiap peserta dengan attendeePhone via notifyWa()
```

**Tidak ada safety-gate tanggal di kedua cron ini** (beda dengan `cleanup-member-media-legacy` yang
punya `CLEANUP_CUTOFF` hardcoded) — begitu dijadwalkan di crontab, langsung aktif kirim notifikasi
H-1 real. Sudah dijadwalkan di VPS production per 2026-07-15.

---

## 10. Quota Enforcement

```typescript
// Aturan enforcement — sudah ada di helper sendWaNotification():
// 1. Cek installation.status = "active"
// 2. Cek config.verified = true
// 3. Cek config.notifications[event] = true
// 4. Ambil quota: installation.quotaMonthly ?? addons.quotaMonthly ?? null
// 5. Jika quota != null: cek addon_usage.count < quota
// 6. Kirim → increment addon_usage.count

// Tier quota:
// whatsapp-starter:   200 pesan/bulan
// whatsapp-pro:     1.000 pesan/bulan
// whatsapp-unlimited: null (tidak ada limit)
```

Ketika quota tercapai → `WaSendResult { ok: false, reason: "quota_exceeded" }`.
Tidak ada retry otomatis. Admin melihat quota di dashboard.

---

## 11. Integrasi ke Action yang Sudah Ada

> ⚠️ **Contoh di bawah pakai API LAMA** (`sendWaNotification` + `renderWaTemplate` langsung). Kode
> aktual di `verifySubmittedPaymentAction` (dan semua titik notifikasi lain sejak Fase 3) pakai
> `notifyWa()` dari `lib/wa-notify.ts` — jauh lebih ringkas, tidak perlu `toE164()`/`formatRupiah()`
> manual. Contoh kode aktual:
> ```typescript
> import { notifyWa, waRupiah } from "@/lib/wa-notify";
>
> void notifyWa({
>   slug, tenantDb, event: "payment_confirmed",
>   phone: inv.customerPhone,   // sudah E.164 sejak disimpan saat checkout
>   vars: { name: inv.customerName, invoiceNumber: inv.invoiceNumber, amount: waRupiah(data.amount) },
> });
> ```
> `orgName` TIDAK perlu diisi manual — `notifyWa()` resolve otomatis dari settings tenant kalau
> tidak disertakan di `vars`. Lihat § 16.8 untuk detail lengkap.

Contoh integrasi lama (desain awal, sudah tidak dipakai) ke `verifySubmittedPaymentAction` (billing):

```typescript
// Di apps/web/app/(dashboard)/app/[tenant]/finance/billing/actions.ts
// Setelah konfirmasi pembayaran berhasil:

import { sendWaNotification, toE164 } from "@/lib/whatsapp";
import { renderWaTemplate } from "@/lib/wa-templates";

// Setelah update invoice.status = "paid":
const phone = customerPhone ? toE164(customerPhone) : null;
if (phone) {
  const message = renderWaTemplate("payment_confirmed", {
    name:          customerName ?? "Pelanggan",
    invoiceNumber: invoice.invoiceNumber ?? "",
    amount:        formatRupiah(invoice.total),
    orgName:       orgName,
  });
  if (message) {
    void sendWaNotification({ slug, event: "payment_confirmed", to: phone, message });
  }
}
// void = fire-and-forget, tidak memblokir response admin
```

**Aturan penting (tetap berlaku di kode aktual):**
- `void notifyWa(...)` — selalu fire-and-forget, JANGAN await di action utama
- Kegagalan WA tidak boleh menyebabkan action utama gagal
- Log error WA terpisah dari log bisnis (`notifyWa()` sudah `try/catch` internal + `console.error`)

---

## 12. Rencana Implementasi (Fase)

### Fase 1 — Infrastruktur (Prerequisite) — ✅ SELESAI

- [x] Deploy GOWA di VPS jalakarta (Docker, port 3002) — migrasi dari Sumopod 2026-07-02
- [x] Nginx subdomain `gowa.jalakarta.com` → localhost:3002 + SSL certbot
- [x] Set environment variables di VPS: `WHATSAPP_SERVICE_URL`, `WHATSAPP_API_USER`, `WHATSAPP_API_PASS`
- [x] Buat `apps/web/lib/whatsapp.ts` — helper utama (lihat § 16 untuk perbedaan dari desain awal)
- [x] Buat `apps/web/lib/wa-templates.ts` — 17 template
- [x] Scan QR pertama kali — verifikasi koneksi (device `pc-ikpm-jogjakarta`, nomor +6282233322202)
- [x] Fix endpoint GOWA versi `latest` — lihat § 2.4 untuk daftar endpoint yang benar

### Fase 2 — Dashboard Setup Admin — ✅ SELESAI (2026-06-06)

- [x] UI setup koneksi WA di `/app/{slug}/settings/notifications` — `WhatsAppSetupClient`
- [x] API: `GET /api/wa/qr` dan `GET /api/wa/status`
- [x] Server actions: `connectWhatsAppAction`, `confirmWaConnectionAction`, `disconnectWhatsAppAction`, `saveWaNotificationSettingsAction`

### Fase 3 — Notifikasi Billing — ✅ SELESAI (2026-07-13/14, commit `e93318b`)

- [x] `checkoutAction` → `invoice_created`
- [x] `submitPaymentProofAction` → `payment_submitted`
- [x] `verifySubmittedPaymentAction` → `payment_confirmed`
- [x] `confirmInvoicePaymentAction` → `payment_confirmed`
- [x] `rejectPaymentAction` → `payment_rejected`
- [x] **Bonus di luar rencana awal**: teks semua notifikasi jadi editable per tenant
      (`tenant.settings` key=`wa_message_templates`) — lihat § 13 poin 4 yang diupdate

### Fase 4 — Notifikasi Toko & Fulfillment — ✅ SELESAI (2026-07-15, commit `876fe91`)

- [x] `updateFulfillmentStatusAction` → `order_processing` saat processing
- [x] `updateFulfillmentStatusAction` → `order_shipped` saat shipped
- [x] `updateFulfillmentStatusAction` → `order_delivered` saat delivered

### Fase 5 — Notifikasi Event & Donasi — ✅ SELESAI (2026-07-15, commit `876fe91`)

- [x] `registerForEventAction` → `event_registered` (alur direct)
- [x] Auto-create block `confirmInvoicePaymentAction`/`verifySubmittedPaymentAction` → `event_registered` (alur cart/E10)
- [x] `POST /api/events/[id]/certificate/[regId]` → `event_certificate_ready`
- [x] `submitPaymentProofAction` (bukan `checkoutAction` — lihat § 6.4) → `donation_received`
- [x] Cron `invoice-reminder` + `event-reminder` — SELESAI di § 9 (commit `8ae10ff`, dikerjakan
      terpisah sebagai "Fase B" sebelum Fase 4-6 dimulai)

### Fase 6 — Notifikasi Organisasi — SEBAGIAN SELESAI (2026-07-15)

- [x] `syncSignatureSlotsAction` → `letter_sign_request` (slot dapat token baru) — commit `876fe91`
- [x] `POST /api/akun/member-education` (step 3 wizard) → `member_welcome` — trigger dipindah dari
      `createMemberAction` (lihat § 6.5 untuk alasan)
- [x] Cron `profile-incomplete-reminder` → `profile_incomplete_reminder` — **fitur baru di luar
      rencana awal**, lihat § 6.5
- [ ] `createInviteAction` → `officer_invite` — **belum dikerjakan**

### Fase 7 — OTP via WA — ✅ SELESAI (2026-06-30)

- [x] `public.otp_tokens` table + Drizzle schema (`packages/db/migrations/0016_otp_tokens.sql`)
- [x] `GET /api/wa/available` — cek toggle OTP aktif atau tidak (untuk conditional UI)
- [x] `POST /api/akun/send-otp` — generate + kirim OTP, rate limit 3/jam
- [x] `POST /api/akun/verify-otp` — verifikasi; inject Better Auth token untuk reset_password
- [x] Register form — OTP step sebelum buat akun (kondisional: jika WA aktif)
- [x] Forgot-password — tab "Via WhatsApp" + alur OTP → redirect ke reset-password
- [x] `WhatsAppSetupClient` — toggle "OTP Daftar Akun" dan "OTP Reset Password"

**Migration yang perlu dijalankan di production:**
```bash
psql -U jalakarta -d jalakarta -f packages/db/migrations/0016_otp_tokens.sql
```

### Fase 8 — Notifikasi Cicilan — ✅ SELESAI (2026-07-19)

- [x] `convertInvoiceToInstallmentAction` → `installment_converted`
- [x] `submitPaymentProofAction` (tambahan) → `installment_payment_submitted`
- [x] `confirmInvoicePaymentAction`/`verifySubmittedPaymentAction` (tambahan, hanya jika masih
      ada termin tersisa) → `installment_payment_confirmed`
- [x] Cron baru `installment-reminder` → `installment_reminder` (H-1) + `installment_due_today` (hari-H)
- [x] Fix pendamping: `convertInvoiceToInstallmentAction` nolkan `invoices.uniqueCode` saat
      konversi (bug ditemukan saat audit pra-commit — tanpa ini invoice cicilan tidak pernah
      benar-benar mencapai `newStatus === "paid"`, lihat `docs/arsitektur-billing.md`)

**Belum dijadwalkan di crontab VPS** — perlu ditambahkan manual setelah deploy, pola sama cron lain.

---

## 13. Keputusan Desain yang Dikunci

1. **Satu GOWA untuk semua tenant** — dipisahkan via `device_id`, bukan instance terpisah
2. **Self-hosted di VPS jalakarta** — GOWA adalah binary Go ringan (~50MB RAM), overhead minimal di VPS yang sama. Sumopod tutup 2026-06-30.
3. **Fire-and-forget** — notifikasi WA tidak boleh memblokir response action utama
4. ~~**Template di kode** — tidak di DB~~ — **DIREVISI 2026-07-13** (commit `e93318b`): teks
   template sekarang **editable per tenant**. Default seed tetap di kode (`WA_TEMPLATE_DEFAULTS` di
   `lib/wa-templates.ts`, format string `{{var}}` — bukan lagi fungsi JS), tapi admin bisa override
   via UI `/settings/notifications` → tersimpan `tenant.settings` key=`wa_message_templates`.
   Render pakai `renderTemplateString()` — **string replace murni, bukan `eval`/`Function()`** —
   tetap aman dari code injection meski teksnya bisa diedit admin. Lihat § 16.8.
5. **Add-on berbayar** — tenant harus aktifkan dan bayar untuk fitur ini **(belum diimplementasikan
   — lihat § 16.2, saat ini gratis/unlimited untuk semua tenant yang setup sendiri)**
6. **Nomor dari DB** — tidak pernah dari form input user pada saat kirim; selalu dari `contacts.whatsapp` atau `contacts.phone` yang sudah tersimpan dan divalidasi. Untuk notifikasi billing, dari snapshot `invoices.customerPhone` (lihat § 6.1).

---

## 14. Known Risks & Mitigasi

| Risiko | Dampak | Mitigasi |
|--------|--------|----------|
| WhatsApp ban nomor | Gateway mati | Gunakan nomor dedicated organisasi, bukan nomor pribadi |
| GOWA tidak support versi WA terbaru | Gateway mati | Monitor repo aldinokemal, update berkala |
| VPS downtime | Notifikasi tertunda | Monitor uptime VPS; GOWA auto-restart via `restart: unless-stopped` di Docker |
| Spam ke customer | Reputasi buruk | Toggle per event + quota + opt-out mechanism |
| Credential bocor | Security breach | Env vars di server saja, tidak pernah ke frontend |
| **Nomor baru diblokir WA (§ 14.1)** | **OTP/notifikasi gagal untuk kontak baru** | **Kirim pesan manual dari HP dulu ke beberapa kontak sebelum mengandalkan OTP otomatis; tunggu beberapa hari** |

### 14.1 WhatsApp "Reach-Out Timelock" (Error 463) — Nomor Baru Diblokir Kirim ke Kontak Baru

**Ditemukan 2026-07-20** saat diagnosa laporan user: OTP login gagal (503) khusus di tenant
`pc-ikpm-jogjakarta`, padahal di tenant `visikita` (nomor WA sudah lama aktif sejak 2026-07-08)
normal. Root cause dikonfirmasi langsung dari log container GOWA (`docker compose logs gowa`),
persis di jam yang sama dengan percobaan gagal:

```
level=error msg="Panic recovered in middleware: WhatsApp rejected this send with error 463
(reach-out timelock). This is WhatsApp's server-side anti-spam restriction on starting new
chats and cannot be bypassed by the API. It usually means there is no prior conversation with
this recipient, or the sending account is temporarily restricted from reaching new contacts...
Newly-linked or low-activity numbers are affected most."
```

**Ini BUKAN bug di kode kita, BUKAN pula masalah arsitektur multi-device GOWA** — ini
**restriksi anti-spam dari WhatsApp sendiri** yang berlaku di level platform, di luar kendali
GOWA maupun aplikasi kita ("cannot be bypassed by the API"). Nomor WA yang **baru saja
ditautkan** (device `pc-ikpm-jogjakarta` dibuat ulang jam 16:53, percobaan OTP gagal jam 16:55 —
selisih 2 menit) diblokir WhatsApp dari memulai percakapan BARU dengan kontak yang belum pernah
mengirim pesan ke nomor itu duluan. Ini SANGAT relevan untuk alur OTP — by design, target OTP
(customer yang login) hampir selalu kontak yang belum pernah chat dengan nomor WA organisasi.

**Verifikasi yang membedakan "device tidak terhubung" vs "kena reach-out timelock"**: dites
langsung via `POST /send/message` — kirim ke NOMOR SENDIRI (nomor yang sama dengan device itu
sendiri) berhasil (`200 OK`, karena bukan "kontak baru" dari sudut pandang WhatsApp), tapi
mengirim ke nomor customer BARU tetap kena 463 selama restriksi belum reda. Kalau butuh
diagnosa serupa di masa depan: cek `docker compose logs gowa | grep -i "463\|reach-out"` dulu
sebelum curiga ke kode aplikasi atau konfigurasi `verified`/`device_id`.

**Mitigasi (sesuai saran WhatsApp sendiri di pesan error)**: kirim beberapa pesan manual dari HP
yang ditautkan ke beberapa kontak dulu setelah pairing baru, jangan langsung andalkan OTP
otomatis ke kontak yang benar-benar baru dalam beberapa jam/hari pertama. Restriksi ini
melonggar seiring waktu begitu nomor membangun riwayat pengiriman yang wajar (bukan langsung
spam massal ke kontak asing). **Tidak ada cara memperbaikinya dari sisi kode** — mengulang
retry otomatis TIDAK akan membantu selama restriksi masih aktif.

### 14.2 Multi-Device GOWA — Genuinely Konkuren, Bukan "Satu Aktif dalam Satu Waktu"

**Klarifikasi arsitektur** (ditanyakan user 2026-07-20, dikonfirmasi via dokumentasi resmi
[aldinokemal/go-whatsapp-web-multidevice](https://github.com/aldinokemal/go-whatsapp-web-multidevice)
+ tes langsung ke instance produksi): **YA, setiap device_id benar-benar independen dan bisa
aktif bersamaan** — GOWA menjalankan satu `whatsmeow.Client` terpisah per device, di-route via
header `X-Device-Id`, TIDAK ada batasan "cuma satu device aktif dalam satu waktu". Dikonfirmasi
langsung: `GET /devices/{id}/status` untuk `pc-ikpm-jogjakarta` DAN `visikita` sama-sama
`is_connected: true, is_logged_in: true` secara bersamaan, dan `POST /send/message` ke
keduanya sukses independen satu sama lain.

**Label "Use" / "Selected" yang terlihat di dashboard `gowa.jalakarta.com`** adalah UI STATE
milik dashboard bawaan GOWA itu sendiri (komponen frontend `DeviceManager.js` — "manages the
selection state... to update the global device context") — murni menentukan device mana yang
sedang DITAMPILKAN/dikelola di tab dashboard itu saat itu (mis. untuk generate QR baru dari
UI-nya sendiri), **SAMA SEKALI TIDAK MEREPRESENTASIKAN** apakah device tersebut sedang bisa
mengirim pesan via API. Aplikasi kita TIDAK PERNAH memakai dashboard GOWA untuk operasional —
semua panggilan API kita selalu eksplisit membawa `X-Device-Id`, jadi status "Use"/"Selected" di
dashboard itu tidak relevan sama sekali untuk kita. Jangan jadikan tampilan itu sebagai sinyal
diagnosa — pakai `GET /devices/{id}/status` (endpoint gaya baru, per-device) untuk cek live
status sungguhan.

### 14.3 Satu GOWA Server untuk Semua Tenant — TIDAK Berkontribusi ke Reach-Out Timelock

**Pertanyaan susulan user**: apakah restriksi 463 (§ 14.1) terjadi karena jalakarta.com pakai
**satu instance GOWA yang sama** untuk semua tenant (multi-device via `X-Device-Id` di satu
server), berbeda dengan project lain milik user yang punya **GOWA server terpisah per device**
(URL berbeda-beda, mis. `gowa-xxx.cgk-hello.sumopod.my.id` vs `gowa-yyy.cgk-moto.sumopod.my.id`)?

**Jawaban: TIDAK terkait.** Restriksi reach-out timelock beroperasi di level **nomor/akun
WhatsApp itu sendiri** — pesan error dari WhatsApp eksplisit menyalahkan "the sending
**account**", bukan server/IP. WhatsApp Web protocol (yang dipakai `whatsmeow`, library inti
GOWA) tidak mengekspos informasi "server hosting apa" ke WhatsApp — dari sudut pandang WhatsApp,
satu GOWA server yang menjalankan 5 device secara paralel via `X-Device-Id` terlihat SAMA PERSIS
dengan 5 GOWA server terpisah yang masing-masing menjalankan 1 device — keduanya sama-sama
"5 sesi WhatsApp Web independen". Memindahkan tenant ke server GOWA sendiri-sendiri **tidak akan
mencegah/mempercepat lolos dari restriksi ini** — nomor yang baru ditautkan tetap akan kena,
di server manapun dia dijalankan.

**Arsitektur "satu GOWA server untuk semua tenant" tetap dipertahankan** (keputusan sejak awal,
§ 2 — "Satu instance GOWA untuk semua tenant... dipisahkan via `device_id = slug`") — alasan
isolasi kegagalan (kalau 1 server down, semua tenant kena) BUKAN alasan yang relevan untuk kasus
ini, karena bukan penyebab masalahnya. Kemungkinan besar setup "server terpisah per device" di
project lain user dibangun untuk kebutuhan berbeda (isolasi kegagalan, atau dibuat sebelum GOWA
versi kita punya dukungan multi-device via `X-Device-Id`) — bukan untuk menghindari reach-out
timelock.

**Catatan kejujuran**: WhatsApp tidak mempublikasikan algoritma anti-spam-nya secara detail —
tidak bisa dipastikan 100% bahwa reputasi IP/server tidak pernah jadi faktor sekunder sama
sekali. Tapi berdasarkan pesan error yang eksplisit ("the sending account"), dan fakta bahwa
banyak pengguna sah WhatsApp Web resmi connect dari IP data center/cloud yang sama tanpa masalah
kolektif, faktor utama yang terdokumentasi adalah reputasi NOMOR itu sendiri, bukan
infrastruktur hosting-nya.

---

## 15. Koneksi ke File Lain

- `CLAUDE.md` § "Arsitektur Add-on System" — schema addons, quota enforcement
- `CLAUDE.md` § "Known TODO" — OTP via WA disebutkan di Login Universal Phase 2
- `docs/arsitektur-billing.md` — trigger: payment submit/confirm
- `docs/arsitektur-fulfillment.md` — trigger: order shipped
- `docs/arsitektur-event.md` — trigger: registrasi, reminder
- `docs/arsitektur-tandatangan.md` — trigger: sign request
- `docs/arsitektur-login-universal.md` — OTP flow (Fase 7)
- `packages/db/src/schema/public/addons.ts` — katalog add-on
- `packages/db/src/schema/public/tenant-addon-installations.ts` — config per tenant
- `packages/db/src/schema/public/addon-usage.ts` — quota tracking

---

## 16. Penyimpangan dari Desain Awal (dicatat 2026-06-06)

Implementasi Fase 1+2 (commit `1db1cee`) **mengambil jalan pintas** dibanding desain di § 3–4 dan
§ 10 dokumen ini. Bagian ini adalah sumber kebenaran untuk apa yang **benar-benar berjalan** di kode.
Jangan percaya § 3.2, § 4, § 10 di atas sebagai representasi kode aktual — itu masih desain awal.

### 16.1 Config tersimpan di tenant settings, bukan `tenant_addon_installations`

**Desain awal**: config WA (`device_id`, `phone_number`, `verified`, `notifications{}`) tersimpan di
`public.tenant_addon_installations.config` — terikat ke baris instalasi add-on (`whatsapp-starter` /
`-pro` / `-unlimited`) di `public.addons`.

**Kode aktual**: config tersimpan di `tenant_{slug}.settings`, `group="notif"`, `key="whatsapp_config"`
— pakai `getSettings()`/`upsertSettings()` biasa, sama sekali tidak menyentuh tabel
`tenant_addon_installations` atau `public.addons`. Lihat `lib/whatsapp.ts` (`WaNotifConfig` type) dan
`settings/actions.ts` (`connectWhatsAppAction`, dst).

**Implikasi**: WA Gateway saat ini berperilaku seperti **fitur bawaan tenant** (self-service penuh,
tidak ada langkah "beli/aktifkan add-on" di platform), bukan add-on berbayar terkontrol seperti
modul lain (Midtrans, dll). `public.addons` baris `whatsapp-*` (migration 0003) **tidak terpakai
sama sekali** oleh jalur kode ini.

### 16.2 Tidak ada quota enforcement

**Desain awal** (§ 10): cek `installation.status="active"` → cek `addon_usage.count < quota` →
kirim → increment `addon_usage.count`. Tier: starter 200/bulan, pro 1.000/bulan, unlimited ∞.

**Kode aktual**: `sendWaNotification()` di `lib/whatsapp.ts` hanya melakukan 3 cek:
1. `config.device_id` ada
2. `config.verified === true`
3. `config.notifications[event] === true`

**Tidak ada cek quota, tidak ada `addon_usage` increment, tidak ada limit jumlah pesan/bulan.**
Tenant manapun yang sudah scan QR bisa kirim WA tanpa batas selama toggle event-nya aktif.

### 16.3 `WaSendResult.reason` berbeda dari desain

| Desain awal (§ 4) | Kode aktual (`lib/whatsapp.ts`) |
|---|---|
| `addon_inactive` | — (tidak ada, karena tidak cek addon) |
| `not_configured` | `not_configured` |
| — | `not_verified` (baru, ganti makna dari `not_configured`) |
| `event_disabled` | `event_disabled` |
| `quota_exceeded` | — (tidak ada, karena tidak ada quota) |
| `send_failed` | `send_failed` |

### 16.4 `device_id` = slug tenant langsung

Desain awal menyarankan format `"tenant-ikpm-001"`. Kode aktual: `deviceId = slug` (contoh:
`"ikpm-jogjakarta"`) — dipakai langsung sebagai device ID di GOWA (`POST /devices`, body
`{ device_id: slug }`). Cukup karena slug sudah unik per tenant; tidak ada migrasi yang dibutuhkan
kalau mau ganti ke format lain nanti, tinggal pastikan tidak collide dengan device lama di GOWA.

### 16.5 Apa yang harus dilakukan kalau mau menutup gap ini

Jika ke depannya WA Gateway mau benar-benar jadi add-on berbayar dengan quota (sesuai keputusan
§ 13.5 "Add-on berbayar"), perlu:
1. Saat `connectWhatsAppAction` — cek/buat baris `tenant_addon_installations` (tier dipilih admin
   atau default `whatsapp-starter`), bukan cuma simpan ke `settings`
2. `sendWaNotification()` — tambah cek `installation.status === "active"` + quota dari
   `addon_usage`, persis seperti § 10
3. Dashboard `/settings/notifications` — tampilkan quota meter (sudah ada placeholder UI di
   `WhatsAppSetupClient` tapi belum terhubung ke data quota asli)
4. Migration: pastikan tenant yang sudah connect (config di `settings`) di-backfill jadi baris
   `tenant_addon_installations` agar tidak hilang akses

Sampai langkah-langkah ini dikerjakan, **anggap WA Gateway gratis/unlimited untuk semua tenant**
yang melakukan setup sendiri — ini adalah keadaan aktual produksi per 2026-06-06.

### 16.6 OTP tidak pakai Redis — pakai PostgreSQL

**Desain awal** (§ 8.3–8.4): menyebut "Redis/DB" untuk storage OTP.

**Kode aktual**: pakai tabel `public.otp_tokens` di PostgreSQL. Tidak ada Redis di infrastruktur ini.
- TTL diimplementasikan via kolom `expires_at` + filter `> NOW()` di query
- "Sekali pakai" via kolom `used_at` (NULL = belum dipakai)
- Rate limit via `COUNT WHERE created_at > NOW() - 1 hour`
- Ini cukup untuk volume jalakarta — Redis hanya diperlukan jika load sangat tinggi

### 16.7 Reset password via WA — inject ke `public.verification` (Better Auth trick)

**Masalah**: Better Auth tidak expose `setPassword` tanpa sesi aktif. Tidak ada endpoint resmi
untuk "set password baru tanpa login" kecuali via token reset.

**Solusi**: Setelah OTP verify sukses, server insert langsung ke tabel `public.verification`
(yang sudah dikelola Better Auth) dengan format:
```
identifier: "reset-password:{token}"   ← format yang dibaca Better Auth
value:      betterAuthUserId            ← user yang akan diubah passwordnya
expiresAt:  NOW() + 15 menit
```
Frontend di-redirect ke `/{slug}/reset-password?token={token}` → halaman existing
(`authClient.resetPassword({ newPassword, token })`) bekerja **tanpa modifikasi apapun**.

**Aman?** Ya — token di-generate via `crypto.getRandomValues` (CSPRNG), TTL 15 menit,
lookup user dilakukan di server (bukan dari input user), double-cek via OTP sebelum inject.

### 16.8 `notifyWa()` wrapper + template editable per tenant (ditambahkan 2026-07-13/15)

**Desain awal** (§ 4): satu fungsi `sendWaNotification(opts)` dipanggil langsung dari business
logic, `message` (teks final) dikirim sebagai parameter — caller bertanggung jawab render template
sendiri sebelum memanggil.

**Kode aktual**: business-logic actions (billing, event, fulfillment, surat) **tidak pernah**
memanggil `sendWaNotification()` langsung — semua lewat wrapper baru `apps/web/lib/wa-notify.ts`:

```typescript
notifyWa({ slug, tenantDb, event, phone, vars }) → void
```

Alasan wrapper ini dibuat: kalau tiap titik notifikasi (5+ titik di Fase 3 saja, total belasan
setelah Fase 4-6) reimplementasi sendiri cara ambil `orgName` dan bangun URL absolut, risiko besar
salah satu titik lupa pakai `NEXT_PUBLIC_APP_URL` dan malah hardcode `/${slug}/...` — persis pola
bug yang sudah pernah terjadi untuk custom domain (lihat lesson CLAUDE.md "Custom Domain Harus
Diisolasi"). Isi wrapper:
- `resolveOrgName(tenantDb, slug)` — baca `site_name` dari settings, fallback ke slug
- `waAppUrl(slug, path)` — selalu bangun URL absolut (`NEXT_PUBLIC_APP_URL` + `/{slug}{path}`)
- `waRupiah(amount)` — format `toLocaleString("id-ID")` konsisten
- `resolveWaTemplateText(tenantDb, event)` — cek override tenant dulu, fallback default kode

**Template jadi editable per tenant** (deviasi dari § 13 poin 4 desain awal): `lib/wa-templates.ts`
direfaktor dari `Record<string, (v) => string>` (fungsi JS) ke `Record<string, string>`
(`WA_TEMPLATE_DEFAULTS`, placeholder `{{var}}`). `renderTemplateString(tpl, vars)` — string replace
murni via regex `\{\{(\w+)\}\}`, **bukan `eval`/`Function()`** — placeholder yang tidak ada di
`vars` diganti string kosong, bukan error. Override tersimpan `tenant.settings` group=`"notif"`
key=`"wa_message_templates"` (JSONB `Partial<Record<WaNotifKey,string>>`). UI: tombol "Edit Teks"
per notifikasi di `WhatsAppSetupClient` (`/settings/notifications`) → `saveWaTemplateAction`/
`resetWaTemplateAction` (`settings/actions.ts`). Badge "kustom" + tombol "Reset ke Default" saat
sudah dikustomisasi.

**Regresi minor diterima sebagai trade-off**: 2 template lama (`order_shipped`,
`letter_sign_request`) sebelumnya (§ 5 di atas, versi lama fungsi JS) punya interpolasi kondisional
(`${v.trackingUrl ? "\n\nPantau: "+v.trackingUrl : ""}`) — baris hanya muncul kalau variabelnya
terisi. Sintaks `{{var}}` string-replace baru **tidak support kondisional** — baris itu sekarang
selalu tampil (kosong kalau variabel tidak diisi). Ditutup dengan caller SELALU mengisi variabel
itu dengan nilai wajar (`resolvedTrackingNumber` fallback string kosong di fulfillment,
`letterNumber ?? "-"` di surat) — bukan mengandalkan baris auto-hilang seperti versi lama.

**Exception yang tetap sah pakai `sendWaNotification()` langsung** (bukan lewat `notifyWa()`):
endpoint OTP (`send-otp/route.ts`) — punya guard tambahan (rate limit, verified-check) sebelum
kirim yang tidak cocok dipaksakan ke wrapper generik. Tetap pakai `resolveWaTemplateText()` yang
sama untuk template editable, jadi teks OTP pun ikut bisa dikustomisasi tenant.
