"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ChevronLeft, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  createDonationAction,
  type DonationData,
} from "@/app/(dashboard)/[tenant]/donasi/actions";

// ─── Types ────────────────────────────────────────────────────────────────────

type Campaign = { id: string; title: string; campaignType: string };

export type DonationFormProps = {
  slug:            string;
  campaigns:       Campaign[];
  defaultCampaignId?: string | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const DONATION_TYPES = [
  { value: "donasi", label: "Donasi Umum" },
  { value: "zakat",  label: "Zakat"       },
  { value: "wakaf",  label: "Wakaf"       },
  { value: "qurban", label: "Qurban"      },
] as const;

const METHODS = [
  { value: "cash",     label: "Tunai"    },
  { value: "transfer", label: "Transfer" },
  { value: "qris",     label: "QRIS"     },
] as const;

// ─── DonationForm ─────────────────────────────────────────────────────────────

export function DonationForm({ slug, campaigns, defaultCampaignId }: DonationFormProps) {
  const router = useRouter();

  const [campaignId,    setCampaignId]    = useState<string | null>(defaultCampaignId ?? null);
  const [donationType,  setDonationType]  = useState<DonationData["donationType"]>("donasi");
  const [donorName,     setDonorName]     = useState("");
  const [donorPhone,    setDonorPhone]    = useState("");
  const [donorEmail,    setDonorEmail]    = useState("");
  const [donorMessage,  setDonorMessage]  = useState("");
  const [isAnonymous,   setIsAnonymous]   = useState(false);
  const [amount,        setAmount]        = useState("");
  const [method,        setMethod]        = useState<DonationData["method"]>("cash");
  const [error,         setError]         = useState<string | null>(null);
  const [success,       setSuccess]       = useState<{
    donationId:  string;
    uniqueCode:  number;
    totalAmount: number;
  } | null>(null);

  const [campaignOpen, setCampaignOpen] = useState(false);
  const [typeOpen,     setTypeOpen]     = useState(false);
  const [methodOpen,   setMethodOpen]   = useState(false);
  const [isPending, startTransition]    = useTransition();

  const selectedCampaign = campaigns.find((c) => c.id === campaignId);

  function handleSubmit() {
    setError(null);
    const n = parseFloat(amount);
    if (!donorName.trim()) { setError("Nama donatur wajib diisi."); return; }
    if (!amount.trim() || isNaN(n) || n <= 0) { setError("Nominal donasi tidak valid."); return; }

    startTransition(async () => {
      const res = await createDonationAction(slug, {
        campaignId:   campaignId ?? null,
        donationType,
        donorName,
        donorPhone:   donorPhone  || null,
        donorEmail:   donorEmail  || null,
        donorMessage: donorMessage || null,
        isAnonymous,
        amount:       n,
        method,
      });

      if (!res.success) {
        setError(res.error);
        return;
      }

      setSuccess({
        donationId:  res.data.donationId,
        uniqueCode:  res.data.uniqueCode,
        totalAmount: res.data.totalAmount,
      });
    });
  }

  if (success) {
    return (
      <div className="p-6 max-w-lg space-y-6">
        <div className="rounded-lg bg-green-50 border border-green-200 p-6 space-y-3">
          <p className="font-semibold text-green-800">Donasi berhasil dicatat!</p>
          {success.uniqueCode > 0 && (
            <div className="rounded-md bg-white border border-green-200 p-4 space-y-1">
              <p className="text-sm text-muted-foreground">Transfer nominal:</p>
              <p className="text-2xl font-bold font-mono">
                {new Intl.NumberFormat("id-ID").format(success.totalAmount)}
              </p>
              <p className="text-xs text-muted-foreground">
                (nominal + kode unik{" "}
                <span className="font-mono font-semibold">{success.uniqueCode}</span>)
              </p>
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            {method === "cash"
              ? "Donasi tunai langsung ditandai sebagai perlu konfirmasi."
              : "Minta donatur transfer dan upload bukti. Konfirmasi setelah terima."}
          </p>
        </div>
        <div className="flex gap-3">
          <Link href={`/${slug}/donasi/transaksi/${success.donationId}`}>
            <Button variant="outline">Lihat Detail</Button>
          </Link>
          <Button onClick={() => {
            setSuccess(null);
            setDonorName(""); setDonorPhone(""); setDonorEmail(""); setDonorMessage("");
            setAmount(""); setIsAnonymous(false);
          }}>
            Input Donasi Lagi
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/${slug}/donasi/transaksi`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Transaksi
        </Link>
        <h1 className="text-lg font-semibold">Input Donasi</h1>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Campaign — Combobox */}
      <div className="space-y-2">
        <Label>Campaign (opsional)</Label>
        <Popover open={campaignOpen} onOpenChange={setCampaignOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              className="w-full justify-between font-normal"
            >
              {selectedCampaign?.title ?? "Donasi Umum (tanpa campaign)"}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[380px] p-0">
            <Command>
              <CommandInput placeholder="Cari campaign..." />
              <CommandList>
                <CommandEmpty>Tidak ditemukan</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value=""
                    onSelect={() => { setCampaignId(null); setCampaignOpen(false); }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", !campaignId ? "opacity-100" : "opacity-0")} />
                    Donasi Umum (tanpa campaign)
                  </CommandItem>
                  {campaigns.map((c) => (
                    <CommandItem
                      key={c.id}
                      value={c.title}
                      onSelect={() => { setCampaignId(c.id); setCampaignOpen(false); }}
                    >
                      <Check className={cn("mr-2 h-4 w-4", campaignId === c.id ? "opacity-100" : "opacity-0")} />
                      {c.title}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Jenis — Combobox */}
      <div className="space-y-2">
        <Label>Jenis Donasi</Label>
        <Popover open={typeOpen} onOpenChange={setTypeOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
              {DONATION_TYPES.find((t) => t.value === donationType)?.label ?? "Pilih jenis"}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[220px] p-0">
            <Command>
              <CommandList>
                <CommandGroup>
                  {DONATION_TYPES.map((t) => (
                    <CommandItem
                      key={t.value}
                      value={t.value}
                      onSelect={() => { setDonationType(t.value); setTypeOpen(false); }}
                    >
                      <Check className={cn("mr-2 h-4 w-4", donationType === t.value ? "opacity-100" : "opacity-0")} />
                      {t.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Identitas Donatur */}
      <div className="space-y-4 pt-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Identitas Donatur
        </p>

        <div className="flex items-center justify-between">
          <Label htmlFor="anonymous">Anonim</Label>
          <button
            id="anonymous"
            type="button"
            onClick={() => setIsAnonymous(!isAnonymous)}
            className={cn(
              "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
              isAnonymous ? "bg-primary" : "bg-input"
            )}
          >
            <span
              className={cn(
                "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                isAnonymous ? "translate-x-4" : "translate-x-0"
              )}
            />
          </button>
        </div>

        <div className="space-y-2">
          <Label htmlFor="donorName">Nama Donatur</Label>
          <Input
            id="donorName"
            value={donorName}
            onChange={(e) => setDonorName(e.target.value)}
            placeholder={isAnonymous ? "Nama internal (tidak ditampilkan)" : "Nama lengkap"}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="donorPhone">Telepon</Label>
            <Input
              id="donorPhone"
              value={donorPhone}
              onChange={(e) => setDonorPhone(e.target.value)}
              placeholder="08xxx"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="donorEmail">Email</Label>
            <Input
              id="donorEmail"
              type="email"
              value={donorEmail}
              onChange={(e) => setDonorEmail(e.target.value)}
              placeholder="email@..."
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="donorMessage">Pesan / Doa</Label>
          <Textarea
            id="donorMessage"
            value={donorMessage}
            onChange={(e) => setDonorMessage(e.target.value)}
            placeholder="Pesan dari donatur (opsional)"
            rows={3}
          />
        </div>
      </div>

      {/* Pembayaran */}
      <div className="space-y-4 pt-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Pembayaran
        </p>

        <div className="space-y-2">
          <Label htmlFor="amount">Nominal (Rp)</Label>
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-sm text-muted-foreground">Rp</span>
            <Input
              id="amount"
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="pl-9"
            />
          </div>
        </div>

        {/* Metode — Combobox */}
        <div className="space-y-2">
          <Label>Metode Pembayaran</Label>
          <Popover open={methodOpen} onOpenChange={setMethodOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                {METHODS.find((m) => m.value === method)?.label ?? "Pilih metode"}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[220px] p-0">
              <Command>
                <CommandList>
                  <CommandGroup>
                    {METHODS.map((m) => (
                      <CommandItem
                        key={m.value}
                        value={m.value}
                        onSelect={() => { setMethod(m.value); setMethodOpen(false); }}
                      >
                        <Check className={cn("mr-2 h-4 w-4", method === m.value ? "opacity-100" : "opacity-0")} />
                        {m.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {method === "transfer" && (
            <p className="text-xs text-muted-foreground">
              Kode unik 3 digit akan ditambahkan ke nominal transfer.
            </p>
          )}
        </div>
      </div>

      <Button onClick={handleSubmit} disabled={isPending} className="w-full">
        {isPending ? "Menyimpan..." : "Simpan Donasi"}
      </Button>
    </div>
  );
}
