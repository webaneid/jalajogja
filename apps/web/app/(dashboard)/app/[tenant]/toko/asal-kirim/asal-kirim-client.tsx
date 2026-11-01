"use client";

import { OriginManager } from "@/components/address/origin-manager";
import type { OriginDTO } from "@/lib/shipping-origins";
import { adminSaveOriginAction, adminDeleteOriginAction, adminSetDefaultOriginAction } from "./actions";

export function AsalKirimClient({ slug, sections }: {
  slug: string;
  sections: { key: string; title: string; producerId: string | null; origins: OriginDTO[] }[];
}) {
  return (
    <div className="space-y-8">
      {sections.map((s) => (
        <section key={s.key} className="space-y-3">
          <h2 className="text-sm font-semibold">{s.title}</h2>
          <OriginManager
            initial={s.origins}
            emptyHint={s.producerId ? "Belum ada asal kirim — produk produsen ini memakai asal utama toko." : "Belum ada asal kirim toko. Tambahkan agar ongkir bisa dihitung."}
            actions={{
              save: (input) => adminSaveOriginAction(slug, s.producerId, input),
              remove: (id) => adminDeleteOriginAction(slug, s.producerId, id),
              makeDefault: (id) => adminSetDefaultOriginAction(slug, s.producerId, id),
            }}
          />
        </section>
      ))}
    </div>
  );
}
