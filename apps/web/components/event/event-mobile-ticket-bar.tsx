import { Ticket } from "lucide-react";
import { MobileActionSheet } from "@/components/website/public/single/mobile-action-sheet";

type Props = {
  registered:   boolean;
  qrSrc?:       string | null;
  statusLabel?: string;
  regNumber?:   string;
  priceLabel?:  string | null;   // dipakai hanya kalau !registered
  children:     React.ReactNode; // konten penuh — sama persis dengan kartu QR / EventRegisterForm di desktop
};

// Bottom sheet tiket untuk shell mobile halaman single event — thin wrapper di atas
// MobileActionSheet (mekanisme sheet generik), cuma bangun collapsedBar yang beda per state
// (sudah terdaftar: QR mini + status; belum: label harga + CTA "Daftar").
export function EventMobileTicketBar({ registered, qrSrc, statusLabel, regNumber, priceLabel, children }: Props) {
  // Badge "Daftar" solid saat collapsed, jadi outline netral begitu expanded (detail form
  // pendaftaran terbuka) — supaya tombol submit sungguhan di dalam form yang jadi fokus.
  // Kalau sudah terdaftar, tidak ada badge sama sekali (QR + status saja) — tidak relevan.
  const collapsedBar = (expanded: boolean) => registered ? (
    <>
      {qrSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qrSrc} alt="QR Tiket" className="w-12 h-12 rounded-md border border-border shrink-0 bg-white" />
      ) : (
        <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center shrink-0">
          <Ticket size={20} className="text-muted-foreground" />
        </div>
      )}
      <div className="flex-1 min-w-0 text-left">
        <p className="text-xs text-muted-foreground">{statusLabel}</p>
        <p className="text-sm font-semibold font-mono truncate">{regNumber}</p>
      </div>
    </>
  ) : (
    <>
      <div className="flex-1 min-w-0 text-left">
        <p className="text-xs text-muted-foreground">Tiket</p>
        <p className="text-sm font-semibold">{priceLabel ?? "Daftar Sekarang"}</p>
      </div>
      <span className={`btn btn-sm shrink-0 pointer-events-none ${expanded ? "btn-outline-dark" : "btn-primary"}`}>
        Daftar
      </span>
    </>
  );

  return <MobileActionSheet collapsedBar={collapsedBar}>{children}</MobileActionSheet>;
}
