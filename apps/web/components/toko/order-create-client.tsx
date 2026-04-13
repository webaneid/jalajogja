"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Search } from "lucide-react";
import { createOrderAction, type OrderData, type OrderItemInput } from "@/app/(dashboard)/[tenant]/toko/actions";

type ProductOption = {
  id:    string;
  name:  string;
  sku:   string | null;
  price: number;
  stock: number;
};

type CartItem = {
  product: ProductOption;
  qty:     number;
};

type Props = {
  slug:     string;
  products: ProductOption[];
};

export function OrderCreateClient({ slug, products }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  // Customer
  const [customerName,    setCustomerName]    = useState("");
  const [customerEmail,   setCustomerEmail]   = useState("");
  const [customerPhone,   setCustomerPhone]   = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [discount,        setDiscount]        = useState("0");
  const [notes,           setNotes]           = useState("");

  // Cart
  const [cart,       setCart]       = useState<CartItem[]>([]);
  const [searchQ,    setSearchQ]    = useState("");
  const [showSearch, setShowSearch] = useState(false);

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQ.toLowerCase()) ||
      (p.sku ?? "").toLowerCase().includes(searchQ.toLowerCase())
  );

  function addToCart(product: ProductOption) {
    setCart((prev) => {
      const existing = prev.find((c) => c.product.id === product.id);
      if (existing) {
        return prev.map((c) =>
          c.product.id === product.id
            ? { ...c, qty: Math.min(c.qty + 1, product.stock) }
            : c
        );
      }
      return [...prev, { product, qty: 1 }];
    });
    setShowSearch(false);
    setSearchQ("");
  }

  function updateQty(productId: string, qty: number) {
    if (qty <= 0) {
      setCart((prev) => prev.filter((c) => c.product.id !== productId));
    } else {
      setCart((prev) =>
        prev.map((c) =>
          c.product.id === productId
            ? { ...c, qty: Math.min(qty, c.product.stock) }
            : c
        )
      );
    }
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((c) => c.product.id !== productId));
  }

  // Kalkulasi
  const subtotal      = cart.reduce((s, c) => s + c.product.price * c.qty, 0);
  const discountNum   = parseFloat(discount) || 0;
  const total         = Math.max(0, subtotal - discountNum);

  function formatRupiah(n: number) {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!customerName.trim()) {
      setError("Nama pelanggan wajib diisi.");
      return;
    }
    if (cart.length === 0) {
      setError("Tambahkan minimal 1 produk.");
      return;
    }

    const data: OrderData = {
      customerName:    customerName.trim(),
      customerEmail:   customerEmail.trim()  || null,
      customerPhone:   customerPhone.trim()  || null,
      shippingAddress: shippingAddress.trim()|| null,
      discount:        discountNum,
      notes:           notes.trim()          || null,
      items:           cart.map((c) => ({
        productId: c.product.id,
        qty:       c.qty,
      })),
    };

    startTransition(async () => {
      const res = await createOrderAction(slug, data);
      if (res.success) {
        router.push(`/${slug}/toko/pesanan/${res.data.orderId}`);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Kolom kiri — Info pelanggan */}
      <div className="space-y-4">
        <h2 className="font-medium text-sm">Informasi Pelanggan</h2>

        <div>
          <label className="block text-xs text-muted-foreground mb-1">
            Nama Pelanggan <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Ahmad Budi"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Email</label>
            <input
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="ahmad@email.com"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Telepon</label>
            <input
              type="text"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="0812-xxxx-xxxx"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-muted-foreground mb-1">Alamat Pengiriman</label>
          <textarea
            value={shippingAddress}
            onChange={(e) => setShippingAddress(e.target.value)}
            rows={3}
            placeholder="Jl. Contoh No. 1, RT/RW, Kelurahan, Kecamatan, Kota"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
          />
        </div>

        <div>
          <label className="block text-xs text-muted-foreground mb-1">Catatan</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Catatan tambahan (opsional)"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
          />
        </div>
      </div>

      {/* Kolom kanan — Produk & Ringkasan */}
      <div className="space-y-4">
        <h2 className="font-medium text-sm">Produk</h2>

        {/* Search produk */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowSearch(!showSearch)}
            className="w-full flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
          >
            <Plus className="h-4 w-4" />
            Tambah Produk
          </button>

          {showSearch && (
            <div className="absolute top-full mt-1 left-0 right-0 z-10 rounded-lg border border-border bg-background shadow-lg">
              <div className="p-2 border-b border-border flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                <input
                  autoFocus
                  type="text"
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  placeholder="Cari produk..."
                  className="flex-1 text-sm bg-transparent focus:outline-none"
                />
              </div>
              <ul className="max-h-52 overflow-y-auto divide-y divide-border">
                {filteredProducts.length === 0 ? (
                  <li className="px-4 py-3 text-sm text-muted-foreground">Tidak ditemukan</li>
                ) : (
                  filteredProducts.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => addToCart(p)}
                        disabled={p.stock === 0}
                        className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-muted/40 transition-colors disabled:opacity-50 text-left"
                      >
                        <div>
                          <p className="font-medium">{p.name}</p>
                          {p.sku && <p className="text-xs text-muted-foreground font-mono">{p.sku}</p>}
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          <p className="text-green-600 font-medium">
                            {new Intl.NumberFormat("id-ID").format(p.price)}
                          </p>
                          <p className="text-xs text-muted-foreground">Stok: {p.stock}</p>
                        </div>
                      </button>
                    </li>
                  ))
                )}
              </ul>
              <div className="p-2 border-t border-border">
                <button type="button" onClick={() => setShowSearch(false)} className="text-xs text-muted-foreground hover:text-foreground">
                  Tutup
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Cart items */}
        {cart.length > 0 ? (
          <div className="rounded-lg border border-border divide-y divide-border">
            {cart.map((item) => (
              <div key={item.product.id} className="flex items-center gap-3 px-3 py-2.5">
                {/* Info produk */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.product.name}</p>
                  <p className="text-xs text-green-600">
                    {formatRupiah(item.product.price)} × {item.qty} = {formatRupiah(item.product.price * item.qty)}
                  </p>
                </div>

                {/* Qty control */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => updateQty(item.product.id, item.qty - 1)}
                    className="w-7 h-7 rounded border border-border flex items-center justify-center text-sm hover:bg-muted/40"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min="1"
                    max={item.product.stock}
                    value={item.qty}
                    onChange={(e) => updateQty(item.product.id, parseInt(e.target.value) || 1)}
                    className="w-12 h-7 rounded border border-border text-center text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <button
                    type="button"
                    onClick={() => updateQty(item.product.id, item.qty + 1)}
                    disabled={item.qty >= item.product.stock}
                    className="w-7 h-7 rounded border border-border flex items-center justify-center text-sm hover:bg-muted/40 disabled:opacity-40"
                  >
                    +
                  </button>
                </div>

                {/* Hapus */}
                <button
                  type="button"
                  onClick={() => removeFromCart(item.product.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors ml-1"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
            Belum ada produk — klik &quot;Tambah Produk&quot; di atas
          </div>
        )}

        {/* Ringkasan harga */}
        {cart.length > 0 && (
          <div className="rounded-lg border border-border bg-muted/10 p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatRupiah(subtotal)}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Diskon (Rp)</span>
              <input
                type="number"
                min="0"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                className="w-32 rounded border border-input bg-background px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <div className="flex justify-between font-semibold border-t border-border pt-2">
              <span>Total</span>
              <span className="text-lg">{formatRupiah(total)}</span>
            </div>
          </div>
        )}

        {/* Error + Submit */}
        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={pending || cart.length === 0}
            className="flex-1 rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {pending ? "Membuat Pesanan..." : "Buat Pesanan"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted/40"
          >
            Batal
          </button>
        </div>
      </div>
    </form>
  );
}
