import { redirect } from "next/navigation";
import { getTenantAccess } from "@/lib/tenant";
import { createTenantDb, getSettings } from "@jalajogja/db";
import { PaymentSettingsForm } from "@/components/settings/payment-settings-form";

export default async function PaymentSettingsPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;

  const access = await getTenantAccess(slug);
  if (!access) redirect("/dashboard-redirect");

  const tenantDb = createTenantDb(slug);
  const settings = await getSettings(tenantDb, "payment");

  type BankAccount = {
    id: string; bankName: string; accountNumber: string;
    accountName: string; categories: string[];
  };
  type QrisAccount = {
    id: string; name: string; imageUrl: string;
    categories: string[]; isDynamic: boolean; emvPayload?: string;
  };
  type GatewayMidtrans = { serverKey: string; clientKey: string; isSandbox: boolean };
  type GatewayXendit   = { apiKey: string };
  type GatewayIpaymu   = { va: string; apiKey: string };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Pembayaran</h2>
        <p className="text-sm text-muted-foreground">
          Rekening bank, QRIS, dan konfigurasi payment gateway.
        </p>
      </div>

      <PaymentSettingsForm
        slug={slug}
        defaultValues={{
          bankAccounts: (settings.bank_accounts as BankAccount[]) ?? [],
          qrisAccounts: (settings.qris_accounts as QrisAccount[]) ?? [],
          midtrans:     (settings.midtrans as GatewayMidtrans) ?? null,
          xendit:       (settings.xendit   as GatewayXendit)   ?? null,
          ipaymu:       (settings.ipaymu   as GatewayIpaymu)   ?? null,
        }}
      />
    </div>
  );
}
