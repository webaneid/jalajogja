"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { formatRp } from "@/lib/campaign-card-templates";

export type DonorEntry = {
  donorName:   string;
  isAnonymous: boolean;
  amount:      string | null;
  createdAt:   string;
};

type Props = {
  descriptionHtml: string | null;
  donorList:       DonorEntry[];
  showDonorList:   boolean;
};

export function CampaignDetailTabs({ descriptionHtml, donorList, showDonorList }: Props) {
  const [tab, setTab] = useState<"detail" | "donatur">("detail");

  return (
    <div>
      {/* Tab nav — hanya tampil jika showDonorList aktif */}
      {showDonorList && (
        <div className="flex gap-0 border-b border-border mb-5">
          {(["detail", "donatur"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "detail" ? "Detail" : `Donatur (${donorList.length})`}
            </button>
          ))}
        </div>
      )}

      {/* Tab: Detail — deskripsi campaign */}
      {tab === "detail" && (
        descriptionHtml ? (
          <div
            className="prose prose-sm max-w-none [&_p]:my-3 [&_ul]:my-3 [&_ol]:my-3"
            dangerouslySetInnerHTML={{ __html: descriptionHtml }}
          />
        ) : (
          <p className="text-sm text-muted-foreground italic">Tidak ada deskripsi.</p>
        )
      )}

      {/* Tab: Donatur — list lengkap dengan nominal */}
      {tab === "donatur" && showDonorList && (
        donorList.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">
            Belum ada donatur. Jadilah yang pertama!
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {donorList.map((d, i) => (
              <li key={i} className="flex items-center justify-between py-3 gap-3">
                <span className="flex items-center gap-2 min-w-0">
                  <Heart className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="text-sm font-medium truncate">{d.donorName}</span>
                </span>
                {d.amount && (
                  <span className="text-sm text-muted-foreground tabular-nums shrink-0">
                    {formatRp(d.amount)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}
