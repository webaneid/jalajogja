// Total + "Lanjut ke Checkout" — sticky di bawah layar, MOBILE SAJA. Komponen berdiri sendiri
// (bukan bagian dari CartClient) supaya halaman keranjang bisa merender ini sebagai elemen
// PALING TERAKHIR — spacer + bar sticky WAJIB berada setelah SEMUA konten halaman (termasuk
// banner donasi/produk terkait yang muncul setelah CartClient), bukan cuma setelah CartClient
// saja, kalau tidak spacer-nya nyangkut di tengah halaman alih-alih di paling bawah.
// Non-interaktif (murni display + link) — tidak perlu "use client".

type Props = {
  slug:     string;
  subtotal: number;
};

function formatRp(n: number) {
  return "Rp " + new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n);
}

export function CartMobileBar({ slug, subtotal }: Props) {
  return (
    <>
      {/* Spacer — cegah konten terakhir di halaman ketutupan bar sticky di bawahnya */}
      <div className="h-20 md:hidden" />
      <div className="md:hidden fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-4 border-t border-border bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        <div>
          <span className="block text-xs text-muted-foreground">Total</span>
          <span className="block tabular-nums font-semibold text-lg">{formatRp(subtotal)}</span>
        </div>
        <a
          href={`/${slug}/checkout`}
          className="shrink-0 rounded-md bg-primary px-6 py-3 text-center text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Lanjut ke Checkout
        </a>
      </div>
    </>
  );
}
