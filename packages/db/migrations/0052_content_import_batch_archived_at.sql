-- Rollback via soft bulk-archive (docs/arsitektur-import-export-post-wordpress.md § 14.1) —
-- kolom baru untuk mencatat kapan archiveImportBatchAction terakhir dijalankan terhadap batch
-- ini. Pola sama persis committed_at yang sudah ada di tabel yang sama.
ALTER TABLE public.content_import_batches
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;
