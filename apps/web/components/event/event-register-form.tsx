"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { CheckCircle2, Ticket, Loader2 } from "lucide-react";
import { registerForEventAction, addEventTicketToCartAction } from "@/app/(dashboard)/app/[tenant]/event/actions";
import { DonationPromptModal } from "@/components/event/public/donation-prompt-modal";
import type { CustomFormField } from "@/lib/event-custom-form";

// ─── Types ────────────────────────────────────────────────────────────────────

type TicketInfo = {
  id:                 string;
  name:               string;
  price:              number;
  quota:              number | null;
  description:        string | null | undefined;
  usedCount?:         number;  // jumlah pendaftaran aktif (untuk tampil sisa kuota di form)
  requiresMembership: boolean;
};

type BankAccount = {
  id:            string;
  bankName:      string;
  accountNumber: string;
  accountName:   string;
  categories:    string[];
};

type QrisAccount = {
  id:       string;
  name:     string;
  imageUrl?: string;
  categories: string[];
};

export type EventRegisterFormProps = {
  slug:               string;
  eventId:            string;
  tickets:            TicketInfo[];
  requireApproval:    boolean;
  banks:              BankAccount[];
  qrisAccounts:       QrisAccount[];
  hasPaidTicket:      boolean;
  // Apakah user yang sedang login sudah terdaftar sebagai anggota di cabang ini
  currentUserIsEnrolled: boolean;
  // Donation prompt (opsional — hanya jika admin aktifkan + ada linkedCampaignId)
  donationPrompt?:    {
    campaignId:    string;
    campaignTitle: string;
    amounts:       number[];
  } | null;
  // Produk terkait (opsional — jika admin set linkedProductId)
  linkedProductId?:    string | null;
  linkedProductTitle?: string | null;
  // Pre-fill data dari session (member/profile)
  defaultAttendeeName?:  string;
  defaultAttendeePhone?: string;
  defaultAttendeeEmail?: string;
  // URL ke halaman lengkapi keanggotaan (untuk redirect jika tiket butuh anggota)
  baseUrl: string;
  // Form tambahan — hanya tampil jika admin aktifkan + ada field yang dikonfigurasi
  enableCustomForm?:  boolean;
  customFormFields?:  CustomFormField[];
};

// ─── Helper ───────────────────────────────────────────────────────────────────

function formatRupiah(n: number) {
  return "Rp " + new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n);
}

// ─── EventRegisterForm ────────────────────────────────────────────────────────

export function EventRegisterForm({
  slug,
  eventId,
  tickets,
  requireApproval,
  banks,
  qrisAccounts,
  hasPaidTicket,
  currentUserIsEnrolled,
  donationPrompt,
  linkedProductId   = null,
  linkedProductTitle = null,
  defaultAttendeeName  = "",
  defaultAttendeePhone = "",
  defaultAttendeeEmail = "",
  baseUrl,
  enableCustomForm  = false,
  customFormFields  = [],
}: EventRegisterFormProps) {
  // Routing ke cart jika ada linked items (campaign + produk → satu invoice)
  const hasLinkedItems = !!(donationPrompt || linkedProductId);
  // Pilihan tiket
  const [selectedTicketId, setSelectedTicketId] = useState<string>(tickets[0]?.id ?? "");

  // Form peserta — pre-filled dari session jika ada
  const [attendeeName,  setAttendeeName]  = useState(defaultAttendeeName);
  const [attendeePhone, setAttendeePhone] = useState(defaultAttendeePhone);
  const [attendeeEmail, setAttendeeEmail] = useState(defaultAttendeeEmail);

  // Jawaban custom form fields (key → value string)
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  function setCustomValue(key: string, value: string) {
    setCustomValues((prev) => ({ ...prev, [key]: value }));
  }

  // Modal donation prompt (tampil setelah registrasi gratis berhasil)
  const [showDonationModal, setShowDonationModal] = useState(false);

  // Pembayaran
  const [method,         setMethod]         = useState<"cash" | "transfer" | "qris">("transfer");
  const [bankAccountRef, setBankAccountRef] = useState<string>(banks[0]?.id ?? "");
  const [qrisAccountRef, setQrisAccountRef] = useState<string>(qrisAccounts[0]?.id ?? "");

  // State UI
  const [error,   setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    registrationNumber: string;
    isPaid:             boolean;
    amount?:            number;
    uniqueCode?:        number;
    totalAmount?:       number;
    invoiceId?:         string;
  } | null>(null);

  const [isPending, startTransition] = useTransition();

  const selectedTicket       = tickets.find((t) => t.id === selectedTicketId);
  const isPaidTicket         = (selectedTicket?.price ?? 0) > 0;
  // Tiket terpilih membutuhkan keanggotaan tapi user belum terdaftar
  const selectedTicketLocked = Boolean(selectedTicket?.requiresMembership && !currentUserIsEnrolled);

  function handleSubmit() {
    setError(null);
    if (!attendeeName.trim()) {
      setError("Nama peserta wajib diisi.");
      return;
    }
    if (!selectedTicketId) {
      setError("Pilih tiket terlebih dahulu.");
      return;
    }
    // Guard client-side untuk tiket wajib anggota
    const chosenTicket = tickets.find((t) => t.id === selectedTicketId);
    if (chosenTicket?.requiresMembership && !currentUserIsEnrolled) {
      setError("Tiket ini hanya untuk anggota terdaftar. Silakan lengkapi data keanggotaan terlebih dahulu.");
      return;
    }

    // Validasi required custom form fields
    if (enableCustomForm && customFormFields.length > 0) {
      for (const field of customFormFields) {
        if (field.required && !customValues[field.key]?.trim()) {
          setError(`Field "${field.label}" wajib diisi.`);
          return;
        }
      }
    }

    // Bangun custom field answers — konversi nilai sesuai tipe
    const customFieldAnswers: Record<string, unknown> = {};
    if (enableCustomForm && customFormFields.length > 0) {
      for (const field of customFormFields) {
        const raw = customValues[field.key];
        if (!raw && !raw?.trim()) continue;
        if (field.type === "number") {
          const n = Number(raw);
          if (!isNaN(n)) customFieldAnswers[field.key] = n;
        } else if (field.type === "datetime") {
          // Konversi datetime-local → UTC ISO (browser parse sebagai local time)
          const d = new Date(raw);
          if (!isNaN(d.getTime())) customFieldAnswers[field.key] = d.toISOString();
        } else {
          customFieldAnswers[field.key] = raw.trim();
        }
      }
    }

    startTransition(async () => {
      // Routing kondisional: ada linked items → cart (satu invoice); tidak ada → alur lama
      if (hasLinkedItems) {
        const res = await addEventTicketToCartAction(slug, {
          eventId,
          ticketId:           selectedTicketId,
          attendeeName,
          attendeePhone:      attendeePhone || null,
          attendeeEmail:      attendeeEmail || null,
          customFieldAnswers: Object.keys(customFieldAnswers).length > 0
            ? (customFieldAnswers as Record<string, string | number>)
            : undefined,
        });

        if (!res.success) {
          setError(res.error);
          return;
        }

        // Redirect ke keranjang (full reload agar cart cookie terbaca)
        window.location.href = `${baseUrl}/keranjang`;
        return;
      }

      // Alur lama (tidak ada linked items)
      const res = await registerForEventAction(slug, {
        eventId,
        ticketId:           selectedTicketId,
        attendeeName,
        attendeePhone:      attendeePhone || null,
        attendeeEmail:      attendeeEmail || null,
        customFieldAnswers: Object.keys(customFieldAnswers).length > 0 ? customFieldAnswers : null,
        method:             isPaidTicket ? method : undefined,
        bankAccountRef:     isPaidTicket && method === "transfer" ? bankAccountRef || null : null,
        qrisAccountRef:     isPaidTicket && method === "qris"     ? qrisAccountRef || null : null,
      });

      if (!res.success) {
        setError(res.error);
        return;
      }

      setSuccess({
        registrationNumber: res.data.registrationNumber,
        isPaid:             res.data.isPaid,
        amount:             res.data.amount,
        uniqueCode:         res.data.uniqueCode,
        totalAmount:        res.data.totalAmount,
        invoiceId:          res.data.invoiceId,
      });

      // Tampilkan modal donasi jika event gratis + admin aktifkan prompt (alur lama)
      if (!res.data.isPaid && donationPrompt) {
        setShowDonationModal(true);
      }
    });
  }

  // ── Success state ──────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center gap-2 py-2 text-center">
          <CheckCircle2 className="h-10 w-10 text-green-500" />
          <p className="font-semibold text-sm">
            {success.isPaid ? "Pendaftaran Berhasil!" : "Pendaftaran Diterima!"}
          </p>
          <p className="text-xs text-muted-foreground">
            Nomor pendaftaran: <span className="font-mono font-semibold">{success.registrationNumber}</span>
          </p>
        </div>

        {/* Gratis atau sudah dikonfirmasi */}
        {success.isPaid && (
          <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-sm space-y-1 dark:bg-green-950 dark:border-green-800">
            <p className="font-semibold text-green-800 dark:text-green-200">Pendaftaran dikonfirmasi</p>
            {requireApproval && (
              <p className="text-green-700 dark:text-green-300 text-xs">
                Pendaftaran akan diverifikasi admin terlebih dahulu.
              </p>
            )}
          </div>
        )}

        {/* Tiket berbayar — arahkan ke halaman pembayaran invoice */}
        {!success.isPaid && success.amount !== undefined && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 space-y-3 text-sm dark:bg-amber-950 dark:border-amber-700">
            <p className="font-semibold text-amber-800 dark:text-amber-200">Selesaikan Pembayaran</p>
            <p className="text-amber-900 dark:text-amber-100">
              Total:{" "}
              <span className="font-bold text-base">{formatRupiah(success.totalAmount ?? success.amount)}</span>
              {(success.uniqueCode ?? 0) > 0 && (
                <span className="text-xs ml-1">
                  (termasuk kode unik{" "}
                  <span className="font-mono">{success.uniqueCode}</span>)
                </span>
              )}
            </p>
            {success.invoiceId ? (
              <a
                href={`${baseUrl}/invoice/${success.invoiceId}`}
                className="inline-flex items-center gap-1.5 rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 transition-colors"
              >
                Konfirmasi Pembayaran →
              </a>
            ) : (
              <p className="text-xs text-amber-700 dark:text-amber-300">Hubungi panitia untuk konfirmasi pembayaran.</p>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Form state ─────────────────────────────────────────────────────────────
  return (
    <>
    <div className="space-y-5">
      {/* Pilihan Tiket */}
      {tickets.length > 1 && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Pilih Tiket</Label>
          <div className="space-y-2">
            {tickets.map((t) => {
              const memberLocked = t.requiresMembership && !currentUserIsEnrolled;
              return memberLocked ? (
                // Tiket terkunci — tampil tapi tidak bisa dipilih
                <div
                  key={t.id}
                  className="w-full rounded-lg border border-border bg-muted/10 p-3 opacity-70"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Ticket className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="font-medium text-sm truncate">{t.name}</span>
                      <span className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 px-1.5 py-0.5 rounded-full font-medium">
                        Anggota
                      </span>
                    </div>
                    <span className="text-sm font-semibold shrink-0 text-muted-foreground">
                      {t.price <= 0 ? "Gratis" : formatRupiah(t.price)}
                    </span>
                  </div>
                  {t.description && (
                    <p className="mt-1 ml-6 text-xs text-muted-foreground">{t.description}</p>
                  )}
                  <a
                    href={`${baseUrl}/akun/lengkapi`}
                    className="mt-2 ml-6 text-xs text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Lengkapi Keanggotaan →
                  </a>
                </div>
              ) : (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTicketId(t.id)}
                  className={`w-full text-left rounded-lg border p-3 transition-colors ${
                    selectedTicketId === t.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50 hover:bg-muted/30"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Ticket className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="font-medium text-sm truncate">{t.name}</span>
                      {t.requiresMembership && (
                        <span className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 px-1.5 py-0.5 rounded-full font-medium">
                          Anggota
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-semibold shrink-0">
                      {t.price <= 0 ? "Gratis" : formatRupiah(t.price)}
                    </span>
                  </div>
                  {t.description && (
                    <p className="mt-1 ml-6 text-xs text-muted-foreground">{t.description}</p>
                  )}
                  {t.quota !== null && (
                    <p className="mt-0.5 ml-6 text-xs text-muted-foreground">Kuota: {t.quota} orang</p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Info tiket tunggal */}
      {tickets.length === 1 && (() => {
        const t = tickets[0];
        const memberLocked = t.requiresMembership && !currentUserIsEnrolled;
        return memberLocked ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950 dark:border-amber-700 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Ticket className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-medium">{t.name}</span>
              </div>
              <span className="text-sm font-semibold">
                {t.price <= 0 ? "Gratis" : formatRupiah(t.price)}
              </span>
            </div>
            <p className="text-xs text-amber-800 dark:text-amber-200">
              Tiket ini hanya tersedia untuk anggota terdaftar.
            </p>
            <a
              href={`${baseUrl}/akun/lengkapi`}
              className="btn btn-primary btn-sm inline-flex"
            >
              Lengkapi Keanggotaan →
            </a>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-muted/20 p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Ticket className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{t.name}</span>
            </div>
            <span className="text-sm font-semibold">
              {t.price <= 0 ? "Gratis" : formatRupiah(t.price)}
            </span>
          </div>
        );
      })()}

      {/* CTA Lengkapi Keanggotaan — tampil ketika tiket terpilih terkunci (multi-tiket) */}
      {selectedTicketLocked && tickets.length > 1 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-700 p-4 space-y-2">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
            Tiket ini khusus untuk anggota terdaftar cabang ini.
          </p>
          <p className="text-xs text-amber-800 dark:text-amber-300">
            Lengkapi data keanggotaan Anda terlebih dahulu untuk dapat mendaftar.
          </p>
          <a href={`${baseUrl}/akun/lengkapi`} className="btn btn-primary btn-sm inline-flex">
            Lengkapi Keanggotaan →
          </a>
        </div>
      )}

      {/* Semua section di bawah hanya tampil jika tiket terpilih tidak terkunci */}
      {!selectedTicketLocked && (
        <>
          {/* Data Peserta */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="attendeeName" className="text-sm">
                Nama Lengkap <span className="text-destructive">*</span>
              </Label>
              <Input
                id="attendeeName"
                value={attendeeName}
                onChange={(e) => setAttendeeName(e.target.value)}
                placeholder="Nama peserta"
                disabled={isPending}
              />
            </div>

            <div className="space-y-1.5">
              <PhoneInput
                label="Nomor HP"
                value={attendeePhone}
                onChange={setAttendeePhone}
                disabled={isPending}
                optional
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="attendeeEmail" className="text-sm">
                Email
              </Label>
              <Input
                id="attendeeEmail"
                type="email"
                value={attendeeEmail}
                onChange={(e) => setAttendeeEmail(e.target.value)}
                placeholder="email@contoh.com"
                disabled={isPending}
              />
            </div>
          </div>

          {/* Form Tambahan — dynamic custom fields dari admin */}
          {enableCustomForm && customFormFields.length > 0 && (
            <div className="space-y-3 rounded-lg border border-border p-4">
              <p className="text-sm font-semibold text-foreground">Informasi Tambahan</p>
              {customFormFields.map((field) => {
                const value = customValues[field.key] ?? "";
                const inputId = `custom-${field.key}`;
                return (
                  <div key={field.key} className="space-y-1.5">
                    <Label htmlFor={inputId} className="text-sm">
                      {field.label}
                      {field.required && <span className="text-destructive ml-0.5">*</span>}
                    </Label>

                    {field.type === "text" && (
                      <Input
                        id={inputId}
                        value={value}
                        onChange={(e) => setCustomValue(field.key, e.target.value)}
                        placeholder={field.placeholder ?? ""}
                        disabled={isPending}
                      />
                    )}

                    {field.type === "number" && (
                      <Input
                        id={inputId}
                        type="number"
                        min={0}
                        value={value}
                        onChange={(e) => setCustomValue(field.key, e.target.value)}
                        placeholder={field.placeholder ?? ""}
                        disabled={isPending}
                      />
                    )}

                    {field.type === "datetime" && (
                      <input
                        id={inputId}
                        type="datetime-local"
                        value={value}
                        onChange={(e) => setCustomValue(field.key, e.target.value)}
                        disabled={isPending}
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    )}

                    {field.type === "select" && field.options && field.options.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {field.options.map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            disabled={isPending}
                            onClick={() => setCustomValue(field.key, opt)}
                            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                              value === opt
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border hover:border-primary/50"
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Metode Pembayaran — hanya untuk tiket berbayar, dan hanya di alur lama (bukan cart) */}
          {isPaidTicket && !hasLinkedItems && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Metode Pembayaran</Label>

              <div className="flex gap-2">
                {(["transfer", "qris", "cash"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMethod(m)}
                    className={`flex-1 rounded-md border py-2 text-xs font-medium transition-colors ${
                      method === m
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    {m === "transfer" ? "Transfer" : m === "qris" ? "QRIS" : "Tunai"}
                  </button>
                ))}
              </div>

              {/* Pilih rekening tujuan */}
              {method === "transfer" && banks.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Transfer ke rekening:</p>
                  {banks.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setBankAccountRef(b.id)}
                      className={`w-full text-left rounded-lg border p-3 transition-colors text-sm ${
                        bankAccountRef === b.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <p className="font-medium">{b.bankName} — {b.accountNumber}</p>
                      <p className="text-xs text-muted-foreground">a.n. {b.accountName}</p>
                    </button>
                  ))}
                </div>
              )}

              {/* Pilih QRIS */}
              {method === "qris" && qrisAccounts.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Bayar via QRIS:</p>
                  {qrisAccounts.map((q) => (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => setQrisAccountRef(q.id)}
                      className={`w-full text-left rounded-lg border p-3 transition-colors text-sm ${
                        qrisAccountRef === q.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <p className="font-medium">{q.name}</p>
                    </button>
                  ))}
                </div>
              )}

              {method === "transfer" && banks.length === 0 && (
                <p className="text-xs text-muted-foreground italic">Rekening belum tersedia. Hubungi panitia.</p>
              )}
              {method === "qris" && qrisAccounts.length === 0 && (
                <p className="text-xs text-muted-foreground italic">QRIS belum tersedia. Hubungi panitia.</p>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}

          {/* Info keranjang — tampil saat ada linked items */}
          {hasLinkedItems && (
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Tiket akan ditambahkan ke keranjang</p>
              {donationPrompt && (
                <p>+ Kamu bisa menambahkan donasi untuk <strong>{donationPrompt.campaignTitle}</strong></p>
              )}
              {linkedProductId && linkedProductTitle && (
                <p>+ Kamu bisa menambahkan <strong>{linkedProductTitle}</strong></p>
              )}
            </div>
          )}

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={isPending || !selectedTicketId}
            className="w-full"
            size="sm"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {hasLinkedItems ? "Menambahkan ke Keranjang..." : "Mendaftarkan..."}
              </>
            ) : hasLinkedItems ? (
              "Lanjut ke Keranjang →"
            ) : (
              isPaidTicket ? "Daftar & Lanjut Bayar" : "Daftar Sekarang"
            )}
          </Button>
        </>
      )}
    </div>

    {/* Modal prompt donasi — tampil setelah registrasi gratis */}
    {showDonationModal && donationPrompt && (
      <DonationPromptModal
        tenantSlug={slug}
        campaignId={donationPrompt.campaignId}
        campaignTitle={donationPrompt.campaignTitle}
        amounts={donationPrompt.amounts}
        onClose={() => setShowDonationModal(false)}
      />
    )}
    </>
  );
}
