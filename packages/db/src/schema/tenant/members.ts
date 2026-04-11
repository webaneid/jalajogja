import {
  pgSchema,
  text,
  uuid,
  timestamp,
  date,
  jsonb,
  boolean,
  primaryKey,
} from "drizzle-orm/pg-core";

export const MEMBER_STATUSES = ["active", "inactive", "alumni"] as const;
export type MemberStatus = typeof MEMBER_STATUSES[number];

export const MEMBER_GENDERS = ["male", "female"] as const;
export type MemberGender = typeof MEMBER_GENDERS[number];

export function createMembersTable(s: ReturnType<typeof pgSchema>) {
  return s.table("members", {
    id: uuid("id").primaryKey().defaultRandom(),
    // Data identitas
    nik: text("nik").unique(), // nullable — tidak semua organisasi wajibkan NIK
    name: text("name").notNull(),
    gender: text("gender", { enum: MEMBER_GENDERS }),
    birthPlace: text("birth_place"),
    birthDate: date("birth_date"),
    // Kontak
    phone: text("phone"),
    email: text("email"),
    address: text("address"),
    photoUrl: text("photo_url"),
    // Status keanggotaan
    memberNumber: text("member_number").unique(), // nomor anggota resmi
    joinedAt: date("joined_at"),
    status: text("status", { enum: MEMBER_STATUSES }).notNull().default("active"),
    // Field tambahan fleksibel per organisasi (angkatan, jabatan, dll)
    customFields: jsonb("custom_fields").default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  });
}

// Kategori/pengelompokan anggota — hierarkis (Pusat → Cabang → Ranting)
export function createMemberCategoriesTable(s: ReturnType<typeof pgSchema>) {
  return s.table("member_categories", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    type: text("type").notNull(), // cabang, divisi, angkatan, dll — bebas per organisasi
    parentId: uuid("parent_id"), // self-referential, FK via SQL migration
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  });
}

// Pivot many-to-many: satu anggota bisa di banyak kategori
export function createMemberCategoryPivotTable(s: ReturnType<typeof pgSchema>) {
  return s.table("member_category_pivot", {
    memberId: uuid("member_id").notNull(),     // FK → members.id via SQL migration
    categoryId: uuid("category_id").notNull(), // FK → member_categories.id via SQL migration
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
  }, (t) => ({
    pk: primaryKey({ columns: [t.memberId, t.categoryId] }),
  }));
}

export type MembersTable = ReturnType<typeof createMembersTable>;
export type MemberCategoriesTable = ReturnType<typeof createMemberCategoriesTable>;
