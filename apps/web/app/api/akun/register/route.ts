export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { eq, or }                    from "drizzle-orm";
import { db, profiles, tenants, contacts, members, tenantMemberships } from "@jalajogja/db";
import { auth }                      from "@/lib/auth";
import { normalizePhone }            from "@/lib/phone";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      path,           // "member" | "public"
      name,
      email,
      phone,
      whatsapp,
      password,
      tenantSlug,
      stambukNumber,
      claimMemberId,  // UUID member yang diklaim (sudah dicari via lookup)
    } = body as {
      path:           "member" | "public";
      name:           string;
      email:          string;
      phone:          string;
      whatsapp?:      string;
      password:       string;
      tenantSlug?:    string;
      stambukNumber?: string;
      claimMemberId?: string;  // jika mode KLAIM (data sudah ada di members)
    };

    if (!name?.trim())     return NextResponse.json({ error: "Nama wajib diisi." },     { status: 400 });
    if (!email?.trim())    return NextResponse.json({ error: "Email wajib diisi." },    { status: 400 });
    if (!phone?.trim())    return NextResponse.json({ error: "Nomor HP wajib diisi." }, { status: 400 });
    if (!password || password.length < 8)
      return NextResponse.json({ error: "Password minimal 8 karakter." }, { status: 400 });

    const normalizedEmail    = email.toLowerCase().trim();
    const normalizedPhone    = normalizePhone(phone) ?? phone.trim();
    const normalizedWhatsapp = normalizePhone(whatsapp);
    const normalizedStambuk  = stambukNumber?.trim() || null;

    // ── Tenant lookup ─────────────────────────────────────────────────────────
    let registeredAtTenant: string | null = null;
    if (tenantSlug) {
      const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, tenantSlug) });
      registeredAtTenant = tenant?.id ?? null;
    }

    // Helper: daftarkan member ke tenant (idempotent via ON CONFLICT DO NOTHING)
    async function joinTenant(memberId: string) {
      if (!registeredAtTenant) return;
      await db.insert(tenantMemberships)
        .values({
          tenantId:      registeredAtTenant,
          memberId,
          status:        "active",
          joinedAt:      new Date().toISOString().split("T")[0],
          registeredVia: "self_register",
        })
        .onConflictDoNothing();
    }

    // ════════════════════════════════════════════════════════════════════════════
    // JALUR ANGGOTA IKPM
    // ════════════════════════════════════════════════════════════════════════════
    if (path === "member") {

      // ── Mode KLAIM: data existing di public.members ─────────────────────────
      if (claimMemberId) {
        const existingMember = await db.query.members.findFirst({
          where: eq(members.id, claimMemberId),
          columns: { id: true, name: true, betterAuthUserId: true },
        });
        if (!existingMember)
          return NextResponse.json({ error: "Data anggota tidak ditemukan." }, { status: 404 });

        if (existingMember.betterAuthUserId)
          return NextResponse.json({ error: "Akun sudah terdaftar. Gunakan fitur lupa password." }, { status: 409 });

        // Cek email sudah dipakai Better Auth user lain
        const signUpResult = await auth.api.signUpEmail({
          body: { name: existingMember.name, email: normalizedEmail, password },
        });
        if (!signUpResult?.user?.id)
          return NextResponse.json({ error: "Gagal membuat akun. Coba lagi." }, { status: 500 });

        // Link akun ke member + daftarkan ke tenant
        await db
          .update(members)
          .set({ betterAuthUserId: signUpResult.user.id, updatedAt: new Date() })
          .where(eq(members.id, claimMemberId));

        await joinTenant(claimMemberId);

        return NextResponse.json({ success: true, mode: "claim" }, { status: 201 });
      }

      // ── Mode DAFTAR BARU: belum ada di public.members ───────────────────────
      // Cek duplikat email/phone di contacts
      const dupContact = await db.query.contacts.findFirst({
        where: or(eq(contacts.email, normalizedEmail), eq(contacts.phone, normalizedPhone)),
      });
      if (dupContact) {
        // Apakah sudah linked ke member?
        const linkedMember = await db.query.members.findFirst({
          where: eq(members.contactId, dupContact.id),
          columns: { id: true, betterAuthUserId: true },
        });
        if (linkedMember?.betterAuthUserId)
          return NextResponse.json({ error: "Email atau nomor HP sudah terdaftar. Silakan masuk." }, { status: 409 });
      }

      const signUpResult = await auth.api.signUpEmail({
        body: { name: name.trim(), email: normalizedEmail, password },
      });
      if (!signUpResult?.user?.id)
        return NextResponse.json({ error: "Gagal membuat akun. Coba lagi." }, { status: 500 });

      // Buat contacts
      const [newContact] = await db
        .insert(contacts)
        .values({ email: normalizedEmail, phone: normalizedPhone, whatsapp: normalizedWhatsapp })
        .returning({ id: contacts.id });

      // Buat member baru + daftarkan ke tenant
      const [newMember] = await db.insert(members).values({
        name:             name.trim(),
        stambukNumber:    normalizedStambuk,
        contactId:        newContact.id,
        betterAuthUserId: signUpResult.user.id,
      }).returning({ id: members.id });

      await joinTenant(newMember.id);

      return NextResponse.json({ success: true, mode: "new_member" }, { status: 201 });
    }

    // ════════════════════════════════════════════════════════════════════════════
    // JALUR AKUN PUBLIK
    // ════════════════════════════════════════════════════════════════════════════
    const existing = await db.query.profiles.findFirst({
      where: or(eq(profiles.email, normalizedEmail), eq(profiles.phone, normalizedPhone)),
    });
    if (existing)
      return NextResponse.json({ error: "Email atau nomor HP sudah terdaftar. Silakan masuk." }, { status: 409 });

    if (normalizedWhatsapp) {
      const existingWa = await db.query.profiles.findFirst({ where: eq(profiles.whatsapp, normalizedWhatsapp) });
      if (existingWa)
        return NextResponse.json({ error: "Nomor WhatsApp sudah terdaftar." }, { status: 409 });
    }

    const signUpResult = await auth.api.signUpEmail({
      body: { name: name.trim(), email: normalizedEmail, password },
    });
    if (!signUpResult?.user?.id)
      return NextResponse.json({ error: "Gagal membuat akun. Coba lagi." }, { status: 500 });

    await db.insert(profiles).values({
      name:               name.trim(),
      email:              normalizedEmail,
      phone:              normalizedPhone,
      whatsapp:           normalizedWhatsapp,
      betterAuthUserId:   signUpResult.user.id,
      registeredAtTenant,
    });

    return NextResponse.json({ success: true, mode: "public" }, { status: 201 });

  } catch (err: unknown) {
    console.error("[POST /api/akun/register]", err);
    const message = err instanceof Error ? err.message : "";
    if (message.toLowerCase().includes("email") || message.toLowerCase().includes("duplicate"))
      return NextResponse.json({ error: "Email sudah terdaftar." }, { status: 409 });
    return NextResponse.json({ error: "Terjadi kesalahan. Coba lagi." }, { status: 500 });
  }
}
