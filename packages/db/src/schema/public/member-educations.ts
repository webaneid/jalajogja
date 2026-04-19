import { pgTable, uuid, text, smallint, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { members }   from "./members";
import { pesantren } from "./pesantren";

const EDUCATION_LEVELS = [
  "TK", "SD", "SMP", "SMA", "D3", "S1", "S2", "S3", "Non-Formal",
] as const;

// Kampus PM Gontor: Putra 1-8, Putri 1-6
// Diisi hanya jika isGontor = true
const GONTOR_CAMPUSES = [
  "Gontor 1 (Putra)", "Gontor 2 (Putra)", "Gontor 3 (Putra)",
  "Gontor 4 (Putra)", "Gontor 5 (Putra)", "Gontor 6 (Putra)",
  "Gontor 7 (Putra)", "Gontor 8 (Putra)",
  "Gontor Putri 1", "Gontor Putri 2", "Gontor Putri 3",
  "Gontor Putri 4", "Gontor Putri 5", "Gontor Putri 6",
] as const;

export const memberEducations = pgTable("member_educations", {
  id: uuid("id").primaryKey().defaultRandom(),
  memberId: uuid("member_id").notNull()
    .references(() => members.id, { onDelete: "cascade" }),
  level: text("level", { enum: EDUCATION_LEVELS }).notNull(),
  institutionName: text("institution_name").notNull(),
  major: text("major"),              // Relevan untuk D3 ke atas
  startYear: smallint("start_year"),
  endYear: smallint("end_year"),     // NULL = masih aktif / tidak tahu tahun selesai
  isGontor: boolean("is_gontor").notNull().default(false),
  gontorCampus: text("gontor_campus", { enum: GONTOR_CAMPUSES }), // Isi hanya jika isGontor = true
  pesantrenId:  uuid("pesantren_id")
                  .references(() => pesantren.id, { onDelete: "set null" }), // link ke direktori pesantren
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  memberIdIdx:    index("idx_member_educations_member_id").on(t.memberId),
  isGontorIdx:    index("idx_member_educations_is_gontor").on(t.isGontor),
  pesantrenIdIdx: index("idx_member_educations_pesantren_id").on(t.pesantrenId),
}));

export type MemberEducation = typeof memberEducations.$inferSelect;
export type NewMemberEducation = typeof memberEducations.$inferInsert;
