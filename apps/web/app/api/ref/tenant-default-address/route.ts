import { NextRequest, NextResponse } from "next/server";
import { createTenantDb, getSettings } from "@jalajogja/db";

type ContactAddress = {
  provinceId?: number;
  regencyId?:  number;
  districtId?: number;
  villageId?:  number;
};

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) return NextResponse.json({}, { status: 400 });

  try {
    const tenantDb = createTenantDb(slug);
    const settings = await getSettings(tenantDb, "contact");
    const address  = (settings.contact_address as ContactAddress | null) ?? {};

    return NextResponse.json({
      provinceId: address.provinceId ?? null,
      regencyId:  address.regencyId  ?? null,
      districtId: address.districtId ?? null,
      villageId:  address.villageId  ?? null,
    });
  } catch {
    return NextResponse.json({}, { status: 500 });
  }
}
