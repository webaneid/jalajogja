"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import {
  savePaymentAccountsAction,
  saveQrisAccountsAction,
  saveGatewayConfigAction,
} from "@/app/(dashboard)/[tenant]/settings/actions";

// ─── Types ────────────────────────────────────────────────────────────────────

type BankAccount = {
  id: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  categories: string[];
};

type QrisAccount = {
  id: string;
  name: string;
  imageUrl: string;
  categories: string[];
  isDynamic: boolean;
  emvPayload?: string;
};

type GatewayMidtrans = { serverKey: string; clientKey: string; isSandbox: boolean } | null;
type GatewayXendit   = { apiKey: string } | null;
type GatewayIpaymu   = { va: string; apiKey: string } | null;

type DefaultValues = {
  bankAccounts: BankAccount[];
  qrisAccounts: QrisAccount[];
  midtrans:     GatewayMidtrans;
  xendit:       GatewayXendit;
  ipaymu:       GatewayIpaymu;
};

// ─── Konstanta ────────────────────────────────────────────────────────────────

const CATEGORY_OPTIONS = [
  { value: "general", label: "Umum (semua modul)" },
  { value: "toko",    label: "Toko"               },
  { value: "donasi",  label: "Donasi / Infaq"      },
];

const GATEWAY_TABS = ["midtrans", "xendit", "ipaymu"] as const;
type GatewayTab = (typeof GATEWAY_TABS)[number];

function newBank(): BankAccount {
  return { id: crypto.randomUUID(), bankName: "", accountNumber: "", accountName: "", categories: ["general"] };
}

function newQris(): QrisAccount {
  return { id: crypto.randomUUID(), name: "", imageUrl: "", categories: ["general"], isDynamic: false, emvPayload: "" };
}

// ─── Sub-komponen ─────────────────────────────────────────────────────────────

function Section({ title, description, children }: {
  title: string; description?: string; children: React.ReactNode;
}) {
  return (
    <fieldset className="space-y-4">
      <div className="border-b pb-2">
        <legend className="text-sm font-semibold text-foreground">{title}</legend>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </fieldset>
  );
}

function MaskedInput({ value, onChange, ...props }: Omit<React.ComponentProps<"input">, "onChange"> & {
  value: string; onChange: (v: string) => void;
}) {
  const [show, setShow] = React.useState(false);
  return (
    <div className="relative">
      <input
        {...props}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 pr-9 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
      >
        {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

// ─── Form ─────────────────────────────────────────────────────────────────────

export function PaymentSettingsForm({ slug, defaultValues }: { slug: string; defaultValues: DefaultValues }) {
  const router = useRouter();

  // ── Rekening Bank ──
  const [banks, setBanks] = React.useState<BankAccount[]>(defaultValues.bankAccounts);
  const [savingBanks, setSavingBanks] = React.useState(false);

  function updateBank(id: string, field: keyof BankAccount, value: string | string[]) {
    setBanks((prev) => prev.map((b) => b.id === id ? { ...b, [field]: value } : b));
  }

  async function handleSaveBanks(e: React.FormEvent) {
    e.preventDefault();
    setSavingBanks(true);
    try {
      const result = await savePaymentAccountsAction(slug, banks);
      if (result.error) toast.error(result.error);
      else { toast.success("Rekening bank disimpan."); router.refresh(); }
    } finally { setSavingBanks(false); }
  }

  // ── QRIS ──
  const [qrisList, setQrisList] = React.useState<QrisAccount[]>(defaultValues.qrisAccounts);
  const [savingQris, setSavingQris] = React.useState(false);

  function updateQris(id: string, field: keyof QrisAccount, value: unknown) {
    setQrisList((prev) => prev.map((q) => q.id === id ? { ...q, [field]: value } : q));
  }

  async function handleSaveQris(e: React.FormEvent) {
    e.preventDefault();
    setSavingQris(true);
    try {
      const result = await saveQrisAccountsAction(slug, qrisList);
      if (result.error) toast.error(result.error);
      else { toast.success("QRIS disimpan."); router.refresh(); }
    } finally { setSavingQris(false); }
  }

  // ── Gateway ──
  const [gatewayTab, setGatewayTab] = React.useState<GatewayTab>("midtrans");
  const [midtrans, setMidtrans] = React.useState(defaultValues.midtrans ?? { serverKey: "", clientKey: "", isSandbox: false });
  const [xendit,   setXendit]   = React.useState(defaultValues.xendit   ?? { apiKey: "" });
  const [ipaymu,   setIpaymu]   = React.useState(defaultValues.ipaymu   ?? { va: "", apiKey: "" });
  const [savingGateway, setSavingGateway] = React.useState(false);

  async function handleSaveGateway(e: React.FormEvent) {
    e.preventDefault();
    setSavingGateway(true);
    try {
      const result = await saveGatewayConfigAction(slug, { midtrans, xendit, ipaymu });
      if (result.error) toast.error(result.error);
      else { toast.success("Konfigurasi gateway disimpan."); router.refresh(); }
    } finally { setSavingGateway(false); }
  }

  return (
    <div className="space-y-10">

      {/* ════ REKENING BANK ════ */}
      <form onSubmit={handleSaveBanks}>
        <Section
          title="Rekening Bank"
          description="Rekening untuk penerimaan transfer manual. Bisa lebih dari satu."
        >
          <div className="space-y-4">
            {banks.length === 0 && (
              <p className="text-sm text-muted-foreground">Belum ada rekening. Klik + untuk menambah.</p>
            )}

            {banks.map((bank) => (
              <div key={bank.id} className="rounded-lg border p-4 space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Nama Bank</Label>
                    <Input
                      value={bank.bankName}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateBank(bank.id, "bankName", e.target.value)}
                      placeholder="BCA, BRI, Mandiri, dll."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Nomor Rekening</Label>
                    <Input
                      value={bank.accountNumber}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateBank(bank.id, "accountNumber", e.target.value)}
                      placeholder="1234567890"
                      inputMode="numeric"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Atas Nama</Label>
                    <Input
                      value={bank.accountName}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateBank(bank.id, "accountName", e.target.value)}
                      placeholder="IKPM Yogyakarta"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Kategori</Label>
                    <div className="flex flex-wrap gap-2">
                      {CATEGORY_OPTIONS.map((cat) => {
                        const active = bank.categories.includes(cat.value);
                        return (
                          <button
                            key={cat.value}
                            type="button"
                            onClick={() => {
                              const next = active
                                ? bank.categories.filter((c) => c !== cat.value)
                                : [...bank.categories, cat.value];
                              updateBank(bank.id, "categories", next);
                            }}
                            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                              active
                                ? "bg-primary text-primary-foreground"
                                : "border border-input bg-background text-muted-foreground hover:bg-accent"
                            }`}
                          >
                            {cat.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setBanks((prev) => prev.filter((b) => b.id !== bank.id))}
                    className="flex items-center gap-1.5 text-xs text-destructive hover:text-destructive/80"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Hapus
                  </button>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={() => setBanks((prev) => [...prev, newBank()])}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-4 w-4" /> Tambah Rekening
            </button>
          </div>

          <Button type="submit" disabled={savingBanks} className="mt-2">
            {savingBanks ? "Menyimpan..." : "Simpan Rekening"}
          </Button>
        </Section>
      </form>

      {/* ════ QRIS ════ */}
      <form onSubmit={handleSaveQris}>
        <Section
          title="QRIS"
          description="QRIS statis (gambar) atau dinamis (nominal terkunci otomatis)."
        >
          <div className="space-y-4">
            {qrisList.length === 0 && (
              <p className="text-sm text-muted-foreground">Belum ada QRIS. Klik + untuk menambah.</p>
            )}

            {qrisList.map((qris) => (
              <div key={qris.id} className="rounded-lg border p-4 space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Nama / Label</Label>
                    <Input
                      value={qris.name}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateQris(qris.id, "name", e.target.value)}
                      placeholder="IKPM Yogyakarta"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Kategori</Label>
                    <div className="flex flex-wrap gap-2">
                      {CATEGORY_OPTIONS.map((cat) => {
                        const active = qris.categories.includes(cat.value);
                        return (
                          <button
                            key={cat.value}
                            type="button"
                            onClick={() => {
                              const next = active
                                ? qris.categories.filter((c) => c !== cat.value)
                                : [...qris.categories, cat.value];
                              updateQris(qris.id, "categories", next);
                            }}
                            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                              active
                                ? "bg-primary text-primary-foreground"
                                : "border border-input bg-background text-muted-foreground hover:bg-accent"
                            }`}
                          >
                            {cat.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Mode: static vs dynamic */}
                <div className="space-y-1.5">
                  <Label>Mode</Label>
                  <div className="flex gap-1 rounded-lg border border-input bg-muted p-1 w-fit">
                    {(["static", "dynamic"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => updateQris(qris.id, "isDynamic", mode === "dynamic")}
                        className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                          (mode === "dynamic") === qris.isDynamic
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {mode === "static" ? "Static (gambar)" : "Dynamic (nominal terkunci)"}
                      </button>
                    ))}
                  </div>
                </div>

                {!qris.isDynamic ? (
                  <div className="space-y-1.5">
                    <Label>URL Gambar QRIS</Label>
                    <Input
                      value={qris.imageUrl}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateQris(qris.id, "imageUrl", e.target.value)}
                      placeholder="https://..."
                      type="url"
                    />
                    <p className="text-xs text-muted-foreground">Upload MinIO belum tersedia — isi URL gambar QRIS langsung.</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label>EMV Payload</Label>
                    <textarea
                      value={qris.emvPayload ?? ""}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateQris(qris.id, "emvPayload", e.target.value)}
                      placeholder="00020101021126..."
                      rows={3}
                      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                    />
                    <p className="text-xs text-muted-foreground">Paste string EMV dari QRIS statis — sistem akan otomatis generate QR dengan nominal terkunci per transaksi.</p>
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setQrisList((prev) => prev.filter((q) => q.id !== qris.id))}
                    className="flex items-center gap-1.5 text-xs text-destructive hover:text-destructive/80"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Hapus
                  </button>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={() => setQrisList((prev) => [...prev, newQris()])}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-4 w-4" /> Tambah QRIS
            </button>
          </div>

          <Button type="submit" disabled={savingQris} className="mt-2">
            {savingQris ? "Menyimpan..." : "Simpan QRIS"}
          </Button>
        </Section>
      </form>

      {/* ════ GATEWAY ════ */}
      <form onSubmit={handleSaveGateway}>
        <Section
          title="Payment Gateway"
          description="Konfigurasi API key untuk gateway pembayaran otomatis."
        >
          {/* Tab gateway */}
          <div className="flex gap-1 rounded-lg border border-input bg-muted p-1 w-fit">
            {GATEWAY_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setGatewayTab(tab)}
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors capitalize ${
                  gatewayTab === tab
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab === "ipaymu" ? "iPaymu" : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {/* Midtrans */}
          {gatewayTab === "midtrans" && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Server Key</Label>
                <MaskedInput
                  value={midtrans.serverKey}
                  onChange={(v) => setMidtrans((p) => ({ ...p, serverKey: v }))}
                  placeholder="SB-Mid-server-..."
                />
              </div>
              <div className="space-y-1.5">
                <Label>Client Key</Label>
                <MaskedInput
                  value={midtrans.clientKey}
                  onChange={(v) => setMidtrans((p) => ({ ...p, clientKey: v }))}
                  placeholder="SB-Mid-client-..."
                />
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm select-none">
                <input
                  type="checkbox"
                  checked={midtrans.isSandbox}
                  onChange={(e) => setMidtrans((p) => ({ ...p, isSandbox: e.target.checked }))}
                  className="rounded border-input"
                />
                Mode Sandbox (testing)
              </label>
            </div>
          )}

          {/* Xendit */}
          {gatewayTab === "xendit" && (
            <div className="space-y-1.5">
              <Label>API Key</Label>
              <MaskedInput
                value={xendit.apiKey}
                onChange={(v) => setXendit({ apiKey: v })}
                placeholder="xnd_production_..."
              />
            </div>
          )}

          {/* iPaymu */}
          {gatewayTab === "ipaymu" && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Virtual Account (VA)</Label>
                <Input
                  value={ipaymu.va}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIpaymu((p) => ({ ...p, va: e.target.value }))}
                  placeholder="0000000000000000"
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-1.5">
                <Label>API Key</Label>
                <MaskedInput
                  value={ipaymu.apiKey}
                  onChange={(v) => setIpaymu((p) => ({ ...p, apiKey: v }))}
                  placeholder="..."
                />
              </div>
            </div>
          )}

          <Button type="submit" disabled={savingGateway} className="mt-2">
            {savingGateway ? "Menyimpan..." : "Simpan Gateway"}
          </Button>
        </Section>
      </form>

    </div>
  );
}
