import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { getEventTicketOptionsAction } from "../../actions";
import { InstallmentPlanForm } from "@/components/keuangan/billing/installment-plan-form";

export default async function CicilanNewPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/app/login");

  const result = await getEventTicketOptionsAction(slug);
  const ticketOptions = result.success ? result.data : [];

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Buat Program Cicilan</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Program tetap tersembunyi sampai Anda aktifkan &amp; publish di halaman detail.
        </p>
      </div>

      <InstallmentPlanForm slug={slug} ticketOptions={ticketOptions} />
    </div>
  );
}
