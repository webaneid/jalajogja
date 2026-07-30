-- Logo usaha — terpisah dari coverUrl (cover/banner 16:9). Logo persegi untuk brand mark.
-- Tabel public schema, sekali jalan (bukan per-tenant loop).
ALTER TABLE public.member_businesses ADD COLUMN IF NOT EXISTS logo_url TEXT;
