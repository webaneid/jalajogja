"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Clock, XCircle, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { saveDomainSettingsAction } from "@/app/(dashboard)/[tenant]/settings/actions";

type DomainStatus = "none" | "pending" | "active" | "failed";

type DefaultValues = {
  subdomain:          string;
  customDomain:       string;
  customDomainStatus: DomainStatus;
  verifiedAt:         string | null;
};

const STATUS_CONFIG: Record<DomainStatus, { icon: React.ElementType; label: string; className: string }> = {
  none:    { icon: Info,         label: "Belum dikonfigurasi", className: "text-muted-foreground"              },
  pending: { icon: Clock,        label: "Menunggu verifikasi", className: "text-amber-600"                     },
  active:  { icon: CheckCircle2, label: "Aktif & terverifikasi", className: "text-green-600"                   },
  failed:  { icon: XCircle,      label: "Verifikasi gagal",    className: "text-destructive"                   },
};

export function DomainSettingsForm({
  slug,
  defaultValues,
}: {
  slug: string;
  defaultValues: DefaultValues;
}) {
  const router = useRouter();
  const [pending,      setPending]      = React.useState(false);
  const [subdomain,    setSubdomain]    = React.useState(defaultValues.subdomain);
  const [customDomain, setCustomDomain] = React.useState(defaultValues.customDomain);
  const [status,       setStatus]       = React.useState<DomainStatus>(defaultValues.customDomainStatus);

  const StatusIcon = STATUS_CONFIG[status].icon;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const result = await saveDomainSettingsAction(slug, { subdomain, customDomain });
      if (result.error) {
        toast.error(result.error);
      } else {
        // Update status lokal sesuai hasil action
        if (customDomain) setStatus("pending");
        else setStatus("none");
        toast.success("Pengaturan domain disimpan.");
        router.refresh();
      }
    } finally { setPending(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">

      {/* ── URL Default ── */}
      <fieldset className="space-y-3">
        <legend className="w-full border-b pb-1.5 text-sm font-semibold text-foreground">
          URL Default
        </legend>
        <div className="flex items-center gap-2 rounded-lg border bg-muted px-4 py-3">
          <span className="text-sm font-mono text-muted-foreground">
            app.jalajogja.com/<span className="font-semibold text-foreground">{slug}</span>
          </span>
          <span className="ml-auto rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">
            Aktif
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          URL ini selalu aktif dan tidak bisa dihapus.
        </p>
      </fieldset>

      {/* ── Subdomain jalajogja ── */}
      <fieldset className="space-y-3">
        <legend className="w-full border-b pb-1.5 text-sm font-semibold text-foreground">
          Subdomain jalajogja
        </legend>
        <div className="space-y-2">
          <Label htmlFor="subdomain">Subdomain</Label>
          <div className="flex items-center gap-2">
            <Input
              id="subdomain"
              value={subdomain}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
              }
              placeholder={slug}
              disabled={pending}
              className="max-w-[200px] font-mono"
            />
            <span className="text-sm text-muted-foreground">.jalajogja.com</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Kosongkan untuk pakai slug default ({slug}.jalajogja.com).
            Fitur ini aktif saat modul Front-end tersedia.
          </p>
        </div>
      </fieldset>

      {/* ── Custom Domain ── */}
      <fieldset className="space-y-4">
        <legend className="w-full border-b pb-1.5 text-sm font-semibold text-foreground">
          Custom Domain
        </legend>

        <div className="space-y-2">
          <Label htmlFor="customDomain">Domain</Label>
          <Input
            id="customDomain"
            value={customDomain}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomDomain(e.target.value.toLowerCase())}
            placeholder="ikpm.or.id"
            disabled={pending}
            className="max-w-xs font-mono"
          />
        </div>

        {/* Status badge */}
        {status !== "none" && (
          <div className={`flex items-center gap-2 text-sm ${STATUS_CONFIG[status].className}`}>
            <StatusIcon className="h-4 w-4 shrink-0" />
            <span>{STATUS_CONFIG[status].label}</span>
            {status === "active" && defaultValues.verifiedAt && (
              <span className="text-xs text-muted-foreground">
                — sejak {new Date(defaultValues.verifiedAt).toLocaleDateString("id-ID")}
              </span>
            )}
          </div>
        )}

        {/* Instruksi DNS — tampil saat pending atau failed */}
        {(status === "pending" || status === "failed") && customDomain && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
            <p className="text-sm font-medium text-amber-800">
              Tambahkan A record berikut di DNS provider kamu (Cloudflare, Niagahoster, dll.):
            </p>
            <div className="rounded-md bg-white border font-mono text-xs p-3 space-y-1">
              <div className="grid grid-cols-[80px_60px_1fr] gap-2 text-muted-foreground">
                <span>Name</span><span>Type</span><span>Value</span>
              </div>
              <div className="grid grid-cols-[80px_60px_1fr] gap-2 text-foreground font-semibold">
                <span>@</span><span>A</span><span>{"<IP_VPS_JALAJOGJA>"}</span>
              </div>
            </div>
            <p className="text-xs text-amber-700">
              Propagasi DNS biasanya membutuhkan 5 menit – 24 jam.
              Verifikasi otomatis berjalan di background setelah kamu simpan.
            </p>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Custom domain aktif setelah DNS terverifikasi dan SSL ter-provisioned otomatis via Caddy.
          Fitur ini tersedia saat modul Front-end tersedia.
        </p>
      </fieldset>

      <Button type="submit" disabled={pending}>
        {pending ? "Menyimpan..." : "Simpan"}
      </Button>
    </form>
  );
}
