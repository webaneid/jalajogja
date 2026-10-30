// Tab "Ringkasan" — kartu angka. Admin: total pembelian + status bayar; produsen: pesanan lunas, unit terjual, stok.
// Angka dihitung DI SINI dari baris pembeli yang diteruskan pemanggil (untuk produsen: hanya pesanan lunas, tanpa uang).
export type RingkasanCounts = { total: number; lunas: number; sebagian: number; belum: number; unitLunas: number; stock: number };

export function TabRingkasan({ view, counts }: { view: "admin" | "producer"; counts: RingkasanCounts }) {
  const cards = view === "admin"
    ? [
        { label: "Total Pembelian", value: counts.total,    color: "text-foreground" },
        { label: "Lunas",           value: counts.lunas,    color: "text-green-600" },
        { label: "Sebagian",        value: counts.sebagian, color: "text-amber-600" },
        { label: "Belum Bayar",     value: counts.belum,    color: "text-red-600" },
      ]
    : [
        { label: "Pesanan Lunas",   value: counts.lunas,     color: "text-green-600" },
        { label: "Unit Terjual",    value: counts.unitLunas, color: "text-foreground" },
        { label: "Stok Saat Ini",   value: counts.stock,     color: "text-foreground" },
      ];
  return (
    <div className="space-y-3">
      <div className={`grid grid-cols-2 gap-4 ${cards.length === 4 ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
        {cards.map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4 space-y-1">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>
      {view === "producer" && (
        <p className="text-xs text-muted-foreground">Hanya pesanan yang sudah dibayar (Lunas) yang ditampilkan. Buka tab &ldquo;Pesanan Masuk&rdquo; untuk data pengiriman.</p>
      )}
    </div>
  );
}
