import { createTenantDb } from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { AccountTree, type AccountNode } from "@/components/keuangan/account-tree";
import { AccountMappingsForm } from "@/components/keuangan/account-mappings-form";

// Bangun tree dari flat list
function buildTree(accounts: Omit<AccountNode, "children">[]): AccountNode[] {
  const map = new Map<string, AccountNode>();
  for (const acc of accounts) {
    map.set(acc.id, { ...acc, children: [] });
  }

  const roots: AccountNode[] = [];
  for (const acc of accounts) {
    const node = map.get(acc.id)!;
    if (!acc.parentId) {
      roots.push(node);
    } else {
      const parent = map.get(acc.parentId);
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node); // orphan → perlakukan sebagai root
      }
    }
  }

  // Urutkan setiap level by code
  function sortChildren(nodes: AccountNode[]) {
    nodes.sort((a, b) => a.code.localeCompare(b.code));
    for (const n of nodes) sortChildren(n.children);
  }
  sortChildren(roots);

  return roots;
}

export default async function AkunPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/login");

  const { db, schema } = createTenantDb(slug);

  const flat = await db
    .select({
      id:       schema.accounts.id,
      code:     schema.accounts.code,
      name:     schema.accounts.name,
      type:     schema.accounts.type,
      parentId: schema.accounts.parentId,
      isActive: schema.accounts.isActive,
    })
    .from(schema.accounts)
    .orderBy(schema.accounts.code);

  const tree = buildTree(flat);

  // Ambil account mappings dari settings
  const [mappingRow] = await db
    .select({ value: schema.settings.value })
    .from(schema.settings)
    .where(and(
      eq(schema.settings.key, "account_mappings"),
      eq(schema.settings.group, "keuangan")
    ))
    .limit(1);

  const mappings = (mappingRow?.value ?? {}) as Record<string, string | null>;

  // Daftar akun aktif untuk dropdown mapping
  const activeAccounts = flat.filter((a) => a.isActive);

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Akun Keuangan</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Kelola bagan akun (Chart of Accounts) dan konfigurasi mapping jurnal otomatis.
        </p>
      </div>

      {/* Chart of Accounts */}
      <AccountTree accounts={tree} slug={slug} />

      {/* Account Mappings */}
      <div>
        <h2 className="font-medium text-sm mb-1">Pengaturan Mapping Akun</h2>
        <p className="text-xs text-muted-foreground mb-3">
          Tentukan akun mana yang dipakai saat jurnal otomatis dibuat dari konfirmasi pembayaran dan pengeluaran.
        </p>
        <AccountMappingsForm
          slug={slug}
          accounts={activeAccounts}
          initialMappings={mappings}
        />
      </div>
    </div>
  );
}
