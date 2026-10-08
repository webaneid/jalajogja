// Kartu satu produsen — presentasional murni (tanpa hooks), dipakai halaman Produsen + detail produk admin.
// ADMIN-ONLY: memuat WhatsApp pribadi anggota, JANGAN dipakai di halaman/komponen publik.
import { Phone, MapPin, MessageCircle, Building2, Store } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { displayPhone, toWaDigits } from "@/lib/phone";
import { PHONE_SOURCE_LABEL, PHONE_SOURCE_LABEL_NONWA, ADDRESS_SOURCE_LABEL } from "@/lib/producer-resolve";
import type { ProducerView } from "@/lib/producer.server";

export function ProducerCard({ v, productCount, actions, showCount = true }: { v: ProducerView; productCount: number; actions?: React.ReactNode; showCount?: boolean }) {
  // Hanya digit untuk tautan wa.me — nilai kontak anggota berasal dari input bebas di alur lain.
  const waDigits = v.phone?.isWhatsapp ? toWaDigits(v.phone.value).replace(/\D/g, "") : "";
  return (
    <div className={`rounded-xl border border-border bg-card p-4 space-y-2 ${v.isActive ? "" : "opacity-60"}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {v.kind === "internal" ? <Store className="h-4 w-4 text-muted-foreground" /> : <Building2 className="h-4 w-4 text-muted-foreground" />}
            <h3 className="font-semibold truncate">{v.name}</h3>
            <Badge variant="secondary">{v.kind === "internal" ? "Internal" : v.kind === "member" ? `Anggota · ${v.sourceType}` : "Custom"}</Badge>
            {!v.isActive && <Badge variant="outline">Nonaktif</Badge>}
            {v.membership === "left" && <Badge variant="outline">Bukan anggota lagi</Badge>}
            {v.sourceMissing && <Badge variant="outline">Data sumber dihapus</Badge>}
          </div>
          {v.subtitle && <p className="text-xs text-muted-foreground mt-0.5">{v.subtitle}</p>}
        </div>
        {showCount && <p className="text-xs text-muted-foreground shrink-0">{productCount} produk</p>}
      </div>

      <div className="grid sm:grid-cols-2 gap-2 text-sm">
        <div className="flex items-start gap-2">
          {v.phone?.isWhatsapp ? <MessageCircle className="h-4 w-4 mt-0.5 text-green-600" /> : <Phone className="h-4 w-4 mt-0.5 text-muted-foreground" />}
          {v.phone ? (
            <div>
              {waDigits ? (
                <a href={`https://wa.me/${waDigits}`} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">{displayPhone(v.phone.value)}</a>
              ) : (
                <span className="font-medium">{displayPhone(v.phone.value)}</span>
              )}
              <p className="text-[11px] text-muted-foreground">{v.phone.isWhatsapp ? PHONE_SOURCE_LABEL[v.phone.source] : PHONE_SOURCE_LABEL_NONWA[v.phone.source]}</p>
            </div>
          ) : <span className="text-muted-foreground">Belum ada nomor</span>}
        </div>
        <div className="flex items-start gap-2">
          <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
          {v.address ? (
            <div>
              <p>{v.address.text}</p>
              <p className="text-[11px] text-muted-foreground">{ADDRESS_SOURCE_LABEL[v.address.source]}</p>
            </div>
          ) : <span className="text-muted-foreground">Belum ada alamat</span>}
        </div>
      </div>
      {actions}
    </div>
  );
}

