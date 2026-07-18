import { getTenantAccess } from "@/lib/tenant";
import { redirect, notFound } from "next/navigation";
import { getInstallmentPlanDetailAction, getEventTicketOptionsAction } from "../../../actions";
import { InstallmentPlanForm } from "@/components/keuangan/billing/installment-plan-form";

export default async function CicilanEditPage({
  params,
}: {
  params: Promise<{ tenant: string; id: string }>;
}) {
  const { tenant: slug, id } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/app/login");

  const [planResult, ticketResult] = await Promise.all([
    getInstallmentPlanDetailAction(slug, id),
    getEventTicketOptionsAction(slug),
  ]);
  if (!planResult.success) notFound();

  const plan = planResult.data;
  const ticketOptions = ticketResult.success ? ticketResult.data : [];

  // Tiket yang sedang dipakai plan ini mungkin sudah tidak aktif/tidak masuk daftar tiket
  // aktif lagi — tetap sertakan di opsi supaya combobox tidak kosong saat edit.
  const options = plan.ticketId && !ticketOptions.some((t) => t.ticketId === plan.ticketId)
    ? [...ticketOptions, {
        eventId:  "",
        eventTitle: plan.eventTitle ?? "",
        ticketId: plan.ticketId,
        ticketName: plan.ticketName ?? "",
        price: plan.totalAmount ?? 0,
      }]
    : ticketOptions;

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Edit Program Cicilan</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{plan.name}</p>
      </div>

      <InstallmentPlanForm
        slug={slug}
        ticketOptions={options}
        planId={plan.id}
        initialValues={{
          name:             plan.name,
          description:      plan.description ?? "",
          ticketId:         plan.ticketId ?? "",
          totalAmount:      plan.totalAmount ?? 0,
          installmentCount: plan.installmentCount,
          intervalDays:     plan.intervalDays,
        }}
      />
    </div>
  );
}
