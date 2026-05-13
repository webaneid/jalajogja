-- Migration 0012: Tambah add-on RajaOngkir ke catalog

INSERT INTO public.addons (slug, name, description, category, is_free, price_monthly, price_yearly, quota_monthly, status) VALUES
  (
    'rajaongkir',
    'Ongkos Kirim (RajaOngkir)',
    'Kalkulasi ongkos kirim otomatis via RajaOngkir. Support JNE, TIKI, POS, SiCepat, dan 30+ kurir. Wajib untuk toko dengan produk mitra dropship.',
    'logistics', false, 29000, 280000, NULL, 'active'
  )
ON CONFLICT (slug) DO NOTHING;
