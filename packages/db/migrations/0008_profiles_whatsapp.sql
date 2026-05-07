-- ── public.profiles: tambah kolom whatsapp ────────────────────────────────────
-- Konsisten dengan public.contacts yang sudah pisah phone vs whatsapp sejak awal.
-- phone    = nomor HP biasa (bisa telepon/SMS)
-- whatsapp = nomor WA — nullable, untuk OTP saat gateway aktif

ALTER TABLE "profiles"
  ADD COLUMN IF NOT EXISTS "whatsapp" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_whatsapp_unique'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE "profiles" ADD CONSTRAINT "profiles_whatsapp_unique" UNIQUE ("whatsapp");
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS "idx_profiles_whatsapp" ON "profiles" ("whatsapp");
