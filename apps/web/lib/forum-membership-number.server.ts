import "server-only";
import { sql, eq } from "drizzle-orm";
import { db, members, forumMembershipSequences } from "@jalajogja/db";
import { formatForumMembershipNumber, type ForumMembershipNumberFormat } from "@/lib/forum-membership-number";

export { FORUM_MEMBERSHIP_NUMBER_FORMATS, FORUM_MEMBERSHIP_NUMBER_FORMAT_LABELS } from "@/lib/forum-membership-number";
export type { ForumMembershipNumberFormat } from "@/lib/forum-membership-number";

/**
 * Generate + kembalikan nomor keanggotaan lokal forum berikutnya untuk sebuah tenant —
 * atomic via SELECT ... FOR UPDATE pada baris counter tenant tersebut (pola sama
 * getNextLetterNumberAction). Dipanggil TEPAT SEKALI per aktivasi keanggotaan forum, dari
 * dua titik: joinForumAction (jalur gratis) dan activateForumMembershipIfApplicable
 * (jalur pembayaran) — lihat kedua file itu untuk konteks pemanggilan. Nomor keanggotaan
 * lokal forum — opsional, dikonfigurasi admin per tenant forum di
 * /app/{slug}/settings/keanggotaan. Berbeda dari members.member_number (global lintas
 * IKPM): ini penomoran sendiri per forum, counter TIDAK reset per tahun (jalan terus
 * selama umur tenant — dikunci 2026-07-24). Hasil disimpan sebagai STRING JADI di
 * tenant_memberships.membership_number, bukan direkonstruksi ulang dari bagian mentah setiap
 * kali ditampilkan — konsisten dengan pola nomor surat/nomor keuangan di project ini.
 * Lihat docs/arsitektur-backbone-ikpm.md § "Nomor Keanggotaan Lokal Forum".
 */
export async function generateForumMembershipNumber(params: {
  tenantId: string;
  memberId: string;
  format:   ForumMembershipNumberFormat;
  joinDate: Date;
}): Promise<string> {
  const { tenantId, memberId, format, joinDate } = params;

  // Satu lookup ringan (PK) untuk kedua field opsional — birthDate (year_birthdate_seq) dan
  // graduationYear (joinyear_gradyear_seq). Selalu di-fetch terlepas format yang dipilih;
  // query by-PK terlalu murah untuk sepadan branching per-format, dan menghindari perlu
  // tambah kondisi baru setiap kali format baru butuh field member lain.
  let birthDate: string | null = null;
  let graduationYear: number | null = null;
  {
    const [memberRow] = await db
      .select({ birthDate: members.birthDate, graduationYear: members.graduationYear })
      .from(members)
      .where(eq(members.id, memberId))
      .limit(1);
    birthDate      = memberRow?.birthDate ?? null;
    graduationYear = memberRow?.graduationYear ?? null;
  }

  let nextNum = 1;
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(forumMembershipSequences)
      .where(sql`${forumMembershipSequences.tenantId} = ${tenantId} FOR UPDATE`)
      .limit(1);

    if (existing) {
      nextNum = existing.lastNumber + 1;
      await tx
        .update(forumMembershipSequences)
        .set({ lastNumber: nextNum, updatedAt: new Date() })
        .where(eq(forumMembershipSequences.id, existing.id));
    } else {
      await tx
        .insert(forumMembershipSequences)
        .values({ tenantId, lastNumber: 1 });
      nextNum = 1;
    }
  });

  return formatForumMembershipNumber(format, { seq: nextNum, joinDate, birthDate, graduationYear });
}
