type Props = {
  label: string;
};

// Capsule kecil warna primary solid + teks putih — dipakai di header shell mobile halaman
// single (post/campaign/produk). Sengaja beda dari pill kategori desktop yang sudah ada
// (bg-primary/10 text-primary, lebih subtle) — mobile memang dirancang tampil lebih tegas.
export function CategoryPill({ label }: Props) {
  return (
    <span className="inline-block px-2.5 py-1 bg-primary text-white rounded-full text-xs font-medium">
      {label}
    </span>
  );
}
