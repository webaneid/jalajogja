-- ── Modul Akun: public.profiles ────────────────────────────────────────────────
-- Identitas universal untuk siapapun yang bertransaksi di ekosistem jalajogja.
-- Bukan hanya alumni IKPM — pembeli umum, donatur, peserta event punya satu ID
-- yang berlaku lintas semua tenant.
--
-- Tidak menggantikan public.members. Melengkapinya:
--   public.members  = identitas IKPM (stambuk, member_number, NIK) — admin-controlled
--   public.profiles = identitas publik (email, HP WA) — self-service
--
-- account_type: 'akun' (default) | 'member' (setelah admin link ke public.members)
-- deleted_at:   soft delete — FK dari tabel transaksi tetap valid setelah akun dihapus

CREATE TABLE IF NOT EXISTS "profiles" (
  "id"                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  "name"                  TEXT        NOT NULL,
  "email"                 TEXT        NOT NULL,
  "phone"                 TEXT        NOT NULL,
  "account_type"          TEXT        NOT NULL DEFAULT 'akun'
                                      CHECK (account_type IN ('akun', 'member')),

  "address_detail"        TEXT,
  "province_id"           TEXT,
  "regency_id"            TEXT,
  "district_id"           TEXT,
  "village_id"            TEXT,
  "country"               TEXT        DEFAULT 'Indonesia',

  "member_id"             UUID        UNIQUE REFERENCES public.members(id) ON DELETE SET NULL,
  "better_auth_user_id"   TEXT        UNIQUE REFERENCES public.user(id) ON DELETE SET NULL,
  "registered_at_tenant"  UUID        REFERENCES public.tenants(id) ON DELETE SET NULL,

  "created_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deleted_at"            TIMESTAMPTZ
);
--> statement-breakpoint

ALTER TABLE "profiles" ADD CONSTRAINT "profiles_email_unique" UNIQUE("email");
--> statement-breakpoint

ALTER TABLE "profiles" ADD CONSTRAINT "profiles_phone_unique" UNIQUE("phone");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_profiles_email"               ON "profiles"("email");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_profiles_phone"               ON "profiles"("phone");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_profiles_member_id"           ON "profiles"("member_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_profiles_better_auth_user_id" ON "profiles"("better_auth_user_id");
