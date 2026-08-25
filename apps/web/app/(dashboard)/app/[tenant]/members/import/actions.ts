"use server";

import { eq, and, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  db, members, contacts, addresses, socialMedias, memberBusinesses, tenantMemberships,
  importBatches, importBatchRows, generateMemberNumber, forumMembershipSequences,
  syncAutoTenantMemberships,
} from "@jalajogja/db";
import { getTenantAccess } from "@/lib/tenant";
import { hasFullAccess } from "@/lib/permissions";
import { parseXlsxBuffer, buildPreviewRow, computeMemberMergeCandidate } from "@/lib/import-anggota.server";
import { extractYearSeqFromMembershipNumber, type ImportRowPreview } from "@/lib/import-anggota-mapping";

// ─── Parse & Preview ─────────────────────────────────────────────────────────

export type ParseImportResult =
  | { success: true; batchId: string; rows: ImportRowPreview[]; summary: ImportSummary }
  | { success: false; error: string };

export type ImportSummary = {
  total: number;
  ready: number;
  reviewNeeded: number;
  duplicate: number;
  error: number;
};

function summarize(rows: ImportRowPreview[]): ImportSummary {
  return {
    total: rows.length,
    ready:        rows.filter((r) => r.status === "ready").length,
    reviewNeeded: rows.filter((r) => r.status === "review_needed").length,
    duplicate:    rows.filter((r) => r.status === "duplicate").length,
    error:        rows.filter((r) => r.status === "error").length,
  };
}

export async function parseImportFileAction(slug: string, formData: FormData): Promise<ParseImportResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "anggota")) return { success: false, error: "Akses ditolak." };

  const file = formData.get("file");
  if (!(file instanceof File)) return { success: false, error: "File tidak ditemukan." };

  let buffer: ArrayBuffer;
  try {
    buffer = await file.arrayBuffer();
  } catch {
    return { success: false, error: "Gagal membaca file." };
  }

  const { headerError, rows: rawRows } = parseXlsxBuffer(buffer);
  if (headerError) return { success: false, error: headerError };
  if (rawRows.length === 0) return { success: false, error: "Tidak ada baris data di file (semua baris kosong)." };
  if (rawRows.length > 5000) return { success: false, error: "Maksimal 5000 baris per import — pecah file jadi beberapa batch." };

  try {
    const isForumTenant = access.tenant.tenantType === "forum";
    const previews: ImportRowPreview[] = [];
    const seenContacts = new Map<string, number>(); // deteksi duplikat antar-baris dalam file yang sama
    for (let i = 0; i < rawRows.length; i++) {
      previews.push(await buildPreviewRow(rawRows[i], i + 2, access.tenant.id, isForumTenant, seenContacts)); // +2: baris 1 = header
    }

    const summary = summarize(previews);

    const [batch] = await db.insert(importBatches).values({
      tenantId: access.tenant.id,
      fileName: file.name,
      importedByUserId: access.userId,
      status: "draft",
      totalRows: previews.length,
    }).returning({ id: importBatches.id });

    for (const p of previews) {
      await db.insert(importBatchRows).values({
        batchId: batch.id,
        rowNumber: p.rowNumber,
        status: p.status,
        memberName: p.member.fullName || null,
        memberId: p.existingMemberId,
        data: p as unknown as Record<string, unknown>,
      });
    }

    return { success: true, batchId: batch.id, rows: previews, summary };
  } catch (err) {
    console.error("[parseImportFileAction]", err);
    const msg = err instanceof Error ? err.message : "Gagal memproses file.";
    return { success: false, error: `Gagal: ${msg}` };
  }
}

// ─── Ambil draft batch yang sudah ada (resume setelah reload) ───────────────

export type GetDraftBatchResult =
  | { success: true; batchId: string; fileName: string; rows: ImportRowPreview[]; summary: ImportSummary }
  | { success: false; error: string };

export async function getDraftBatchAction(slug: string, batchId: string): Promise<GetDraftBatchResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "anggota")) return { success: false, error: "Akses ditolak." };

  const [batch] = await db.select().from(importBatches)
    .where(and(eq(importBatches.id, batchId), eq(importBatches.tenantId, access.tenant.id)))
    .limit(1);
  if (!batch || batch.status !== "draft") return { success: false, error: "Draft import tidak ditemukan atau sudah selesai diproses." };

  const rowsRaw = await db.select().from(importBatchRows)
    .where(eq(importBatchRows.batchId, batchId))
    .orderBy(importBatchRows.rowNumber);

  const rows = rowsRaw.map((r) => r.data as unknown as ImportRowPreview);
  return { success: true, batchId, fileName: batch.fileName, rows, summary: summarize(rows) };
}

// ─── Commit ──────────────────────────────────────────────────────────────────

export type RowOverride = { category?: string; sector?: string; skip?: boolean };

export type CommitImportResult =
  | { success: true; inserted: number; merged: number; skipped: number }
  | { success: false; error: string };

export async function commitImportAction(
  slug: string,
  batchId: string,
  overrides: Record<number, RowOverride>,
): Promise<CommitImportResult> {
  const access = await getTenantAccess(slug);
  if (!access) return { success: false, error: "Akses ditolak." };
  if (!hasFullAccess(access.tenantUser, "anggota")) return { success: false, error: "Akses ditolak." };

  const [batch] = await db.select().from(importBatches)
    .where(and(eq(importBatches.id, batchId), eq(importBatches.tenantId, access.tenant.id)))
    .limit(1);
  if (!batch) return { success: false, error: "Batch import tidak ditemukan." };

  // Klaim atomic (compare-and-swap) — bukan cuma cek status lalu proses. Kalau dua klik
  // commit terjadi hampir bersamaan (double-submit), hanya SATU yang berhasil UPDATE baris
  // ini (WHERE status='draft' hanya match sekali) — yang kedua dapat 0 baris ter-update dan
  // berhenti, bukan ikut memproses 749 baris yang sama dua kali. Pola sama dengan lock+guard
  // yang sudah berulang dipakai project ini (checkout, payment confirm, event registration).
  const claimed = await db.update(importBatches)
    .set({ status: "committed" })
    .where(and(eq(importBatches.id, batchId), eq(importBatches.status, "draft")))
    .returning({ id: importBatches.id });
  if (claimed.length === 0) return { success: false, error: "Batch ini sudah pernah dikomit sebelumnya." };

  const rowsRaw = await db.select().from(importBatchRows)
    .where(eq(importBatchRows.batchId, batchId))
    .orderBy(importBatchRows.rowNumber);

  // Nomor Keanggotaan (kolom "Nomor Keanggotaan" di template) HANYA relevan untuk tenant
  // forum — lihat § 5 dokumen arsitektur + skema `tenant_memberships.membership_number`
  // ("khusus forum, null untuk cabang/marhalah"). Dihitung sekali di sini (bukan per-baris)
  // karena tipe tenant tidak berubah selama satu commit berjalan.
  //
  // KOREKSI 2026-07-31 (§ 22.5, superseded § 22.4): nomor keanggotaan TIDAK PERNAH di-generate
  // saat import — HANYA dipakai apa adanya kalau Excel menyediakannya. Auto-generate
  // (`generateForumMembershipNumber()`) TETAP eksklusif untuk `/gabung` (join real-time,
  // "urutan berikutnya" genuinely akurat untuk join yang benar-benar terjadi saat itu).
  // Standar KETAT: member yang PUNYA nomor (di Excel ATAU sudah ada di DB) → langsung resmi
  // jadi anggota forum (forumStatus="active"). Member TANPA nomor sama sekali → belum resmi
  // jadi anggota, tetap "pending" — datanya sudah ditaruh di sistem tapi belum terdaftar
  // official, menunggu nomor diberikan (baik lewat import susulan yang membawa nomornya,
  // maupun member itu sendiri join manual via /gabung nanti). Prinsip ini menjaga urutan
  // nomor tetap merepresentasikan histori pendaftaran yang sesungguhnya — bukan angka yang
  // dikarang untuk menutupi data yang belum lengkap.
  const isForumTenant = access.tenant.tenantType === "forum";

  let inserted = 0;
  let merged = 0;
  let skipped = 0;
  let maxImportedSeq = 0; // seq tertinggi dari Nomor Keanggotaan yang BENAR-BENAR tertulis ke DB (forum saja)

  for (const rowRecord of rowsRaw) {
    const preview = rowRecord.data as unknown as ImportRowPreview;
    const override = overrides[preview.rowNumber];

    // "duplicate" TIDAK LAGI otomatis di-skip (2026-07-25, § 16) — member yang cocok
    // dengan data existing SELALU diproses (dilengkapi field kosongnya), baik yang sudah
    // jadi anggota tenant ini maupun belum. Skip HANYA untuk error (nama kosong) atau
    // override manual admin.
    const shouldSkip = override?.skip || preview.status === "error";
    if (shouldSkip) {
      skipped++;
      await db.update(importBatchRows).set({ status: "skipped" }).where(eq(importBatchRows.id, rowRecord.id));
      continue;
    }

    // `preview.member.nik`/`nikHash` SUDAH ciphertext/hash di titik ini — dienkripsi
    // sedini mungkin di buildPreviewRow() (lib/import-anggota.server.ts), SEBELUM baris
    // ini pernah tersimpan ke draft `import_batch_rows.data` (JSONB), supaya NIK
    // plaintext tidak pernah singgah di DB sama sekali, bahkan sementara selagi admin
    // meninjau hasil parse. JANGAN panggil encryptPii() lagi di sini — nilainya bukan
    // plaintext, memanggilnya lagi akan mengenkripsi-ulang ciphertext itu sendiri
    // (double-encryption, korup diam-diam: decryptPii() nanti cuma akan membuka SATU
    // lapis dan menghasilkan string ciphertext lama, bukan NIK asli).
    const encryptedNik = preview.member.nik;
    const nikHashValue  = preview.member.nikHash;

    try {
      const { finalMemberId, writtenMembershipNumber } = await db.transaction(async (tx) => {
        let memberId = preview.existingMemberId;
        let writtenMembershipNumber: string | null = null;

        // BUG DITEMUKAN 2026-07-26: sebelumnya digate `!preview.linkOnly` — kondisi itu
        // bernilai true untuk DUA kasus: (1) member benar-benar baru (existingMemberId=null)
        // DAN (2) baris "duplicate" (member sudah ada + sudah jadi anggota tenant ini,
        // existingMemberId terisi tapi linkOnly=false). Akibatnya setiap re-import file yang
        // sama membuat contact+address+member BARU yang ganda untuk baris duplicate — bisa
        // membakar Nomor ID IKPM global baru kalau tanggal lahir terisi, dan hasilnya jadi
        // record orphan (tidak pernah dapat tenant_membership karena guard di bawah sudah
        // benar cek existingTenantMembershipId). Gate yang benar: HANYA insert member baru
        // kalau BENAR-BENAR tidak ada member existing yang cocok sama sekali.
        if (!preview.existingMemberId) {
          // ── Member baru: contact + address + member ──
          let contactId: string | null = null;
          if (preview.contact.phone || preview.contact.whatsapp || preview.contact.email) {
            const [c] = await tx.insert(contacts).values({
              phone: preview.contact.phone, whatsapp: preview.contact.whatsapp, email: preview.contact.email,
            }).returning({ id: contacts.id });
            contactId = c.id;
          }

          let homeAddressId: string | null = null;
          if (preview.address.detail || preview.address.provinceId || preview.address.country || preview.address.postalCode) {
            const [a] = await tx.insert(addresses).values({
              label: "rumah",
              detail: preview.address.detail,
              provinceId: preview.address.provinceId,
              regencyId: preview.address.regencyId,
              districtId: preview.address.districtId,
              villageId: preview.address.villageId,
              postalCode: preview.address.postalCode,
              country: preview.address.country,
            }).returning({ id: addresses.id });
            homeAddressId = a.id;
          }

          // Nomor ID IKPM (global) HANYA di-generate kalau Tanggal Lahir tersedia — nomor
          // ini permanen (sekali dicetak, tidak pernah diperbaiki lagi otomatis), jadi kalau
          // birthDate kosong (umum untuk database historis lama), JANGAN generate sekarang
          // dengan placeholder — biarkan null, sama seperti pola yang SUDAH ADA di
          // register/route.ts (registrasi self-service) dan platform actions.ts (buat owner
          // pertama): member baru boleh dibuat TANPA memberNumber sama sekali, dan
          // PATCH /api/akun/member-data (guard `if (!member.memberNumber)`) akan generate
          // nomor yang benar begitu orangnya sendiri login dan mengisi tanggal lahir asli.
          const memberNumber = preview.member.birthDate
            ? await generateMemberNumber(db, preview.member.birthDate)
            : null;
          const [m] = await tx.insert(members).values({
            name: preview.member.fullName,
            gender: preview.member.gender,
            graduationYear: preview.member.graduationYear,
            graduationPeriod: preview.member.graduationPeriod,
            birthDate: preview.member.birthDate,
            birthPlaceText: preview.member.birthPlaceText,
            stambukNumber: preview.member.stambukNumber,
            nik: encryptedNik,
            nikHash: nikHashValue,
            waliSantri: preview.member.waliSantri,
            domicileStatus: preview.member.domicileStatus,
            professionId: preview.member.professionId,
            primaryCabangRefId: preview.member.primaryCabangRefId,
            memberNumber,
            contactId,
            homeAddressId,
          }).returning({ id: members.id });
          memberId = m.id;
        }

        if (!memberId) throw new Error("memberId tidak terselesaikan");

        // ── Lengkapi data member EXISTING yang kosong (§ 16) — SELALU dicoba untuk baris
        // yang cocok member existing (linkOnly=true MAUPUN sudah jadi anggota tenant ini),
        // dihitung ULANG di sini via computeMemberMergeCandidate (bukan percaya hasil preview
        // yang bisa saja sudah agak basi kalau draft sempat didiamkan lama sebelum commit).
        // TIDAK PERNAH menimpa field yang di database sudah terisi — cuma isi yang kosong.
        let existingTenantMembershipId: string | null = null;
        if (preview.existingMemberId) {
          // PENTING: JANGAN kirim `preview.member` apa adanya — objek itu punya field
          // `fullName` yang BUKAN bagian MemberFieldPatch (kolom DB-nya `name`, sudah pasti
          // terisi, tidak pernah "dilengkapi"). `fillEmpty()` men-scan SEMUA key yang ADA di
          // objek `incoming` (runtime, bukan cuma yang dijamin TypeScript) — `fullName` bocor
          // masuk patch (dianggap "kosong" karena kolom itu tidak pernah di-SELECT di
          // computeMemberMergeCandidate) → UPDATE members SET dengan kolom tak dikenal →
          // Drizzle hasilkan SQL "SET" kosong → "syntax error at or near where". Bug nyata
          // ditemukan dari testing user (§ 17) — buildPreviewRow SUDAH benar (pakai variabel
          // lokal eksplisit), cuma titik commit ini yang salah kirim objek utuh.
          const candidate = await computeMemberMergeCandidate(
            preview.existingMemberId, access.tenant.id, isForumTenant,
            {
              gender: preview.member.gender, graduationYear: preview.member.graduationYear,
              graduationPeriod: preview.member.graduationPeriod, birthDate: preview.member.birthDate,
              birthPlaceText: preview.member.birthPlaceText, stambukNumber: preview.member.stambukNumber,
              nik: encryptedNik, nikHash: nikHashValue, waliSantri: preview.member.waliSantri,
              domicileStatus: preview.member.domicileStatus, professionId: preview.member.professionId,
              primaryCabangRefId: preview.member.primaryCabangRefId,
            },
            preview.contact, preview.membershipNumber,
          );
          if (Object.keys(candidate.memberPatch).length > 0) {
            await tx.update(members).set(candidate.memberPatch).where(eq(members.id, preview.existingMemberId));
          }
          if (candidate.contactId && Object.keys(candidate.contactPatch).length > 0) {
            await tx.update(contacts).set(candidate.contactPatch).where(eq(contacts.id, candidate.contactId));
          }
          existingTenantMembershipId = candidate.existingTenantMembershipId;
          if (existingTenantMembershipId && (candidate.membershipNumberPatch || candidate.activateForumStatus)) {
            const tmPatch: { membershipNumber?: string; forumStatus?: "active" } = {};
            if (candidate.membershipNumberPatch) tmPatch.membershipNumber = candidate.membershipNumberPatch;
            if (candidate.activateForumStatus) tmPatch.forumStatus = "active";
            await tx.update(tenantMemberships).set(tmPatch).where(eq(tenantMemberships.id, existingTenantMembershipId));
            if (candidate.membershipNumberPatch) writtenMembershipNumber = candidate.membershipNumberPatch;
          }
        }

        // ── Usaha (opsional) ──
        if (preview.business) {
          const b = preview.business;
          let bizContactId: string | null = null;
          if (b.phone || b.whatsapp) {
            const [c] = await tx.insert(contacts).values({ phone: b.phone, whatsapp: b.whatsapp }).returning({ id: contacts.id });
            bizContactId = c.id;
          }
          let bizAddressId: string | null = null;
          if (b.addressDetail || b.addressProvinceId || b.addressCountry) {
            const [a] = await tx.insert(addresses).values({
              label: "usaha", detail: b.addressDetail, provinceId: b.addressProvinceId,
              regencyId: b.addressRegencyId, country: b.addressCountry,
            }).returning({ id: addresses.id });
            bizAddressId = a.id;
          }
          let bizSocialId: string | null = null;
          if (b.facebook || b.instagram || b.tiktok || b.website) {
            const [s] = await tx.insert(socialMedias).values({
              facebook: b.facebook, instagram: b.instagram, tiktok: b.tiktok, website: b.website,
            }).returning({ id: socialMedias.id });
            bizSocialId = s.id;
          }

          await tx.insert(memberBusinesses).values({
            memberId,
            name: b.name,
            brand: b.brand,
            description: b.description,
            category: (override?.category ?? b.category) as typeof memberBusinesses.$inferInsert["category"],
            sector: (override?.sector ?? b.sector) as typeof memberBusinesses.$inferInsert["sector"],
            businessFields: b.businessFields,
            legality: b.legality as typeof memberBusinesses.$inferInsert["legality"],
            position: b.position as typeof memberBusinesses.$inferInsert["position"],
            employees: b.employees as typeof memberBusinesses.$inferInsert["employees"],
            branches: b.branches as typeof memberBusinesses.$inferInsert["branches"],
            revenue: b.revenue as typeof memberBusinesses.$inferInsert["revenue"],
            contactId: bizContactId,
            addressId: bizAddressId,
            socialMediaId: bizSocialId,
          });
        }

        // ── Keanggotaan tenant — HANYA insert kalau BELUM ada baris tenant_membership untuk
        // tenant ini (member benar-benar baru, ATAU member existing yang belum jadi anggota
        // tenant ini). Kalau sudah ada (existingTenantMembershipId terisi dari blok merge di
        // atas) — JANGAN insert lagi (constraint unique tenantId+memberId akan menolak
        // duplikat); membershipNumber-nya sudah ditangani via UPDATE di blok merge. ──
        // forumStatus HANYA relevan untuk tenant forum (skema: "khusus forum, null untuk
        // cabang/marhalah" — docs/arsitektur-backbone-ikpm.md § "Nomor Keanggotaan Lokal
        // Forum"). STANDAR KETAT (dikunci user 2026-07-31, § 22.5): "active" HANYA kalau baris
        // ini PUNYA Nomor Keanggotaan (dari Excel) — tanpa nomor, orangnya BELUM resmi jadi
        // anggota forum meski datanya sudah ditaruh admin, tetap "pending". Nomor TIDAK PERNAH
        // di-generate di sini (beda dari /gabung) — supaya urutan nomor tetap merepresentasikan
        // histori pendaftaran sesungguhnya, bukan angka karangan untuk data yang belum lengkap.
        // Data pribadi yang belum lengkap tetap diminta dilengkapi lewat overlay eligibility
        // terpisah di /akun (lihat akun/page.tsx) — itu independen dari forumStatus/nomor ini.
        // Tool ini reusable lintas tipe tenant: cabang/marhalah dapat membershipType sesuai
        // access.tenant.tenantType dan tidak pernah dapat forumStatus/membershipNumber.
        // (`isForumTenant` dihitung sekali di scope luar fungsi ini — lihat atas.)
        if (!existingTenantMembershipId) {
          const membershipNumber = isForumTenant ? preview.membershipNumber : null;
          await tx.insert(tenantMemberships).values({
            tenantId: access.tenant.id,
            memberId,
            status: "active",
            registeredVia: "import",
            membershipType: access.tenant.tenantType,
            forumStatus: isForumTenant ? (membershipNumber ? "active" : "pending") : null,
            membershipNumber,
          });
          if (isForumTenant && membershipNumber) writtenMembershipNumber = membershipNumber;
        }

        // Auto-sync keanggotaan ke tenant PC IKPM Cabang & Marhalah jika tenant tersebut ada & aktif
        const [finalMemberRow] = await tx.select({
          primaryCabangRefId: members.primaryCabangRefId,
          graduationYear: members.graduationYear,
          graduationPeriod: members.graduationPeriod,
        }).from(members).where(eq(members.id, memberId)).limit(1);

        if (finalMemberRow) {
          await syncAutoTenantMemberships(
            tx,
            memberId,
            finalMemberRow.primaryCabangRefId,
            finalMemberRow.graduationYear,
            finalMemberRow.graduationPeriod,
          );
        }

        return { finalMemberId: memberId, writtenMembershipNumber };
      });

      if (preview.existingMemberId) merged++; else inserted++;
      // writtenMembershipNumber = nomor yang BENAR-BENAR tertulis di baris ini (baik dari
      // insert baru MAUPUN backfill ke tenant_membership existing) — bukan preview.membershipNumber
      // mentah, supaya lanjutan counter tetap benar untuk kedua jalur.
      if (isForumTenant && writtenMembershipNumber) {
        const parsed = extractYearSeqFromMembershipNumber(writtenMembershipNumber);
        if (parsed && parsed.seq > maxImportedSeq) maxImportedSeq = parsed.seq;
      }
      await db.update(importBatchRows)
        .set({ status: "inserted", memberId: finalMemberId })
        .where(eq(importBatchRows.id, rowRecord.id));
    } catch (err) {
      console.error(`[commitImportAction] baris ${preview.rowNumber}`, err);
      skipped++;
      await db.update(importBatchRows)
        .set({ status: "skipped", data: { ...preview, notes: [...preview.notes, `Gagal insert: ${err instanceof Error ? err.message : "unknown error"}`] } })
        .where(eq(importBatchRows.id, rowRecord.id));
    }
  }

  // ── Lanjutkan counter nomor keanggotaan forum ──────────────────────────────────
  // Nomor Keanggotaan yang diimport dipakai APA ADANYA sebagai membership_number (bukan
  // di-generate) — tapi forum_membership_sequences.last_number (dipakai generateForum
  // MembershipNumber() untuk join /gabung BERIKUTNYA) tidak otomatis tahu soal ini. Tanpa
  // langkah ini, join pertama pasca-import akan mulai dari seq=1 lagi — nabrak seq yang
  // sudah dipakai anggota lama (mis. "2017.00001") meski string lengkapnya beda karena
  // prefix tahun beda. HANYA berlaku kalau nomor yang diimport formatnya "TAHUN.URUTAN"
  // (extractYearSeqFromMembershipNumber) — format lain diterima sebagai teks tapi tidak ikut
  // proses lanjutan counter ini (tidak ada cara generik melanjutkan format yang tidak
  // dikenal). Pola locking SAMA PERSIS generateForumMembershipNumber() (SELECT FOR UPDATE)
  // — hanya MAJU (GREATEST), tidak pernah mundur kalau counter sudah lebih tinggi dari batch
  // import ini (mis. sudah ada join manual sebelum import ini jalan).
  if (maxImportedSeq > 0) {
    await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(forumMembershipSequences)
        .where(sql`${forumMembershipSequences.tenantId} = ${access.tenant.id} FOR UPDATE`)
        .limit(1);
      if (existing) {
        if (maxImportedSeq > existing.lastNumber) {
          await tx.update(forumMembershipSequences)
            .set({ lastNumber: maxImportedSeq, updatedAt: new Date() })
            .where(eq(forumMembershipSequences.id, existing.id));
        }
      } else {
        await tx.insert(forumMembershipSequences).values({ tenantId: access.tenant.id, lastNumber: maxImportedSeq });
      }
    });
  }

  await db.update(importBatches).set({
    status: "committed",
    // insertedRows di sini = SEMUA baris yang benar-benar diproses (member baru + member
    // existing yang dilengkapi) — kolom ini tidak punya slot terpisah untuk "merged", jadi
    // dijumlah supaya laporan batch tetap akurat. Rincian inserted-vs-merged hanya ada di
    // return value (tampilan layar sekali pakai) — bukan disimpan terpisah di DB, konsisten
    // dengan keputusan tidak menambah migration untuk pembedaan ini.
    insertedRows: inserted + merged,
    skippedRows: skipped,
    reviewFlagRows: rowsRaw.filter((r) => (r.data as unknown as ImportRowPreview).status === "review_needed").length,
  }).where(eq(importBatches.id, batchId));

  revalidatePath(`/app/${slug}/members`);
  return { success: true, inserted, merged, skipped };
}
