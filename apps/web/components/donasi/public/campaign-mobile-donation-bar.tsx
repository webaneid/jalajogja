"use client";

import { Heart } from "lucide-react";
import { MobileActionSheet } from "@/components/website/public/single/mobile-action-sheet";

type Props = {
  campaignType: string;
  children:     React.ReactNode; // konten penuh — sama persis dengan form donasi/qurban di desktop
};

// Bottom sheet donasi untuk shell mobile halaman single campaign — thin wrapper di atas
// MobileActionSheet (mekanisme sheet generik, sama dipakai Event/Produk). Tidak ada state
// "sudah selesai" seperti tiket event (donasi bisa dilakukan berkali-kali) — collapsedBar
// selalu berupa CTA statis, bukan ringkasan nominal live (nominal baru diketahui setelah
// user memilih di dalam form, yang statenya ada di CampaignDetailClient — tidak diangkat ke
// sini supaya tidak perlu refactor state management komponen itu).
export function CampaignMobileDonationBar({ campaignType, children }: Props) {
  const isQurban = campaignType === "qurban";

  // Badge CTA solid saat collapsed (menarik perhatian untuk di-tap) — begitu expanded (detail
  // transaksi terbuka), badge diredupkan jadi outline netral supaya tombol "Lanjutkan" di dalam
  // form yang jadi fokus, bukan badge ini (yang tetap tampil sebagai header baris sheet).
  const collapsedBar = (expanded: boolean) => (
    <>
      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        <Heart size={18} className="text-primary" />
      </div>
      <div className="flex-1 min-w-0 text-left">
        <p className="text-xs text-muted-foreground">{isQurban ? "Qurban" : "Donasi"}</p>
        <p className="text-sm font-semibold">{isQurban ? "Pesan Qurban" : "Donasi Sekarang"}</p>
      </div>
      <span className={`btn btn-sm shrink-0 pointer-events-none ${expanded ? "btn-outline-dark" : "btn-primary"}`}>
        {isQurban ? "Pesan" : "Donasi"}
      </span>
    </>
  );

  return <MobileActionSheet collapsedBar={collapsedBar}>{children}</MobileActionSheet>;
}
