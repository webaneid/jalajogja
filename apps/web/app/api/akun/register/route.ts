export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { eq, or, and, gt }           from "drizzle-orm";
import { db, profiles, tenants, contacts, members, tenantMemberships, user as authUser, verification } from "@jalajogja/db";
import { auth }                      from "@/lib/auth";
import { normalizePhone }            from "@/lib/phone";
import { rateLimitGuard }            from "@/lib/rate-limit";

// Cleanup Better Auth account jika app-level insert gagal.
// Tanpa ini, signUpEmail yang berhasil + insert gagal = orphan account yang bisa
// login tapi tidak bisa akses /akun (getAkunIdentity() null → loop).
async function cleanupAuthUser(authUserId: string): Promise<void> {
  await db.delete(authUser)
    .where(eq(authUser.id, authUserId))
    .catch(e => console.error("[register] Gagal cleanup Better Auth user:", e));
}

export async function POST(req: NextRequest) {
  const blocked = rateLimitGuard(req, "register", 5, 60_000);
  if (blocked) return blocked;

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
      claimToken,     // bukti OTP terverifikasi untuk claimMemberId ini (dari /api/akun/verify-otp)
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
      claimToken?:    string;
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

    // ── Cek email di Better Auth sebelum signUpEmail ──────────────────────────
    async function checkEmailTaken(): Promise<boolean> {
      const existing = await db.query.user.findFirst({
        where: eq(authUser.email, normalizedEmail),
        columns: { id: true },
      });
      return !!existing;
    }

    // ── Tenant lookup ─────────────────────────────────────────────────────────
    let registeredAtTenant:     string | null = null;
    let tenantRefCabangId:      string | null = null;
    let registeredAtTenantType: string | null = null;
    if (tenantSlug) {
      const tenant = await db.query.tenants.findFirst({
        where:   eq(tenants.slug, tenantSlug),
        columns: { id: true, refCabangId: true, tenantType: true },
      });
      registeredAtTenant     = tenant?.id ?? null;
      tenantRefCabangId      = tenant?.refCabangId ?? null;
      registeredAtTenantType = tenant?.tenantType ?? null;
    }

    // Helper: daftarkan member ke tenant (idempotent via ON CONFLICT DO NOTHING).
    // Forum SENGAJA di-skip — satu-satunya jalur resmi jadi anggota forum adalah `/gabung`
    // (lihat docs/arsitektur-backbone-ikpm.md § "Alur Pendaftaran Forum v2"), bukan sekadar
    // registrasi akun di domain forum tersebut. Cabang/marhalah TIDAK berubah — auto-join
    // saat registrasi tetap terjadi seperti sebelumnya.
    async function joinTenant(memberId: string) {
      if (!registeredAtTenant) return;
      if (registeredAtTenantType === "forum") return;
      await db.insert(tenantMemberships)
        .values({
          tenantId:      registeredAtTenant,
          memberId,
          status:        "active",
          joinedAt:      new Date().toISOString().split("T")[0],
          registeredVia: "self",
        })
        .onConflictDoNothing();
    }

    // ════════════════════════════════════════════════════════════════════════════
    // JALUR ANGGOTA IKPM
    // ════════════════════════════════════════════════════════════════════════════
    if (path === "member") {

      // ── Mode KLAIM: data existing di public.members ─────────────────────────
      if (claimMemberId) {
        // WAJIB proof-of-ownership via OTP — tanpa ini, siapa pun yang tahu/menebak
        // memberId (mis. lewat /api/akun/lookup-member?stambuk=) bisa klaim identitas
        // orang lain hanya dengan email/password miliknya sendiri. claimToken hanya
        // diterbitkan oleh /api/akun/verify-otp setelah OTP ke nomor WA TERDAFTAR milik
        // member itu berhasil diverifikasi — sekali pakai, dihapus segera setelah dicek.
        if (!claimToken)
          return NextResponse.json({ error: "Verifikasi WhatsApp diperlukan untuk klaim akun anggota." }, { status: 403 });

        // DELETE ... RETURNING dalam satu statement — atomic, tidak ada window SELECT-lalu-
        // DELETE terpisah yang bisa dipakai dua request bersamaan pakai claimToken yang sama
        // (baris DB yang sama tidak mungkin di-DELETE dua kali).
        const [proof] = await db
          .delete(verification)
          .where(and(
            eq(verification.identifier, `claim-member:${claimToken}`),
            gt(verification.expiresAt, new Date()),
          ))
          .returning({ value: verification.value });

        if (!proof || proof.value !== claimMemberId) {
          return NextResponse.json({ error: "Verifikasi tidak valid atau sudah kadaluarsa. Ulangi proses klaim akun." }, { status: 403 });
        }

        const existingMember = await db.query.members.findFirst({
          where: eq(members.id, claimMemberId),
          columns: { id: true, name: true, betterAuthUserId: true },
        });
        if (!existingMember)
          return NextResponse.json({ error: "Data anggota tidak ditemukan." }, { status: 404 });

        if (existingMember.betterAuthUserId)
          return NextResponse.json({ error: "Akun sudah terdaftar. Gunakan fitur lupa password." }, { status: 409 });

        // Cek email sudah dipakai di Better Auth
        if (await checkEmailTaken())
          return NextResponse.json({ error: "Email sudah terdaftar. Silakan masuk atau gunakan lupa password." }, { status: 409 });

        const signUpResult = await auth.api.signUpEmail({
          body: { name: existingMember.name, email: normalizedEmail, password },
        });
        if (!signUpResult?.user?.id)
          return NextResponse.json({ error: "Gagal membuat akun. Email mungkin sudah terdaftar di sistem." }, { status: 500 });

        // Link akun ke member + daftarkan ke tenant
        // Kalau gagal: cleanup Better Auth account agar tidak jadi orphan
        try {
          await db
            .update(members)
            .set({
              betterAuthUserId:   signUpResult.user.id,
              // Auto-set cabang resmi jika daftar di tenant cabang yang punya ref
              ...(tenantRefCabangId ? { primaryCabangRefId: tenantRefCabangId } : {}),
              updatedAt:          new Date(),
            })
            .where(eq(members.id, claimMemberId));
          await joinTenant(claimMemberId);
        } catch (linkErr) {
          await cleanupAuthUser(signUpResult.user.id);
          throw linkErr;
        }

        return NextResponse.json({ success: true, mode: "claim" }, { status: 201 });
      }

      // ── Mode DAFTAR BARU: belum ada di public.members ───────────────────────
      // Cek duplikat email/phone — JOIN langsung ke members, JANGAN cari contact dulu.
      // Satu email/nomor bisa muncul di banyak baris contacts (member sendiri, usaha,
      // pesantren, profesional — masing-masing self-reported dengan contactId sendiri).
      // Cari contact dulu lalu member terpisah bisa memilih baris yang TIDAK terhubung
      // ke members sama sekali → duplikat lolos tidak terdeteksi meski emailnya sudah
      // dipakai anggota lain yang sudah punya akun.
      const [linkedMember] = await db
        .select({ id: members.id, betterAuthUserId: members.betterAuthUserId })
        .from(members)
        .innerJoin(contacts, eq(contacts.id, members.contactId))
        .where(or(eq(contacts.email, normalizedEmail), eq(contacts.phone, normalizedPhone)))
        .limit(1);
      if (linkedMember?.betterAuthUserId)
        return NextResponse.json({ error: "Email atau nomor HP sudah terdaftar. Silakan masuk." }, { status: 409 });

      // Cek email di Better Auth (bisa saja sudah jadi admin di tenant lain)
      if (await checkEmailTaken())
        return NextResponse.json({ error: "Email sudah terdaftar. Silakan masuk atau gunakan lupa password." }, { status: 409 });

      const signUpResult = await auth.api.signUpEmail({
        body: { name: name.trim(), email: normalizedEmail, password },
      });
      if (!signUpResult?.user?.id)
        return NextResponse.json({ error: "Gagal membuat akun. Email mungkin sudah terdaftar di sistem." }, { status: 500 });

      // Buat contacts + member + daftar ke tenant
      // Kalau salah satu gagal: cleanup Better Auth account agar tidak jadi orphan
      try {
        const [newContact] = await db
          .insert(contacts)
          .values({ email: normalizedEmail, phone: normalizedPhone, whatsapp: normalizedWhatsapp })
          .returning({ id: contacts.id });

        const [newMember] = await db.insert(members).values({
          name:               name.trim(),
          stambukNumber:      normalizedStambuk,
          contactId:          newContact.id,
          betterAuthUserId:   signUpResult.user.id,
          // Auto-set cabang resmi dari tenant tempat mendaftar (jika cabang tenant)
          ...(tenantRefCabangId ? { primaryCabangRefId: tenantRefCabangId } : {}),
        }).returning({ id: members.id });

        await joinTenant(newMember.id);
      } catch (insertErr) {
        await cleanupAuthUser(signUpResult.user.id);
        throw insertErr;
      }

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

    if (await checkEmailTaken())
      return NextResponse.json({ error: "Email sudah terdaftar. Silakan masuk atau gunakan lupa password." }, { status: 409 });

    const signUpResult = await auth.api.signUpEmail({
      body: { name: name.trim(), email: normalizedEmail, password },
    });
    if (!signUpResult?.user?.id)
      return NextResponse.json({ error: "Gagal membuat akun. Email mungkin sudah terdaftar di sistem." }, { status: 500 });

    // Kalau insert profiles gagal: cleanup Better Auth account agar tidak jadi orphan
    try {
      await db.insert(profiles).values({
        name:               name.trim(),
        email:              normalizedEmail,
        phone:              normalizedPhone,
        whatsapp:           normalizedWhatsapp,
        betterAuthUserId:   signUpResult.user.id,
        registeredAtTenant,
      });
    } catch (insertErr) {
      await cleanupAuthUser(signUpResult.user.id);
      throw insertErr;
    }

    return NextResponse.json({ success: true, mode: "public" }, { status: 201 });

  } catch (err: unknown) {
    console.error("[POST /api/akun/register]", err);
    const message = (err instanceof Error ? err.message : String(err)).toLowerCase();
    if (message.includes("email") || message.includes("duplicate") || message.includes("already exists") || message.includes("unique"))
      return NextResponse.json({ error: "Email atau nomor HP sudah terdaftar." }, { status: 409 });
    return NextResponse.json({ error: "Terjadi kesalahan. Coba lagi." }, { status: 500 });
  }
}
