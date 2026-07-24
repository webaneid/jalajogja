"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { saveMembershipConfigAction, type MembershipConfigData } from "@/app/(dashboard)/app/[tenant]/settings/actions";
import {
  FORUM_MEMBERSHIP_NUMBER_FORMATS, FORUM_MEMBERSHIP_NUMBER_FORMAT_LABELS,
  type ForumMembershipNumberFormat,
} from "@/lib/forum-membership-number";

type Option = { id: string; label: string };

export function MembershipConfigForm({
  slug,
  products,
  campaigns,
  defaultValues,
}: {
  slug:          string;
  products:      Option[];
  campaigns:     Option[];
  defaultValues: MembershipConfigData;
}) {
  const router = useRouter();
  const [pending, setPending]   = React.useState(false);
  const [productId,  setProductId]  = React.useState(defaultValues.requiredProductId ?? "");
  const [campaignId, setCampaignId] = React.useState(defaultValues.requiredCampaignId ?? "");
  const [paymentRequired, setPaymentRequired] = React.useState(defaultValues.paymentRequired);
  const [requireMode, setRequireMode] = React.useState<"either" | "both">(defaultValues.requireMode);
  const [registrationInfo, setRegistrationInfo] = React.useState(defaultValues.registrationInfo ?? "");
  const [numberEnabled, setNumberEnabled] = React.useState(!!defaultValues.membershipNumberFormat);
  const [numberFormat, setNumberFormat] = React.useState<ForumMembershipNumberFormat>(
    defaultValues.membershipNumberFormat ?? "year_seq",
  );

  const productOptions:  ComboboxOption[] = products.map((p) => ({ value: p.id, label: p.label }));
  const campaignOptions: ComboboxOption[] = campaigns.map((c) => ({ value: c.id, label: c.label }));

  const anyConfigured  = !!productId || !!campaignId;
  const bothConfigured = !!productId && !!campaignId;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const result = await saveMembershipConfigAction(slug, {
        requiredProductId:  productId  || null,
        requiredCampaignId: campaignId || null,
        paymentRequired:    anyConfigured ? paymentRequired : false,
        requireMode,
        registrationInfo:   registrationInfo.trim() || null,
        membershipNumberFormat: numberEnabled ? numberFormat : null,
      });
      if (result.error) toast.error(result.error);
      else { toast.success("Pengaturan keanggotaan disimpan."); router.refresh(); }
    } finally { setPending(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-xl">
      <div className="space-y-2">
        <Label>Informasi Pendaftaran (opsional)</Label>
        <Textarea
          value={registrationInfo}
          onChange={(e) => setRegistrationInfo(e.target.value)}
          disabled={pending}
          rows={6}
          placeholder={
            "Contoh:\n" +
            "FORCREATOR IKPM Gontor adalah organisasi resmi di bawah Pengurus Pusat IKPM Gontor.\n\n" +
            "Keanggotaan FORCREATOR bersifat eksklusif — hanya alumni Gontor yang mendaftar sendiri " +
            "yang dapat menjadi anggota.\n\n" +
            "Keanggotaan FORCREATOR hanya memiliki satu jenis: anggota FORCREATOR IKPM Gontor. " +
            "Tidak ada cabang atau nama lain."
          }
        />
        <p className="text-xs text-muted-foreground">
          Teks ini tampil apa adanya di halaman publik <code className="text-xs">/gabung</code>,
          di atas tombol daftar — sebelum calon anggota menyetujui syarat & ketentuan. Cocok untuk
          menjelaskan sifat organisasi, aturan keanggotaan, atau hal lain yang perlu diketahui
          sebelum mendaftar. Baris baru dipertahankan sebagai paragraf terpisah.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Produk sebagai syarat iuran (opsional)</Label>
        <Combobox
          options={productOptions}
          value={productId}
          onValueChange={setProductId}
          placeholder="Tidak ada — kosongkan"
          searchPlaceholder="Cari produk..."
          emptyText="Tidak ada produk aktif."
          disabled={pending}
        />
      </div>

      <div className="space-y-2">
        <Label>Campaign/Donasi sebagai syarat iuran (opsional)</Label>
        <Combobox
          options={campaignOptions}
          value={campaignId}
          onValueChange={setCampaignId}
          placeholder="Tidak ada — kosongkan"
          searchPlaceholder="Cari campaign..."
          emptyText="Tidak ada campaign aktif."
          disabled={pending}
        />
        <p className="text-xs text-muted-foreground">
          Kosongkan keduanya kalau forum ini 100% gratis, tanpa ajakan bayar apa pun.
        </p>
      </div>

      {anyConfigured && (
        <div className="space-y-4 rounded-xl border border-border p-4">
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={paymentRequired}
              onChange={(e) => setPaymentRequired(e.target.checked)}
              disabled={pending}
              className="mt-0.5"
            />
            <span>
              Wajibkan pembayaran ini untuk anggota baru — kalau tidak dicentang, produk/campaign
              di atas cuma jadi ajakan dukungan sukarela (anggota tetap bisa bergabung gratis
              lewat halaman <code className="text-xs">/gabung</code>).
            </span>
          </label>

          {paymentRequired && bothConfigured && (
            <div className="space-y-2">
              <Label>Syarat pemenuhan (produk & campaign sekaligus ditunjuk)</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setRequireMode("either")}
                  disabled={pending}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${
                    requireMode === "either"
                      ? "border-primary bg-primary/5 font-medium text-primary"
                      : "border-border text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  Salah satu cukup
                </button>
                <button
                  type="button"
                  onClick={() => setRequireMode("both")}
                  disabled={pending}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${
                    requireMode === "both"
                      ? "border-primary bg-primary/5 font-medium text-primary"
                      : "border-border text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  Wajib keduanya
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="space-y-4 rounded-xl border border-border p-4">
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={numberEnabled}
            onChange={(e) => setNumberEnabled(e.target.checked)}
            disabled={pending}
            className="mt-0.5"
          />
          <span>
            Aktifkan Nomor Anggota Forum — nomor keanggotaan lokal khusus forum ini, terpisah
            dari No. Anggota IKPM global. Digenerate otomatis sekali saat member bergabung,
            urutannya jalan terus (tidak reset per tahun).
          </span>
        </label>

        {numberEnabled && (
          <div className="space-y-2">
            <Label>Format nomor</Label>
            <div className="space-y-2">
              {FORUM_MEMBERSHIP_NUMBER_FORMATS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setNumberFormat(f)}
                  disabled={pending}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                    numberFormat === f
                      ? "border-primary bg-primary/5 font-medium text-primary"
                      : "border-border text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  <span>{FORUM_MEMBERSHIP_NUMBER_FORMAT_LABELS[f].label}</span>
                  <span className="font-mono text-xs opacity-70">{FORUM_MEMBERSHIP_NUMBER_FORMAT_LABELS[f].example}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Berlaku untuk anggota BARU yang bergabung setelah format ini disimpan — nomor
              anggota yang sudah terbit tidak berubah retroaktif kalau format diganti nanti.
            </p>
          </div>
        )}
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Menyimpan..." : "Simpan"}
      </Button>
    </form>
  );
}
