// Tab "Ringkasan" — kartu angka, SAMA untuk admin dan produsen (keputusan user 2026-10-31).
export type RingkasanCounts = { total: number; lunas: number; sebagian: number; belum: number; unitLunas: number; stock: number };

export function TabRingkasan({ counts }: { counts: RingkasanCounts }) {
  const cards = [
    { label: "Total Pembelian", value: counts.total,    color: "text-foreground" },
    { label: "Lunas",           value: counts.lunas,    color: "text-green-600" },
    { label: "Sebagian",        value: counts.sebagian, color: "text-amber-600" },
    { label: "Belum Bayar",     value: counts.belum,    color: "text-red-600" },
  ];
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {cards.map(({ label, value, color }) => (
        <div key={label} className="rounded-xl border border-border bg-card p-4 space-y-1">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={`text-2xl font-bold ${color}`}>{value}</p>
        </div>
      ))}
    </div>
  );
}
