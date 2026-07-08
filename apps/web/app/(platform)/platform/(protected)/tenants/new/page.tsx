import { db, refIkpmCabang } from "@jalajogja/db";
import { eq } from "drizzle-orm";
import { NewTenantForm } from "./new-tenant-form";

export default async function NewTenantPage() {
  const cabangList = await db
    .select({ id: refIkpmCabang.id, nama: refIkpmCabang.nama, kota: refIkpmCabang.kota })
    .from(refIkpmCabang)
    .where(eq(refIkpmCabang.isActive, true))
    .orderBy(refIkpmCabang.nama);

  return <NewTenantForm cabangList={cabangList} />;
}
