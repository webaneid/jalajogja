-- Audit trail + draft-preview storage untuk fitur Import Anggota
-- (docs/arsitektur-import-anggota.md). Reusable lintas tenant — bukan khusus satu forum.
-- public schema (bukan per-tenant), karena import selalu punya konteks "tenant tujuan"
-- via kolom tenant_id.
--
-- import_batches.status: 'draft' = baru diparse, menunggu review+konfirmasi admin (belum
-- ada tulis ke members/contacts/dst). 'committed' = sudah selesai ditulis ke DB.
--
-- import_batch_rows.status siklus hidup:
--   'ready'          -> siap commit tanpa catatan
--   'review_needed'  -> ada field NOT NULL (category/sector) yang di-default, perlu dicek
--   'duplicate'      -> member+tenant_membership sudah ada, akan di-skip saat commit
--   'error'          -> data fatal (mis. Nama kosong), tidak bisa diinsert sama sekali
--   'inserted'       -> (final, pasca-commit) berhasil ditulis
--   'skipped'        -> (final, pasca-commit) tidak ditulis (duplicate/error/admin skip manual)

CREATE TABLE IF NOT EXISTS public.import_batches (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  file_name           text NOT NULL,
  imported_by_user_id text NOT NULL,
  status              text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'committed')),
  total_rows          integer NOT NULL,
  inserted_rows       integer NOT NULL DEFAULT 0,
  skipped_rows        integer NOT NULL DEFAULT 0,
  review_flag_rows    integer NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.import_batch_rows (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id    uuid NOT NULL REFERENCES public.import_batches(id) ON DELETE CASCADE,
  row_number  integer NOT NULL,
  status      text NOT NULL CHECK (status IN ('ready', 'review_needed', 'duplicate', 'error', 'inserted', 'skipped')),
  member_name text,
  member_id   uuid, -- sengaja TANPA FK — member bisa dihapus, laporan harus tetap utuh
  -- Data lengkap baris (mentah + hasil mapping + catatan) — JSONB bebas bentuk supaya
  -- tidak perlu migrasi kolom baru tiap kali ada jenis catatan baru.
  data        jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_import_batches_tenant_id ON public.import_batches(tenant_id);
CREATE INDEX IF NOT EXISTS idx_import_batch_rows_batch_id ON public.import_batch_rows(batch_id);
