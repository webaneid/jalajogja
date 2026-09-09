import "server-only";

// Notifikasi ke PEMESAN (bukan admin) untuk 2 event baru terkait stok — lihat
// docs/arsitektur-stok.md. Kirim lewat WA dan/atau Email, "tergantung fasilitas yang dimiliki
// tenant" (keputusan user 2026-09-09): keduanya dicoba independen, masing-masing sudah
// menghandle "belum dikonfigurasi" secara graceful (notifyWa via sendWaNotification,
// sendTenantMail via early-return) — tidak perlu pre-check konfigurasi di sini, cukup coba
// keduanya dan biarkan yang tidak terkonfigurasi diam-diam tidak terkirim.
//
// TIDAK dipakai untuk notifikasi WA yang sudah ada (payment_confirmed dkk, tetap lewat
// notifyWa langsung seperti sebelumnya) — khusus 2 event baru yang butuh dual-channel.

import { getSetting, createTenantDb } from "@jalajogja/db";
import { notifyWa, resolveOrgName } from "./wa-notify";
import { sendTenantMail, type TenantSmtpConfig } from "./mail";

type NotifyCustomerOpts = {
  slug:     string;
  tenantDb: ReturnType<typeof createTenantDb>;
  phone:    string | null;
  email:    string | null;
  name:     string;
};

async function sendEmailIfConfigured(
  tenantDb: ReturnType<typeof createTenantDb>,
  to: string | null,
  subject: string,
  html: string,
): Promise<void> {
  if (!to) return;
  try {
    const smtpConfig = await getSetting<TenantSmtpConfig>(tenantDb, "smtp_config", "mail");
    if (!smtpConfig) return; // tenant belum setup SMTP — diam-diam skip, sama seperti WA
    await sendTenantMail(smtpConfig, { to, subject, html });
  } catch (err) {
    console.error("[notify-customer] gagal kirim email:", err);
  }
}

/**
 * Stok produk di invoice pending ini sudah tidak cukup lagi (laku duluan ke orang lain) —
 * minta pemesan konfirmasi dulu sebelum bayar. TIDAK membatalkan invoice apa pun, murni
 * informasi. Dipanggil dari cron, sekali per invoice (guard `stockAlertSentAt` di pemanggil).
 */
export async function notifyStockOut(
  opts: NotifyCustomerOpts & { invoiceNumber: string; productName: string; invoiceUrl: string },
): Promise<void> {
  const { slug, tenantDb, phone, email, name, invoiceNumber, productName, invoiceUrl } = opts;

  void notifyWa({
    slug, tenantDb, event: "product_stock_out",
    phone,
    vars: { name, invoiceNumber, productName, invoiceUrl },
  });

  const orgName = await resolveOrgName(tenantDb, slug);
  await sendEmailIfConfigured(
    tenantDb, email,
    `Stok Produk Habis — ${invoiceNumber}`,
    `<p>Halo ${name},</p>
     <p>Stok produk <strong>${productName}</strong> pada pesanan <strong>${invoiceNumber}</strong>
     sudah habis terjual ke pembeli lain.</p>
     <p><strong>Silakan konfirmasi terlebih dahulu ke kami sebelum Anda melakukan pembayaran</strong>,
     supaya tidak ada pembayaran untuk barang yang sudah tidak tersedia.</p>
     <p><a href="${invoiceUrl}">Lihat pesanan Anda</a></p>
     <p>Terima kasih,<br/>${orgName}</p>`,
  );
}

/**
 * Invoice (berisi item produk) dibatalkan otomatis karena lewat jatuh tempo tanpa pembayaran —
 * dipanggil cron, HANYA jika toggle auto-cancel toko diaktifkan. Lihat docs/arsitektur-stok.md.
 */
export async function notifyOrderAutoCancelled(
  opts: NotifyCustomerOpts & { invoiceNumber: string; invoiceUrl: string },
): Promise<void> {
  const { slug, tenantDb, phone, email, name, invoiceNumber, invoiceUrl } = opts;

  void notifyWa({
    slug, tenantDb, event: "order_auto_cancelled",
    phone,
    vars: { name, invoiceNumber, invoiceUrl },
  });

  const orgName = await resolveOrgName(tenantDb, slug);
  await sendEmailIfConfigured(
    tenantDb, email,
    `Pesanan Dibatalkan — ${invoiceNumber}`,
    `<p>Halo ${name},</p>
     <p>Pesanan Anda <strong>${invoiceNumber}</strong> telah dibatalkan otomatis karena belum
     ada pembayaran hingga melewati batas waktu.</p>
     <p>Kalau Anda masih ingin melanjutkan pesanan ini, silakan hubungi kami — pesanan yang
     dibatalkan masih bisa diaktifkan kembali selama stok produk masih tersedia.</p>
     <p><a href="${invoiceUrl}">Lihat pesanan Anda</a></p>
     <p>Terima kasih,<br/>${orgName}</p>`,
  );
}
