"use client";

import { useState, useTransition } from "react";
import { displayPhone } from "@/lib/phone";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  XCircle, UserCheck,
  Search, Loader2, BadgeCheck, BanknoteIcon, ExternalLink, ImageIcon, X as XIcon, Pencil,
} from "lucide-react";
import {
  approveRegistrationAction,
  confirmRegistrationPaymentAction,
  confirmEventInvoicePaymentAction,
  cancelRegistrationAction,
  updateRegistrationDataAction,
} from "@/app/(dashboard)/app/[tenant]/event/actions";
import type { CustomFormField } from "@/lib/event-custom-form";
import { EventCertificateButton } from "./event-certificate-button";
import { MemberNameAutocomplete, type SelectedMember } from "@/components/keuangan/member-name-autocomplete";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RegistrationRow = {
  id:                 string;
  registrationNumber: string;
  attendeeName:       string;
  attendeePhone:      string | null;
  attendeeEmail:      string | null;
  status:             "pending" | "confirmed" | "cancelled" | "attended";
  checkedInAt:        Date | null;
  ticketName:         string;
  ticketPrice:        number;
  paymentId:          string | null;
  paymentStatus:      "pending" | "submitted" | "paid" | "cancelled" | null;
  paymentMethod:      string | null;
  invoiceId:          string | null;
  invoiceStatus:      string | null;
  proofUrl:           string | null;
  certificateUrl:     string | null;
  createdAt:          Date;
  customFields:       Record<string, string> | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<RegistrationRow["status"], { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending:   { label: "Menunggu",   variant: "secondary"   },
  confirmed: { label: "Dikonfirmasi", variant: "default"   },
  cancelled: { label: "Dibatalkan", variant: "destructive" },
  attended:  { label: "Hadir",      variant: "outline"     },
};

function formatRupiah(n: number) {
  return "Rp " + new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n);
}

function formatDate(d: Date | null, timezone: string) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: timezone }).format(new Date(d));
}

// ─── EventRegistrationList ────────────────────────────────────────────────────

export function EventRegistrationList({
  slug,
  eventId,
  registrations: initialRows,
  timezone,
  enableCustomForm,
  customFormFields,
}: {
  slug:             string;
  eventId:          string;
  registrations:    RegistrationRow[];
  timezone:         string;
  enableCustomForm: boolean;
  customFormFields: CustomFormField[];
}) {
  const [rows,      setRows]      = useState<RegistrationRow[]>(initialRows);
  const [search,    setSearch]    = useState("");
  const [actionId,  setActionId]  = useState<string | null>(null);
  const [error,     setError]     = useState<string | null>(null);
  const [proofOpen, setProofOpen] = useState<string | null>(null); // URL lightbox bukti
  const [editRow,   setEditRow]   = useState<RegistrationRow | null>(null); // dialog edit data peserta
  const [isPending, startTransition] = useTransition();

  const filtered = rows.filter((r) => {
    const q = search.toLowerCase();
    return (
      r.attendeeName.toLowerCase().includes(q) ||
      r.registrationNumber.toLowerCase().includes(q) ||
      (r.attendeePhone ?? "").toLowerCase().includes(q) ||
      (r.attendeeEmail ?? "").toLowerCase().includes(q)
    );
  });

  function runAction(
    id: string,
    fn: () => Promise<{ success: boolean; error?: string }>
  ) {
    setError(null);
    setActionId(id);
    startTransition(async () => {
      const res = await fn();
      setActionId(null);
      if (!res.success) {
        setError(res.error ?? "Terjadi kesalahan.");
        return;
      }
      // Optimistic update status
      setRows((prev) => prev.map((r) => {
        if (r.id !== id) return r;
        return r; // data sudah di-revalidate via server action
      }));
      // Refresh data via router (server revalidatePath sudah dipanggil)
      window.location.reload();
    });
  }

  if (rows.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-muted-foreground">
        Belum ada pendaftaran untuk event ini.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cari nama, nomor, email, HP..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9 text-sm"
        />
      </div>

      {error && (
        <p className="text-xs text-destructive bg-destructive/10 rounded px-3 py-2">{error}</p>
      )}

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-3 py-2.5 font-medium text-xs text-muted-foreground">No. Daftar</th>
              <th className="text-left px-3 py-2.5 font-medium text-xs text-muted-foreground">Peserta</th>
              <th className="text-left px-3 py-2.5 font-medium text-xs text-muted-foreground hidden sm:table-cell">Tiket</th>
              <th className="text-left px-3 py-2.5 font-medium text-xs text-muted-foreground hidden md:table-cell">Daftar</th>
              <th className="text-left px-3 py-2.5 font-medium text-xs text-muted-foreground">Status</th>
              <th className="text-right px-3 py-2.5 font-medium text-xs text-muted-foreground">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((reg) => {
              const isLoading  = isPending && actionId === reg.id;
              const isPaid     = reg.paymentStatus === "paid" || reg.ticketPrice <= 0;
              const isWaiting  = reg.invoiceStatus === "waiting_verification";

              return (
                <tr key={reg.id} className={`hover:bg-muted/20 transition-colors ${isWaiting ? "bg-amber-50/40 dark:bg-amber-950/20" : ""}`}>
                  <td className="px-3 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                    {reg.registrationNumber}
                    {reg.invoiceId && (
                      <a
                        href={`/app/${slug}/finance/billing/invoice/${reg.invoiceId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-[10px] text-primary hover:underline mt-0.5"
                      >
                        Lihat Invoice <ExternalLink className="inline h-2.5 w-2.5" />
                      </a>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-medium">{reg.attendeeName}</p>
                    {reg.attendeePhone && (
                      <p className="text-xs text-muted-foreground">{displayPhone(reg.attendeePhone)}</p>
                    )}
                    {reg.attendeeEmail && (
                      <p className="text-xs text-muted-foreground">{reg.attendeeEmail}</p>
                    )}
                  </td>
                  <td className="px-3 py-3 hidden sm:table-cell">
                    <p className="text-xs">{reg.ticketName}</p>
                    {reg.ticketPrice > 0 && (
                      <p className="text-xs text-muted-foreground">{formatRupiah(reg.ticketPrice)}</p>
                    )}
                    {reg.ticketPrice <= 0 && (
                      <p className="text-xs text-muted-foreground">Gratis</p>
                    )}
                  </td>
                  <td className="px-3 py-3 hidden md:table-cell text-xs text-muted-foreground whitespace-nowrap">
                    {formatDate(reg.createdAt, timezone)}
                  </td>
                  <td className="px-3 py-3">
                    <div className="space-y-1">
                      <Badge variant={STATUS_CONFIG[reg.status].variant} className="text-xs">
                        {STATUS_CONFIG[reg.status].label}
                      </Badge>
                      {reg.ticketPrice > 0 && (
                        <div className="text-xs text-muted-foreground">
                          {isWaiting
                            ? <span className="font-medium text-amber-600 dark:text-amber-400">⏳ Menunggu verifikasi</span>
                            : reg.paymentStatus === "paid"
                            ? "✓ Lunas"
                            : reg.paymentStatus === "cancelled"
                            ? "Dibatalkan"
                            : reg.invoiceId
                            ? "Belum bayar"
                            : "—"}
                        </div>
                      )}
                      {/* Thumbnail bukti bayar */}
                      {reg.proofUrl && (
                        <button
                          onClick={() => setProofOpen(reg.proofUrl!)}
                          className="flex items-center gap-1 text-[10px] text-primary hover:underline"
                        >
                          <ImageIcon className="h-3 w-3" />
                          Lihat bukti
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-end gap-1.5 flex-wrap">
                      {isLoading && (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                      )}

                      {/* Konfirmasi pembayaran — via invoice (alur publik baru) */}
                      {!isLoading && reg.paymentId && isWaiting && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs border-amber-500 text-amber-700 hover:bg-amber-50 dark:border-amber-400 dark:text-amber-300"
                          title="Konfirmasi Pembayaran"
                          onClick={() =>
                            runAction(reg.id, () =>
                              confirmEventInvoicePaymentAction(slug, reg.paymentId!)
                            )
                          }
                        >
                          <BanknoteIcon className="h-3 w-3 mr-1" />
                          Konfirmasi
                        </Button>
                      )}

                      {/* Konfirmasi pembayaran — alur lama (payment sourceType='event_registration') */}
                      {!isLoading && reg.paymentId &&
                        !isWaiting &&
                        reg.paymentStatus === "submitted" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          title="Konfirmasi Pembayaran"
                          onClick={() =>
                            runAction(reg.id, () =>
                              confirmRegistrationPaymentAction(slug, reg.paymentId!)
                            )
                          }
                        >
                          <BanknoteIcon className="h-3 w-3 mr-1" />
                          Konfirmasi
                        </Button>
                      )}

                      {/* Setujui pendaftaran gratis / waiting approval */}
                      {!isLoading &&
                        reg.status === "pending" &&
                        (isPaid || reg.ticketPrice <= 0) &&
                        !isWaiting && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          title="Setujui Pendaftaran"
                          onClick={() =>
                            runAction(reg.id, () =>
                              approveRegistrationAction(slug, reg.id)
                            )
                          }
                        >
                          <BadgeCheck className="h-3 w-3 mr-1" />
                          Setujui
                        </Button>
                      )}

                      {/* Edit data peserta — nama/HP/email/custom form, terlepas status.
                          Untuk koreksi registrasi yang terlanjur masuk salah/tidak lengkap
                          (mis. hasil invoice manual admin sebelum fix custom form). */}
                      {!isLoading && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                          title="Edit Data Peserta"
                          onClick={() => setEditRow(reg)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}

                      {/* Batalkan */}
                      {!isLoading && reg.status !== "cancelled" && reg.status !== "attended" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          title="Batalkan Pendaftaran"
                          onClick={() =>
                            runAction(reg.id, () =>
                              cancelRegistrationAction(slug, reg.id)
                            )
                          }
                        >
                          <XCircle className="h-3.5 w-3.5" />
                        </Button>
                      )}

                      {/* Sertifikat — hanya untuk yang sudah hadir (check-in) */}
                      {!isLoading && reg.status === "attended" && (
                        <EventCertificateButton
                          slug={slug}
                          eventId={eventId}
                          registrationId={reg.id}
                          existingUrl={reg.certificateUrl}
                        />
                      )}

                      {/* Status icons */}
                      {reg.status === "attended" && (
                        <UserCheck className="h-4 w-4 text-green-500" />
                      )}
                      {reg.status === "cancelled" && (
                        <XCircle className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filtered.length === 0 && search && (
          <div className="text-center py-8 text-sm text-muted-foreground">
            Tidak ada hasil untuk &ldquo;{search}&rdquo;
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Menampilkan {filtered.length} dari {rows.length} pendaftar
      </p>

      {/* Lightbox bukti bayar */}
      {proofOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setProofOpen(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white"
            onClick={() => setProofOpen(null)}
          >
            <XIcon className="h-6 w-6" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={proofOpen}
            alt="Bukti Bayar"
            className="max-w-full max-h-[85vh] rounded-lg object-contain"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}

      {/* Edit data peserta */}
      {editRow && (
        <EditRegistrationDialog
          slug={slug}
          row={editRow}
          enableCustomForm={enableCustomForm}
          customFormFields={customFormFields}
          onClose={() => setEditRow(null)}
          onSaved={() => window.location.reload()}
        />
      )}
    </div>
  );
}

// ─── EditRegistrationDialog ────────────────────────────────────────────────────
// Koreksi data peserta (nama/HP/email/formulir tambahan) untuk registrasi yang sudah
// terlanjur masuk — mis. hasil invoice manual admin sebelum custom form ikut terpasang,
// atau salah ketik saat pendaftaran publik. Tidak mengubah status/pembayaran.

function EditRegistrationDialog({
  slug,
  row,
  enableCustomForm,
  customFormFields,
  onClose,
  onSaved,
}: {
  slug:             string;
  row:              RegistrationRow;
  enableCustomForm: boolean;
  customFormFields: CustomFormField[];
  onClose:          () => void;
  onSaved:          () => void;
}) {
  const [name,  setName]  = useState(row.attendeeName);
  const [phone, setPhone] = useState(row.attendeePhone ?? "");
  const [email, setEmail] = useState(row.attendeeEmail ?? "");
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of customFormFields) {
      const v = row.customFields?.[f.key];
      if (v !== undefined && v !== null) init[f.key] = String(v);
    }
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  function setAnswer(key: string, v: string) {
    setAnswers((prev) => ({ ...prev, [key]: v }));
  }

  // Anggota dipilih dari autocomplete → auto-isi HP+email. Ketik manual (member=null)
  // → TIDAK menghapus HP/email yang sudah diisi, biarkan tetap bisa diedit sendiri.
  function handleSelectMember(m: SelectedMember | null) {
    if (m) {
      setPhone(m.phone);
      setEmail(m.email);
    }
  }

  async function handleSave() {
    if (!name.trim()) {
      setError("Nama peserta wajib diisi.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await updateRegistrationDataAction(slug, row.id, {
      attendeeName:       name,
      attendeePhone:      phone,
      attendeeEmail:      email,
      customFieldAnswers: answers,
    });
    setSaving(false);
    if (!res.success) {
      setError(res.error ?? "Gagal menyimpan data peserta.");
      return;
    }
    onSaved();
  }

  const labelCls = "text-sm font-medium mb-1 block";

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Data Peserta</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className={labelCls}>Nama Peserta <span className="text-destructive">*</span></label>
            <MemberNameAutocomplete
              slug={slug}
              value={name}
              onChange={setName}
              onSelectMember={handleSelectMember}
              placeholder="Ketik nama — cari dari anggota atau isi manual"
              required
            />
          </div>

          <PhoneInput label="HP Peserta" optional value={phone} onChange={setPhone} />

          <div>
            <label className={labelCls}>Email Peserta</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          {enableCustomForm && customFormFields.length > 0 && (
            <div className="space-y-2.5 pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground">Formulir tambahan dari event ini:</p>
              {customFormFields.map((field) => {
                const value = answers[field.key] ?? "";
                return (
                  <div key={field.key}>
                    <label className={labelCls}>
                      {field.label}
                      {field.required && <span className="text-destructive"> *</span>}
                    </label>

                    {field.type === "select" && field.options && field.options.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {field.options.map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setAnswer(field.key, opt)}
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
                    ) : field.type === "datetime" ? (
                      <input
                        type="datetime-local"
                        value={value}
                        onChange={(e) => setAnswer(field.key, e.target.value)}
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                    ) : (
                      <Input
                        type={field.type === "number" ? "number" : "text"}
                        value={value}
                        onChange={(e) => setAnswer(field.key, e.target.value)}
                        placeholder={field.placeholder ?? ""}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Batal
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
