# Lessons Learned

> Format tiap entri: tanggal, masalah, root cause, fix, pencegahan.
> Diekstrak dari log kronologis lama di `CLAUDE.md` (yang sebelumnya menumpuk 16.000+ baris
> tanpa pernah dipangkas) — hanya entri dengan lesson preventif genuinely non-obvious yang
> dipertahankan di sini. Tambahkan entri baru di sini langsung (bukan menumpuk narasi sesi di
> CLAUDE.md lagi), urut dari terbaru ke terlama.

---

## [2026-08-31] Guard "tenant exists" wajib diaudit ke SEMUA titik pemanggilan, bukan cuma yang pernah dilaporkan bug
**Masalah:** Bot/scraper yang probe path acak (`/dist/...`, `/v1/...`) menyebabkan error 500 di catch-all route `[...slug]/page.tsx` (ditemukan dari `pm2 logs` production).
**Root cause:** `resolveSlugKind()` langsung memanggil `createTenantDb()` untuk segmen URL yang ditangkap sebagai `[tenant]` TANPA cek dulu tenant itu genuinely ada — schema yang tidak pernah ada menyebabkan error PostgreSQL "relation does not exist" tembus jadi 500 (tidak ada `error.tsx` boundary di route group `(public)`). Kelas bug ini SUDAH PERNAH difix sebelumnya untuk `generateMetadata` di file lain, tapi fungsi ini kelewat saat itu.
**Fix:** Tambah guard `public.tenants WHERE slug=X AND isActive=true` di awal `resolveSlugKind()`, sebelum `createTenantDb()` dipanggil — pola sama dengan `getPage()`'s `tenant.isActive` check yang sudah ada di file yang sama.
**Pencegahan:** Kalau sebuah kelas bug ("createTenantDb() dipanggil tanpa guard tenant exists dulu") sudah pernah difix di SATU fungsi, jangan asumsikan semua fungsi lain yang juga memanggil `createTenantDb(slug)` dari route publik otomatis aman — audit/grep semua titik pemanggilan serupa (terutama entry point route publik/catch-all baru) untuk pastikan guard yang sama diterapkan konsisten.

---

## [2026-08-26] 3 kesalahan operasional saat setup enkripsi PII + backup production pertama kali
**Masalah:** Setup pertama enkripsi NIK (`MEMBER_PII_ENCRYPTION_KEY`) + backup otomatis Postgres+MinIO ke Google Drive di VPS production.
**Root cause:** (1) Key enkripsi sempat digenerate di mesin lokal lalu ditransfer manual — risiko bocor di transit/riwayat shell lokal. (2) Package `mc` (MinIO Client) collision nama dengan Midnight Commander di `apt` Ubuntu. (3) Default `BACKUP_DIR="/var/backups/jalajogja"` butuh akses root — VPS jalan sebagai user non-root.
**Fix:** Generate key langsung di VPS target (bukan transfer). Install `mc` via download binary langsung dari `dl.min.io`, bukan `apt install mc`. Override `BACKUP_DIR` eksplisit ke path di home directory user non-root di titik pemanggilan (cron entry).
**Pencegahan:** Untuk setup keamanan/backup produksi ke depan — generate secret produksi selalu di mesin target; cek collision nama paket sebelum `apt install` alat CLI yang namanya umum/pendek; jangan asumsikan default path script aman untuk user non-root, override eksplisit di titik pemanggilan.

---

## [2026-08-25] Prosedur wajib sebelum git filter-repo/rewrite history di repo dengan worktree lain
**Masalah:** Perlu membersihkan file `.sql` historis yang ter-track git tanpa perlu, lalu diminta membersihkan riwayat Git sepenuhnya (rewrite history + force-push) karena `.gitignore` saja tidak menghapus blob lama dari histori.
**Root cause / temuan:** `.gitignore` + `git rm --cached` hanya membersihkan working directory pada `git pull` berikutnya — TIDAK mengecilkan `.git` history yang sudah ada. Rewrite history (`git filter-repo`) + force-push adalah kelas operasi berbeda, jauh lebih berisiko (irreversible di sisi origin), dan worktree lain berbagi `.git` yang sama — commit yang di-rewrite bisa jadi ancestor dari branch yang sedang aktif dipakai worktree lain.
**Fix:** Urutan aman: (1) `git ls-files <folder>` dulu sebelum `.gitignore` folder yang diduga cuma referensi lokal — kalau hasilnya tidak kosong, wajib `git rm -r --cached` juga. (2) `git worktree list` dulu sebelum rewrite history apa pun. (3) Cek `git ls-remote --heads origin` — kalau branch belum pernah di-push, rewrite dilakukan di CLONE TERPISAH (bukan in-place), verifikasi hasil, force-push dari clone itu, lalu sinkron balik lokal via `git fetch && git reset --hard origin/main`.
**Pencegahan:** Ikuti urutan di atas untuk operasi serupa ke depan — jangan filter-repo in-place di repo yang dipakai worktree lain, selalu verifikasi origin state sebelum menilai risiko force-push.

---

## [2026-08-15] Metodologi diagnosa "sudah dijurnal" tidak boleh pakai `payments.transactionId` sebagai proxy
**Masalah:** Audit klasifikasi keuangan Toko/Tiket/Donasi menemukan tenant `visikita` punya 92 entri salah rute yang lolos dari audit sebelumnya.
**Root cause:** `payments.transactionId` bukan proxy yang andal untuk "sudah dijurnal" — audit sebelumnya salah percaya kolom ini.
**Fix:** Metodologi diagnosa yang benar adalah match `transactions.description` langsung, bukan `transactionId`.
**Pencegahan:** Untuk audit finansial yang mengandalkan "apakah X sudah diproses Y", jangan percaya kolom yang SEPERTINYA merepresentasikan link itu tanpa verifikasi — cross-check ke data yang benar-benar deterministik.

---

## [2026-08-15] SSH command panjang bisa corrupt karena line-wrap terminal
**Masalah:** Deploy migration batch 15 ke VPS + koreksi data historis production sempat menemukan command SSH yang corrupt.
**Root cause:** Command SSH yang terlalu panjang di-wrap oleh terminal, menyebabkan korupsi saat dieksekusi remote.
**Fix:** Pendekkan command via shell variable, bukan satu baris panjang.
**Pencegahan:** Untuk operasi SSH remote dengan command kompleks/panjang, gunakan shell variable atau script file, bukan satu baris command yang bisa ter-wrap.

---

## [2026-08-14] Daftar kurir eksternal tidak boleh dipercaya dari dokumentasi resmi provider — pakai mekanisme validasi API
**Masalah:** Checkbox setting kurir RajaOngkir hanya menyediakan 10 dari 16 kurir yang genuinely valid untuk akun tenant ini.
**Root cause:** Dokumentasi resmi RajaOngkir soal daftar kurir valid ternyata kontradiktif/tidak lengkap untuk tier akun yang dipakai.
**Fix:** Submit kode kurir yang sengaja salah bersama kandidat lain — respons 422 API RajaOngkir sendiri berisi daftar kode valid. Daftar lengkap 16 kurir sekarang di `docs/arsitektur-addon-ongkir.md`.
**Pencegahan:** Untuk pertanyaan "apakah daftar kita lengkap sesuai penyedia eksternal X" (terutama kalau tergantung tier akun/versi API), jangan percaya dokumentasi pihak ketiga begitu saja — kalau API punya mekanisme validasi (submit kode salah → error berisi daftar valid), itu sumber kebenaran paling otoritatif.

---

## [2026-08-11] Grid Tailwind tanpa `grid-cols` di base breakpoint overflow di mobile
**Masalah:** Beberapa halaman (checkout, agenda event, form admin, dsb) terasa "menjorok ke kiri frame" di viewport mobile.
**Root cause:** `display:grid` tanpa `grid-template-columns` eksplisit di breakpoint aktif (mis. `grid lg:grid-cols-[1fr_360px]` tanpa `grid-cols-*` di base) jatuh ke `grid-auto-columns:auto` bawaan browser — track `auto` menghormati min-content size tiap grid item, jadi konten yang tidak bisa menyusut (teks panjang, `<table>`, elemen fixed-width) memaksa grid track (sering seluruh halaman) lebih lebar dari viewport.
**Fix:** Tambah base `grid-cols-1` eksplisit ke kontainer (`grid grid-cols-1 lg:grid-cols-2`, bukan `grid lg:grid-cols-2` polos). Untuk grid dengan `grid-template-columns` arbitrary asimetris yang sebagian child sudah benar, tambah `min-w-0` langsung di child yang terlewat.
**Pencegahan:** Setiap kali menulis className grid baru dengan `grid-cols-*` yang hanya aktif di breakpoint tertentu, WAJIB sertakan base `grid-cols-1` (atau count sesuai intent mobile). Audit cepat: grep className yang mengandung `(sm|md|lg|xl):grid-cols-` lalu cek apakah ADA `grid-cols-*` tanpa prefix breakpoint di string yang sama. False positive yang harus dikenali: grid yang `display`-nya `flex`/`hidden` di base dan baru jadi `grid` persis di breakpoint yang sama dengan `grid-cols`-nya (pola carousel horizontal-scroll) bukan bug.

---

## [2026-08-05] Field top-level yang jadi sumber unconditional bagi fitur lain tidak boleh disembunyikan per sub-tipe tanpa audit consumer
**Masalah:** Produk tipe "Variasi" (belum pernah disimpan) sama sekali tidak punya cara upload gambar — section "Gambar Produk" disembunyikan total untuk `productType==="variable"`.
**Root cause:** `products.images` (kolom top-level) dipakai sebagai SATU-SATUNYA sumber cover storefront untuk KEDUA tipe produk (`extractCover()`), tapi form editornya menyembunyikan cara mengisi field itu untuk tipe "variable" — produk variasi jadi selamanya tidak bisa punya foto sampul di arsip toko.
**Fix:** Hapus gate `productType==="simple"` pada `<ProductImages>` — field ini sekarang selalu tampil terlepas tipe produk, dengan label diperjelas membedakan dari foto per-varian.
**Pencegahan:** Kalau sebuah field top-level dipakai sebagai sumber oleh fitur lain secara unconditional (tidak peduli sub-tipe), form editornya tidak boleh menyembunyikan field itu untuk sub-tipe manapun tanpa lebih dulu cross-check semua consumer field itu — jangan asumsikan "field ini kan konsepnya untuk tipe X" tanpa verifikasi konsumen aktual.

---

## [2026-08-05] Grep-count string di HTML hasil curl Next.js App Router bisa salah 2-8x lipat
**Masalah:** Verifikasi jumlah elemen kartu (overlay/klasik/list) di halaman arsip post lewat hitung string `curl` HTML sempat menyesatkan — jumlah "list" yang dihitung salah (31 vs seharusnya 26).
**Root cause:** Response Next.js App Router menyisipkan RSC flight-payload di dalam tag `<script>` yang mendupliksi banyak string literal prop mentah (termasuk className) — grep/count string polos pada raw HTML bisa menghasilkan angka 2-8x lipat dari jumlah elemen DOM sesungguhnya.
**Fix:** Buang blok `<script>...</script>` dulu (`re.sub`) sebelum menghitung/mem-parsing HTML hasil curl Next.js App Router.
**Pencegahan:** Setiap kali meng-grep-hitung string di HTML hasil `curl` ke aplikasi Next.js App Router untuk verifikasi (jumlah elemen, className tertentu, dsb), wajib buang `<script>` RSC flight-payload dulu — jangan percaya count mentah pada raw response.

---

## [2026-08-04] Nilai bergantung waktu-sekarang yang dihitung langsung saat render berisiko hydration mismatch
**Masalah:** React error #418 (hydration text mismatch) di halaman invoice publik meski VPS sudah pakai fix ICU/CLDR sebelumnya.
**Root cause:** `NewsHeader`'s `formatGregorianDate()` memanggil `new Date()` langsung saat render (bukan di effect) — SSR dan hydration client adalah dua momen waktu berbeda, berisiko mismatch teks kalau keduanya melewati batas tengah malam WIB.
**Fix:** Nilai tanggal yang bergantung waktu-sekarang diubah dari dihitung langsung saat render menjadi `useState(null)` diisi via `useEffect` post-mount — render pertama SSR dan client sama-sama kosong, nol kemungkinan mismatch.
**Pencegahan:** Untuk nilai yang bergantung waktu-sekarang atau API browser (`new Date()` tanpa anchor eksplisit) yang dipakai langsung saat render komponen (bukan lewat prop dari server), jangan hitung langsung saat render pertama — selalu defer ke `useEffect`.

---

## [2026-08-03] Custom combobox tidak boleh panggil onChange ke parent di setiap keystroke
**Masalah:** Tombol wizard "Simpan & Lanjutkan" di `/akun/lengkapi` sering tidak bisa diklik meski semua field (termasuk Profesi/Tempat Lahir via combobox) sudah terisi.
**Root cause:** `ProfessionCombobox` dan `RegencyCombobox` memanggil `onChange` ke parent di SETIAP keystroke (bukan hanya saat user benar-benar memilih item) — begitu user klik ulang field yang sudah terisi lalu mengetik apa pun, value di parent langsung di-null-kan sebelum ada pilihan baru, tanpa mekanisme pemulihan kalau user klik keluar tanpa memilih ulang.
**Fix:** Decouple "pilihan tersimpan" dari "draft sedang diketik" via flag `isEditing` lokal — `onChange` ke parent HANYA dipanggil saat user benar-benar memilih item dari dropdown atau klik tombol clear eksplisit.
**Pencegahan:** Untuk semua custom search/combobox yang punya konsep "sudah dipilih sebelumnya", jangan panggil `onChange`/callback ke parent di handler `onChange` input (tiap keystroke) — hanya panggil saat ada aksi eksplisit (pilih item / klik clear). (Perluasan dari lesson "blur vs click race condition".)

---

## [2026-08-03] Toggle admin yang menggate seluruh fitur bisa terlihat seperti "data hilang"
**Masalah:** Peserta event hasil invoice manual admin dilaporkan "hilang" dari tab Peserta di halaman admin maupun publik, meski data di database benar dan sudah klik "Sinkronkan Peserta Event" berkali-kali.
**Root cause:** Toggle admin "Tampilkan daftar peserta" (`showAttendeeList`) default `false` untuk event baru — kalau `false`, tab "Peserta" (dan query datanya) tidak dirender sama sekali, bukan cuma datanya kosong.
**Fix:** Tidak perlu perbaikan kode — solusinya nyalakan toggle di halaman edit event.
**Pencegahan:** Kalau sebuah fitur dilaporkan "kosong padahal data ada", jangan langsung asumsikan bug caching/query — cek dulu apakah ada TOGGLE ADMIN yang menggate seluruh fitur itu (grep nama komponen, cek default value untuk record baru) sebelum menelusuri cache/revalidate/query. Verifikasi klaim "sudah difix" pihak lain selalu terhadap bukti konkret (query SQL langsung/curl bypass-cache), bukan argumen semata.

---

## [2026-07-31] Instruksi ambigu soal "syarat vs gerbang" untuk data sequence historis — default ke interpretasi yang tidak mengarang nilai
**Masalah:** Instruksi user "member baru harus aktif dgn parameter memiliki nomor id sesuai standard..." awalnya ditafsirkan sebagai "generate nomor kalau kosong" — implementasi sempat di-commit dengan interpretasi ini, padahal untuk data historis (sequence pendaftaran riil) ini mengarang nilai yang tidak mencerminkan kapan orang itu sungguh-sungguh bergabung.
**Root cause:** Kalimat ambigu antara dua makna berlawanan: (a) "nomor ID adalah syarat yang harus dipenuhi (isi/generate kalau kosong)" vs (b) "nomor ID adalah gerbang yang harus SUDAH terpenuhi sebelumnya (jangan generate, tetap pending kalau kosong)".
**Fix:** Revert total — import/admin-add tidak pernah generate nomor keanggotaan; status "active" hanya kalau baris SUDAH punya nomor (dari Excel/DB), selain itu tetap "pending". Auto-generate hanya sah dipanggil dari alur join real-time (`/gabung`) di mana "urutan berikutnya" memang benar secara harfiah.
**Pencegahan:** Kalau instruksi user berisi frasa ambigu antara "syarat yang harus dipenuhi (isi kalau kosong)" vs "gerbang yang harus sudah terpenuhi (jangan isi, tolak/tunda)" — terutama untuk data terkait URUTAN/SEQUENCE historis — jangan langsung pilih interpretasi paling proaktif (generate/isi otomatis). Interpretasi yang mempertahankan integritas data historis lebih aman sebagai default; kalau ragu, tanya eksplisit dulu sebelum menulis+commit.

<!-- Entri chunk lain (1-5, 8) ditambahkan menyusul setelah proses klasifikasi selesai -->
