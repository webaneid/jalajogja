"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Ticket, Loader2, Copy, Check } from "lucide-react";
import { registerForEventAction } from "@/app/(dashboard)/[tenant]/event/actions";

// ─── Types ────────────────────────────────────────────────────────────────────

type TicketInfo = {
  id:          string;
  name:        string;
  price:       number;
  quota:       number | null;
  description: string | null | undefined;
  usedCount?:  number;  // jumlah pendaftaran aktif (untuk tampil sisa kuota di form)
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
  slug:            string;
  eventId:         string;
  tickets:         TicketInfo[];
  requireApproval: boolean;
  banks:           BankAccount[];
  qrisAccounts:    QrisAccount[];
  hasPaidTicket:   boolean;
};

// ─── Helper ───────────────────────────────────────────────────────────────────

function formatRupiah(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
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
}: EventRegisterFormProps) {
  // Pilihan tiket
  const [selectedTicketId, setSelectedTicketId] = useState<string>(tickets[0]?.id ?? "");

  // Form peserta
  const [attendeeName,  setAttendeeName]  = useState("");
  const [attendeePhone, setAttendeePhone] = useState("");
  const [attendeeEmail, setAttendeeEmail] = useState("");

  // Pembayaran
  const [method,         setMethod]         = useState<"cash" | "transfer" | "qris">("transfer");
  const [bankAccountRef, setBankAccountRef] = useState<string>(banks[0]?.id ?? "");
  const [qrisAccountRef, setQrisAccountRef] = useState<string>(qrisAccounts[0]?.id ?? "");

  // State UI
  const [error,   setError]   = useState<string | null>(null);
  const [copied,  setCopied]  = useState(false);
  const [success, setSuccess] = useState<{
    registrationNumber: string;
    isPaid:             boolean;
    amount?:            number;
    uniqueCode?:        number;
    totalAmount?:       number;
  } | null>(null);

  const [isPending, startTransition] = useTransition();

  const selectedTicket = tickets.find((t) => t.id === selectedTicketId);
  const isPaidTicket   = (selectedTicket?.price ?? 0) > 0;
  const selectedBank   = banks.find((b) => b.id === bankAccountRef);
  const selectedQris   = qrisAccounts.find((q) => q.id === qrisAccountRef);

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

    startTransition(async () => {
      const res = await registerForEventAction(slug, {
        eventId,
        ticketId:       selectedTicketId,
        attendeeName,
        attendeePhone:  attendeePhone || null,
        attendeeEmail:  attendeeEmail || null,
        method:         isPaidTicket ? method : undefined,
        bankAccountRef: isPaidTicket && method === "transfer" ? bankAccountRef || null : null,
        qrisAccountRef: isPaidTicket && method === "qris"     ? qrisAccountRef || null : null,
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
      });
    });
  }

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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

        {/* Transfer — tampilkan instruksi pembayaran */}
        {!success.isPaid && success.amount !== undefined && method === "transfer" && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 space-y-3 text-sm dark:bg-amber-950 dark:border-amber-700">
            <p className="font-semibold text-amber-800 dark:text-amber-200">Selesaikan Pembayaran</p>
            <div className="space-y-2 text-amber-900 dark:text-amber-100">
              <p>
                Transfer sebesar{" "}
                <span className="font-bold text-base">{formatRupiah(success.totalAmount ?? success.amount)}</span>
                {(success.uniqueCode ?? 0) > 0 && (
                  <span className="text-xs ml-1">
                    (termasuk kode unik{" "}
                    <span className="font-mono">{success.uniqueCode}</span>)
                  </span>
                )}
              </p>
              {selectedBank && (
                <div className="rounded-md bg-white dark:bg-black/20 border border-amber-200 dark:border-amber-800 p-3 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">{selectedBank.bankName}</p>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold">{selectedBank.accountNumber}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(selectedBank.accountNumber)}
                      className="text-amber-600 hover:text-amber-800"
                    >
                      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">a.n. {selectedBank.accountName}</p>
                </div>
              )}
              <p className="text-xs">Setelah transfer, tunggu konfirmasi dari panitia.</p>
            </div>
          </div>
        )}

        {/* QRIS — tampilkan gambar */}
        {!success.isPaid && success.amount !== undefined && method === "qris" && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 space-y-3 text-sm dark:bg-amber-950 dark:border-amber-700">
            <p className="font-semibold text-amber-800 dark:text-amber-200">Selesaikan Pembayaran via QRIS</p>
            <p className="text-amber-900 dark:text-amber-100">
              Scan QRIS dan bayar sebesar{" "}
              <span className="font-bold">{formatRupiah(success.totalAmount ?? success.amount)}</span>
            </p>
            {selectedQris?.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={selectedQris.imageUrl}
                alt="QRIS"
                className="w-48 mx-auto rounded-lg border border-amber-200"
              />
            )}
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Nama QRIS: {selectedQris?.name ?? "—"}
            </p>
          </div>
        )}

        {/* Cash */}
        {!success.isPaid && success.amount !== undefined && method === "cash" && (
          <div className="rounded-lg border border-blue-300 bg-blue-50 p-4 text-sm dark:bg-blue-950 dark:border-blue-700">
            <p className="font-semibold text-blue-800 dark:text-blue-200">Pembayaran Tunai</p>
            <p className="text-blue-900 dark:text-blue-100 mt-1">
              Bayar sebesar <span className="font-bold">{formatRupiah(success.amount)}</span> kepada panitia saat acara.
            </p>
          </div>
        )}
      </div>
    );
  }

  // ── Form state ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Pilihan Tiket */}
      {tickets.length > 1 && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Pilih Tiket</Label>
          <div className="space-y-2">
            {tickets.map((t) => (
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
            ))}
          </div>
        </div>
      )}

      {/* Info tiket tunggal */}
      {tickets.length === 1 && (
        <div className="rounded-lg border border-border bg-muted/20 p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Ticket className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{tickets[0].name}</span>
          </div>
          <span className="text-sm font-semibold">
            {tickets[0].price <= 0 ? "Gratis" : formatRupiah(tickets[0].price)}
          </span>
        </div>
      )}

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
          <Label htmlFor="attendeePhone" className="text-sm">
            Nomor HP
          </Label>
          <Input
            id="attendeePhone"
            value={attendeePhone}
            onChange={(e) => setAttendeePhone(e.target.value)}
            placeholder="08xxx"
            disabled={isPending}
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

      {/* Metode Pembayaran — hanya untuk tiket berbayar */}
      {isPaidTicket && (
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
            Mendaftarkan...
          </>
        ) : (
          isPaidTicket ? "Daftar & Lanjut Bayar" : "Daftar Sekarang"
        )}
      </Button>
    </div>
  );
}
