"use client";

import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";

type DayPoint = { date: string; income: number; expense: number };

function formatShortRupiah(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}jt`;
  if (n >= 1_000)     return `${Math.round(n / 1_000)}rb`;
  return String(n);
}

function formatRupiah(n: number): string {
  return "Rp " + new Intl.NumberFormat("id-ID", { minimumFractionDigits: 0 }).format(n);
}

function formatTickDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

export function IncomeExpenseChart({ data }: { data: DayPoint[] }) {
  const hasData = data.some((d) => d.income > 0 || d.expense > 0);

  if (!hasData) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
        Belum ada transaksi 30 hari terakhir.
      </div>
    );
  }

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#16a34a" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#dc2626" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-border" />
          <XAxis
            dataKey="date"
            tickFormatter={formatTickDate}
            tick={{ fontSize: 11 }}
            interval={4}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={formatShortRupiah}
            tick={{ fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={44}
          />
          <Tooltip
            labelFormatter={(v) => formatTickDate(String(v))}
            formatter={(value, name) => [
              formatRupiah(Number(value)),
              name === "income" ? "Pemasukan" : "Pengeluaran",
            ]}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Area type="monotone" dataKey="income"  name="income"  stroke="#16a34a" fill="url(#incomeFill)"  strokeWidth={2} />
          <Area type="monotone" dataKey="expense" name="expense" stroke="#dc2626" fill="url(#expenseFill)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
