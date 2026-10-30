// Tab "Laporan & Produsen" — KHUSUS ADMIN (hasFullAccess toko): kartu produsen + laporan keuntungan (memuat MODAL = rahasia
// bisnis). Tidak pernah dirender di Portal Produsen. Doc: docs/arsitektur-produsen.md, docs/arsitektur-product.md.
import Link from "next/link";
import { ProducerCard } from "@/components/toko/producer-card";
import { ProductReportCard } from "@/components/toko/product-report-card";
import type { ProducerView } from "@/lib/producer.server";
import type { ProductReport } from "@/lib/product-report";

export function TabLaporan({ slug, producerView, report, conclusion, exportHref }: {
  slug: string; producerView: ProducerView | null; report: ProductReport; conclusion: string[]; exportHref: string;
}) {
  return (
    <div className="space-y-6">
      {producerView && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Produsen</h2>
            <Link href={`/app/${slug}/toko/produsen`} className="text-xs font-medium text-primary hover:underline">Kelola produsen →</Link>
          </div>
          <ProducerCard v={producerView} productCount={0} showCount={false} />
        </section>
      )}
      <ProductReportCard report={report} conclusion={conclusion} exportHref={exportHref} />
    </div>
  );
}
