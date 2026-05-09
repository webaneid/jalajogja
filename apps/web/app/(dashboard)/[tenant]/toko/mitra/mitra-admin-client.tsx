"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, PauseCircle, PlayCircle, Clock } from "lucide-react";
import {
  approveMitraAction,
  rejectMitraAction,
  suspendMitraAction,
  reactivateMitraAction,
} from "./actions";

type Application = {
  id: string;
  memberName: string;
  memberNumber: string | null;
  businessName: string;
  businessSector: string;
  motivation: string | null;
  status: string;
  rejectionReason: string | null;
  appliedAt: string;
};

type Mitra = {
  id: string;
  memberName: string;
  businessName: string;
  businessBrand: string | null;
  status: string;
  suspensionReason: string | null;
  approvedAt: string;
};

type Props = {
  slug:         string;
  applications: Application[];
  mitras:       Mitra[];
  pendingCount: number;
};

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  pending:   { label: "Menunggu",    variant: "secondary"   },
  approved:  { label: "Disetujui",   variant: "default"     },
  rejected:  { label: "Ditolak",     variant: "destructive" },
  cancelled: { label: "Dibatalkan",  variant: "outline"     },
  active:    { label: "Aktif",       variant: "default"     },
  suspended: { label: "Disuspend",   variant: "destructive" },
};

const fmt = (d: string) =>
  new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(new Date(d));

export function MitraAdminClient({ slug, applications, mitras, pendingCount }: Props) {
  const [tab, setTab]         = useState<"applications" | "active">("applications");
  const [pending, setPending] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [suspendId, setSuspendId] = useState<string | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [localApps, setLocalApps]   = useState(applications);
  const [localMitras, setLocalMitras] = useState(mitras);

  async function handleApprove(id: string) {
    setPending(id);
    const res = await approveMitraAction(slug, id);
    setPending(null);
    if (!res.error) {
      setLocalApps(prev => prev.map(a => a.id === id ? { ...a, status: "approved" } : a));
    } else {
      alert(res.error);
    }
  }

  async function handleReject() {
    if (!rejectId) return;
    setPending(rejectId);
    const res = await rejectMitraAction(slug, rejectId, rejectReason);
    setPending(null);
    if (!res.error) {
      setLocalApps(prev => prev.map(a => a.id === rejectId ? { ...a, status: "rejected", rejectionReason: rejectReason } : a));
      setRejectId(null);
      setRejectReason("");
    } else {
      alert(res.error);
    }
  }

  async function handleSuspend() {
    if (!suspendId) return;
    setPending(suspendId);
    const res = await suspendMitraAction(slug, suspendId, suspendReason);
    setPending(null);
    if (!res.error) {
      setLocalMitras(prev => prev.map(m => m.id === suspendId ? { ...m, status: "suspended", suspensionReason: suspendReason } : m));
      setSuspendId(null);
      setSuspendReason("");
    } else {
      alert(res.error);
    }
  }

  async function handleReactivate(id: string) {
    setPending(id);
    const res = await reactivateMitraAction(slug, id);
    setPending(null);
    if (!res.error) {
      setLocalMitras(prev => prev.map(m => m.id === id ? { ...m, status: "active", suspensionReason: null } : m));
    } else {
      alert(res.error);
    }
  }

  return (
    <div className="space-y-4">
      {/* Tab header */}
      <div className="flex gap-2 border-b border-border">
        {[
          { key: "applications", label: `Pengajuan${pendingCount > 0 ? ` (${pendingCount})` : ""}` },
          { key: "active",       label: `Mitra Aktif (${localMitras.length})` },
        ].map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key as "applications" | "active")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab: Pengajuan */}
      {tab === "applications" && (
        <div className="space-y-2">
          {localApps.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center">Belum ada pengajuan.</p>
          )}
          {localApps.map(app => (
            <div key={app.id} className="rounded-lg border border-border bg-card p-4 space-y-2">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-sm">{app.memberName}</p>
                  <p className="text-xs text-muted-foreground">
                    {app.memberNumber ? `ID: ${app.memberNumber} · ` : ""}
                    Usaha: <span className="font-medium">{app.businessName}</span> · {app.businessSector}
                  </p>
                  {app.motivation && (
                    <p className="text-xs text-muted-foreground mt-1 italic">"{app.motivation}"</p>
                  )}
                  {app.rejectionReason && (
                    <p className="text-xs text-destructive mt-1">Alasan tolak: {app.rejectionReason}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">Diajukan {fmt(app.appliedAt)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={STATUS_BADGE[app.status]?.variant ?? "outline"}>
                    {STATUS_BADGE[app.status]?.label ?? app.status}
                  </Badge>
                  {app.status === "pending" && (
                    <>
                      <Button
                        size="sm"
                        variant="default"
                        disabled={pending === app.id}
                        onClick={() => handleApprove(app.id)}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                        Setujui
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending === app.id}
                        onClick={() => { setRejectId(app.id); setRejectReason(""); }}
                      >
                        <XCircle className="h-3.5 w-3.5 mr-1" />
                        Tolak
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Mitra Aktif */}
      {tab === "active" && (
        <div className="space-y-2">
          {localMitras.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center">Belum ada mitra aktif.</p>
          )}
          {localMitras.map(m => (
            <div key={m.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-sm">{m.memberName}</p>
                  <p className="text-xs text-muted-foreground">
                    Usaha: <span className="font-medium">{m.businessBrand ?? m.businessName}</span>
                    {m.businessBrand && m.businessBrand !== m.businessName && ` (${m.businessName})`}
                  </p>
                  {m.suspensionReason && (
                    <p className="text-xs text-destructive mt-1">Alasan suspend: {m.suspensionReason}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">Bergabung {fmt(m.approvedAt)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={STATUS_BADGE[m.status]?.variant ?? "outline"}>
                    {STATUS_BADGE[m.status]?.label ?? m.status}
                  </Badge>
                  {m.status === "active" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending === m.id}
                      onClick={() => { setSuspendId(m.id); setSuspendReason(""); }}
                    >
                      <PauseCircle className="h-3.5 w-3.5 mr-1" />
                      Suspend
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="default"
                      disabled={pending === m.id}
                      onClick={() => handleReactivate(m.id)}
                    >
                      <PlayCircle className="h-3.5 w-3.5 mr-1" />
                      Aktifkan
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Tolak */}
      {rejectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-xl border border-border p-6 w-full max-w-sm space-y-4">
            <h3 className="font-semibold">Tolak Pengajuan</h3>
            <div className="space-y-1.5">
              <label className="text-sm">Alasan penolakan (opsional)</label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="Alasan penolakan untuk dikirim ke pemohon..."
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setRejectId(null)}>Batal</Button>
              <Button variant="destructive" disabled={!!pending} onClick={handleReject}>Tolak Pengajuan</Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Suspend */}
      {suspendId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-xl border border-border p-6 w-full max-w-sm space-y-4">
            <h3 className="font-semibold">Suspend Mitra</h3>
            <div className="space-y-1.5">
              <label className="text-sm">Alasan suspend (opsional)</label>
              <textarea
                rows={3}
                value={suspendReason}
                onChange={e => setSuspendReason(e.target.value)}
                placeholder="Alasan suspend..."
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setSuspendId(null)}>Batal</Button>
              <Button variant="destructive" disabled={!!pending} onClick={handleSuspend}>Suspend Mitra</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
