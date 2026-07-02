# Arsitektur WhatsApp Gateway — jalajogja

> Dokumen ini adalah referensi tunggal untuk semua hal terkait integrasi WhatsApp di platform jalajogja.
> Terkoneksi dengan: `CLAUDE.md` § "WhatsApp Gateway", `docs/arsitektur-billing.md`, `docs/arsitektur-login-universal.md`, `docs/arsitektur-fulfillment.md`, `docs/arsitektur-event.md`.

> **STATUS (2026-06-30): Fase 1+2 SELESAI + OTP SELESAI.**
> Lihat § 16 "Penyimpangan dari Desain Awal" untuk daftar perbedaan antara dokumen ini dan kode aktual.
> Bagian 3.2, 4, dan 10 di bawah ini menjelaskan **desain awal** (addon installation + quota) — kode
> aktual saat ini **tidak** memakai `tenant_addon_installations`/`addon_usage` sama sekali. Baca § 16 dulu.
> OTP (register + reset password via WhatsApp) — **Fase 7 sudah diimplementasikan**. Lihat § 6.7, § 8.3–8.4, § 16.6.

---

## 1. Visi & Tujuan

WhatsApp adalah kanal komunikasi utama di Indonesia — penetrasinya jauh lebih tinggi dari email.
jalajogja mengintegrasikan WA sebagai lapisan notifikasi universal yang:

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

### 2.2 Hosting: Self-Hosted di VPS jalajogja

> **Update 2026-06-30**: Sumopod (hosting sebelumnya) telah menutup layanan.
> GOWA sekarang berjalan di **VPS jalajogja yang sama** (72.61.215.7) via Docker.
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
┌──────────────────────────────────────┐
│  VPS Utama (72.61.215.7)             │
│  ┌──────────────────┐                │
│  │  Next.js (PM2)   │ ──POST /send──▶│──── Sumopod GOWA ────▶ WhatsApp
│  │  Port 3000       │ ◀──200 OK──────│◀───────────────────────
│  └──────────────────┘                │
│  ┌──────────────────┐                │
│  │  PostgreSQL       │               │
│  │  (addon tables)   │               │
│  └──────────────────┘                │
└──────────────────────────────────────┘
```

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

### 6.1 Billing & Pembayaran

| Event | Trigger | Penerima | Template |
|-------|---------|----------|----------|
| Bukti bayar diterima | `submitPaymentProofAction` | Customer | `payment_submitted` |
| Pembayaran dikonfirmasi | `verifySubmittedPaymentAction` / `confirmInvoicePaymentAction` | Customer | `payment_confirmed` |
| Pembayaran ditolak | Admin reject | Customer | `payment_rejected` |
| Invoice baru | `checkoutAction` | Customer | `invoice_created` |
| Invoice jatuh tempo H-1 | Cron job | Customer | `invoice_reminder` |

**Nomor tujuan:** dari `profiles.phone` atau `members.contacts.whatsapp` via `resolveIdentity()`

### 6.2 Toko / Fulfillment

| Event | Trigger | Penerima | Template |
|-------|---------|----------|----------|
| Pesanan diproses | `updateFulfillmentStatusAction` (→ processing) | Customer | `order_processing` |
| Pesanan dikirim | `updateFulfillmentStatusAction` (→ shipped) | Customer | `order_shipped` |
| Pesanan selesai | `updateFulfillmentStatusAction` (→ delivered) | Customer | `order_delivered` |

### 6.3 Event

| Event | Trigger | Penerima | Template |
|-------|---------|----------|----------|
| Registrasi berhasil | `registerForEventAction` | Peserta | `event_registered` |
| Pengingat H-1 | Cron job | Peserta confirmed | `event_reminder` |
| Sertifikat siap | `generateCertificateAction` (selesai upload MinIO) | Peserta attended | `event_certificate_ready` |

### 6.4 Donasi

| Event | Trigger | Penerima | Template |
|-------|---------|----------|----------|
| Donasi diterima | `checkoutAction` (itemType=donation) | Donatur | `donation_received` |
| Donasi dikonfirmasi | `verifySubmittedPaymentAction` | Donatur | `payment_confirmed` |

### 6.5 Anggota & Pengurus

| Event | Trigger | Penerima | Template |
|-------|---------|----------|----------|
| Anggota baru | `createMemberAction` | Anggota | `member_welcome` |
| Undangan pengurus | `createInviteAction` | Calon pengurus | `officer_invite` |

### 6.6 Surat

| Event | Trigger | Penerima | Template |
|-------|---------|----------|----------|
| Permintaan TTD | `syncSignatureSlotsAction` (slot baru) | Officer (per slot) | `letter_sign_request` |

**Catatan:** Kirim hanya ke officer yang punya slot baru (token baru di-generate). Officer yang tokennya tidak berubah tidak dapat notif ulang.

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

---

## 7. Dashboard Admin — Setup & Konfigurasi

Route: `/app/{slug}/settings/notifications` — tab "WhatsApp"

### 7.1 Alur Setup

```
1. Admin klik "Tambah WhatsApp Gateway"
2. System call API GOWA: POST /device (buat device_id baru)
3. System tampilkan QR code dari GET /app/login?device_id=...
4. Admin scan QR dengan nomor WA organisasi
5. GOWA konfirmasi koneksi → verified = true di config
6. Admin pilih toggle notifikasi yang diinginkan
7. Admin klik Simpan
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

## 9. Cron Jobs

Dua cron job yang perlu dijadwalkan (via `CronCreate` di aplikasi atau crontab di VPS):

### 9.1 Invoice Reminder (Harian)

```
Schedule: 0 8 * * *   (setiap hari jam 8 pagi)
File: apps/web/app/api/cron/invoice-reminder/route.ts

Logic:
- Cari semua invoice dengan status != "paid" dan due_date = TOMORROW
- Untuk setiap invoice: kirim notif ke nomor customer
```

### 9.2 Event Reminder (Harian)

```
Schedule: 0 9 * * *   (setiap hari jam 9 pagi)
File: apps/web/app/api/cron/event-reminder/route.ts

Logic:
- Cari semua event dengan date = TOMORROW
- Cari semua registrasi confirmed untuk event tersebut
- Kirim pengingat ke tiap peserta
```

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

Contoh integrasi ke `verifySubmittedPaymentAction` (billing):

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

**Aturan penting:**
- `void sendWaNotification(...)` — selalu fire-and-forget, JANGAN await di action utama
- Kegagalan WA tidak boleh menyebabkan action utama gagal
- Log error WA terpisah dari log bisnis

---

## 12. Rencana Implementasi (Fase)

### Fase 1 — Infrastruktur (Prerequisite) — ✅ SELESAI (2026-06-06)

- [x] Deploy GOWA di Sumopod
- [x] Set environment variables di VPS: `WHATSAPP_SERVICE_URL`, `WHATSAPP_API_USER`, `WHATSAPP_API_PASS`
- [x] Buat `apps/web/lib/whatsapp.ts` — helper utama (lihat § 16 untuk perbedaan dari desain awal)
- [x] Buat `apps/web/lib/wa-templates.ts` — 17 template
- [x] Scan QR pertama kali — verifikasi koneksi

### Fase 2 — Dashboard Setup Admin — ✅ SELESAI (2026-06-06)

- [x] UI setup koneksi WA di `/app/{slug}/settings/notifications` — `WhatsAppSetupClient`
- [x] API: `GET /api/wa/qr` dan `GET /api/wa/status`
- [x] Server actions: `connectWhatsAppAction`, `confirmWaConnectionAction`, `disconnectWhatsAppAction`, `saveWaNotificationSettingsAction`

### Fase 3 — Notifikasi Billing (Prioritas Tertinggi)

- [ ] `submitPaymentProofAction` → `payment_submitted`
- [ ] `verifySubmittedPaymentAction` → `payment_confirmed`
- [ ] `confirmInvoicePaymentAction` → `payment_confirmed`

### Fase 4 — Notifikasi Toko & Fulfillment

- [ ] `updateFulfillmentStatusAction` → `order_shipped` saat shipped

### Fase 5 — Notifikasi Event & Donasi

- [ ] `registerForEventAction` → `event_registered`
- [ ] `checkoutAction` (itemType=donation) → `donation_received`
- [ ] Cron: invoice reminder + event reminder

### Fase 6 — Notifikasi Organisasi

- [ ] `syncSignatureSlotsAction` → `letter_sign_request` (per slot baru)
- [ ] `createMemberAction` → `member_welcome`
- [ ] `createInviteAction` → `officer_invite`

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

---

## 13. Keputusan Desain yang Dikunci

1. **Satu GOWA untuk semua tenant** — dipisahkan via `device_id`, bukan instance terpisah
2. **Hosting di Sumopod** — bukan VPS utama, menghindari beban tambahan
3. **Fire-and-forget** — notifikasi WA tidak boleh memblokir response action utama
4. **Template di kode** — tidak di DB, karena update template = deploy baru (lebih aman, tidak ada injection)
5. **Add-on berbayar** — tenant harus aktifkan dan bayar untuk fitur ini
6. **Nomor dari DB** — tidak pernah dari form input user pada saat kirim; selalu dari `contacts.whatsapp` atau `contacts.phone` yang sudah tersimpan dan divalidasi

---

## 14. Known Risks & Mitigasi

| Risiko | Dampak | Mitigasi |
|--------|--------|----------|
| WhatsApp ban nomor | Gateway mati | Gunakan nomor dedicated organisasi, bukan nomor pribadi |
| GOWA tidak support versi WA terbaru | Gateway mati | Monitor repo aldinokemal, update berkala |
| Sumopod downtime | Notifikasi tertunda | Queue pesan di DB, retry saat kembali online (Fase 2) |
| Spam ke customer | Reputasi buruk | Toggle per event + quota + opt-out mechanism |
| Credential bocor | Security breach | Env vars di server saja, tidak pernah ke frontend |

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
- Ini cukup untuk volume jalajogja — Redis hanya diperlukan jika load sangat tinggi

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
