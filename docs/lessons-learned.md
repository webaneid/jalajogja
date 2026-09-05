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

## [2026-07-17] Kata "desain 1" / "nanti kita bikin X lain" selalu sinyal untuk bikin registry, bukan hardcode tunggal
**Masalah:** User minta "design lain di card setting bisa dihapus saja" + "grid ketika desktop, list ketika mobile" — dibaca sebagai "hapus SELURUH setting, hardcode langsung di kode", padahal maksudnya menghapus SEBAGIAN pilihan sambil tetap mempertahankan setting-nya (direstruktur jadi "Desain 1", "Desain 2", dst).
**Root cause:** Frasa "desain 1 ... nanti kita mau bikin desain lain" secara eksplisit mengimplikasikan akan ada Desain 2/3 (butuh registry, bukan nilai tunggal), dan kata "setiap" di "tapi setiap desain grid sifatnya begini" adalah kuantor untuk SEMUA desain masa depan.
**Fix:** Restrukturisasi jadi registry bernomor (list of IDs + dispatcher), pola yang sudah dipakai di Header/Footer/Hero/Strip Modul.
**Pencegahan:** Kalau instruksi user menyebut "desain 1", "nanti kita bikin X lain", atau pola serupa yang mengimplikasikan "ini yang pertama dari beberapa" — itu selalu sinyal registry bernomor, bukan hardcode tunggal. Kalau ragu antara "hapus fitur total" vs "restrukturisasi", tanya ulang eksplisit sebelum menghapus kode — terutama kalau fitur itu baru saja selesai dibangun di sesi yang sama.

---

## [2026-07-16] Anotasi tipe eksplisit yang lebih lebar dari literal object menghilangkan exhaustiveness checking switch
**Masalah:** `switch(id)` di resolver TypeScript tidak bisa membuktikan exhaustive, menghasilkan error "Function lacks ending return statement" meski semua case sudah ditulis.
**Root cause:** Deklarasi `FUNFACT_CATALOG: Record<string, {label: string}>` (anotasi tipe eksplisit) membuat `keyof` dari tipe itu jadi `string` polos, bukan union literal key spesifik.
**Fix:** Hapus anotasi tipe eksplisit, pakai `as const` — biarkan TypeScript infer literal union type dari object literal.
**Pencegahan:** Kalau butuh `keyof typeof X` menghasilkan union literal untuk exhaustiveness checking di switch, jangan kasih anotasi tipe eksplisit yang lebih lebar (`Record<string,...>`) — biarkan inferensi TypeScript jalan natural, pakai `as const` kalau perlu memaksa literal types.

---

## [2026-07-16] "Tidak return" di middleware tidak menjamin fall-through ke kode yang dimaksud
**Masalah:** Implementasi menulis "kalau kondisi X true, jangan return, biarkan jatuh ke guard di bagian bawah fungsi" — asumsi salah karena ada blok kode lain di antaranya, menghasilkan 404 di semua link terkait.
**Root cause:** Antara titik itu dan guard yang dimaksud, masih ada blok kode lain dalam kondisional pembungkus yang sama — tanpa `return` eksplisit, eksekusi jatuh ke blok yang salah.
**Fix:** `return` eksplisit dengan response yang sesuai, guard yang dibutuhkan diduplikasi langsung di cabang itu.
**Pencegahan:** Dalam fungsi middleware/handler panjang dengan banyak `if` bersarang, jangan pernah mengandalkan "tidak return = otomatis lanjut ke kode yang saya maksud" — trace ulang eksplisit kode di antara titik saat ini dan titik tujuan. Kalau tujuannya lewati semua kode lain di blok ini, satu-satunya cara benar adalah `return` eksplisit.

---

## [2026-07-16] Date object di raw `sql` template lolos tsc+build, crash cuma saat runtime
**Masalah:** `sql\`... >= ${startOfMonth}\`` crash di driver `postgres.js` saat binding parameter, meski `tsc --noEmit` dan `next build` lolos sepenuhnya.
**Root cause:** TypeScript tidak tahu isi raw `sql` template adalah SQL yang dikirim ke driver — error hanya muncul saat query benar-benar dieksekusi. (Bug kedua di sesi sama: `bun add --filter=@jalajogja/web recharts` salah menaruh dependency di ROOT package.json, lolos build lokal karena hoisting, gagal di VPS.)
**Fix:** `${startOfMonth.toISOString()}` — string, bukan Date, di raw `sql` template. Dependency dipindah ke `apps/web/package.json`.
**Pencegahan:** `gte()`/`lte()` (typed drizzle API) aman menerima `Date` mentah, tapi begitu Date diselipkan ke raw `sql\`...\`` template, wajib `.toISOString()` dulu. Verifikasi lokasi dependency setelah `bun add --filter=`, jangan asumsikan otomatis benar di workspace yang tepat.

---

## [2026-07-15] Audit bug sibling file wajib dilakukan segera setelah fix pertama, bukan menunggu laporan terpisah
**Masalah:** Halaman `/akun/mitra/produk*` dikira "belum digarap" — ternyata sudah diimplementasi tapi crash 500 di 3 file karena bug header-forwarding yang persis sama dengan yang sudah difix sebelumnya di file tetangganya.
**Root cause:** 3 file meneruskan seluruh incoming `Headers` (termasuk header hop-by-hop terlarang) ke internal fetch — bug yang sudah pernah ditemukan+difix di file lain tapi tidak ikut disebar ke file serupa.
**Fix:** Ganti ke `{ headers: { cookie: hdrs.get("cookie") ?? "" } }` di semua file yang terkena.
**Pencegahan:** Kalau sebuah fitur punya beberapa halaman/route serupa (sibling files), fix bug di satu file wajib dicek juga di file lain berpola identik — grep pola bug ke seluruh folder terkait begitu satu instance ditemukan, jangan tunggu laporan terpisah per file.

---

## [2026-07-15] Helper yang mengklaim mencegah bug custom-domain sendiri tidak pernah mengecek status custom domain
**Masalah:** Link invoice via WA selalu `jalakarta.com/{slug}/...`, padahal tenant sudah punya custom domain aktif.
**Root cause:** `waAppUrl(slug, path)` punya komentar eksplisit "jangan hardcode custom domain", tapi implementasinya pure synchronous function yang tidak pernah query status custom domain — komentar peringatan tanpa implementasi aktual.
**Fix:** Ubah jadi `async`, query `public.tenants` untuk `customDomain`+`customDomainStatus`, fallback + try/catch supaya notifikasi tidak pernah gagal terkirim gara-gara lookup error.
**Pencegahan:** Setiap helper yang membangun URL publik tenant wajib benar-benar mengimplementasikan pengecekan yang diklaim komentarnya — komentar peringatan tanpa implementasi adalah tanda bahaya. Audit helper URL builder lain yang mungkin kena kelas bug sama.

---

## [2026-07-15] Guard status harus diulang setelah lock, client harus refresh setelah mutasi — pola berulang ke-4
**Masalah:** Customer bisa submit bukti pembayaran dua kali untuk invoice yang sama, admin melihat dua bukti transfer padahal transfer sekali.
**Root cause:** Server — `submitPaymentProofAction` insert tanpa cek status `waiting_verification` dan tanpa lock; client — halaman invoice publik tidak pernah `router.refresh()` setelah submit sukses, tombol tetap terlihat bisa diklik.
**Fix:** Transaction + `SELECT ... FOR UPDATE` + guard status diulang setelah lock; tambah `router.refresh()` di branch sukses.
**Pencegahan:** Pola ke-4 di project ini (payment confirm, cart checkout, event registration, payment proof) — setiap aksi customer-facing yang bisa dipicu ulang dan punya efek permanen wajib dua lapis: server (transaction + lock + guard diulang) dan client (`router.refresh()` setelah mutasi sukses).

---

## [2026-07-14] `href="../"` mengikuti matematika RFC 3986, bukan intuisi "naik satu level"
**Masalah:** Tombol "Kembali ke Dashboard" di beberapa halaman `/akun/*` mengarah ke homepage tenant, bukan halaman induk yang dimaksud.
**Root cause:** "Direktori" dari sebuah URL adalah semua segmen KECUALI yang terakhir, lalu `../` naik satu level lagi dari direktori itu — akibatnya `../` dari path 2-segmen selalu mendarat di root domain.
**Fix:** Ganti semua `href="../"` dengan path eksplisit (`${baseUrl}/akun`, dst).
**Pencegahan:** Jangan pernah pakai `href="../"` atau `href="./"` untuk tombol navigasi "kembali" — matematikanya gampang salah dan sulit di-review sekilas. Selalu bangun path eksplisit dari `baseUrl` + path absolut.

---

## [2026-07-14] Guard "sudah ada sebelumnya" harus diulang di dalam transaction setelah lock, bukan cuma sebelum
**Masalah:** `registerForEventAction` sudah punya guard "sudah terdaftar", tapi dicek SEBELUM transaction lock diperoleh — dua request nyaris bersamaan lolos, menghasilkan 2 registrasi (dan 2 invoice untuk tiket berbayar).
**Root cause:** SELECT guard di luar transaction hanya early-exit UX, bukan jaminan korektnes — request konkuren bisa sama-sama lolos sebelum salah satu insert selesai.
**Fix:** Ulangi cek yang sama di dalam transaction, tepat setelah lock `FOR UPDATE` diperoleh.
**Pencegahan:** Pola berulang 3x di project ini (payment confirm, cart checkout, event registration) — setiap aksi yang insert row unik-per-identitas dan punya guard "sudah ada" wajib mengulang guard itu di dalam transaction setelah lock diperoleh.

---

## [2026-07-14] Dua invoice mirip belum tentu race condition — cek selisih waktu dulu
**Masalah:** 2 invoice terbentuk untuk pelanggan+tiket event yang sama, WA notifikasi ikut terkirim 2x.
**Root cause:** Dua kelas bug berbeda: race condition tanpa lock (klik ganda/retry, `await` banyak antara SELECT cart dan DELETE cart) DAN re-attempt user yang genuinely checkout ulang berjarak 16 menit dengan cart session baru (bukan race condition).
**Fix:** Transaction + `SELECT ... FOR UPDATE` mengunci baris cart, plus cek DI DALAM transaction apakah sudah ada invoice pending untuk tiket yang sama dengan identity yang cocok (memberId/profileId/phone/email) sebelum buat invoice baru.
**Pencegahan:** Jangan asumsikan "2 invoice mirip" = race condition — selalu cek `created_at` kedua record. Selisih milidetik/detik → race condition (butuh lock). Selisih menit/jam → kemungkinan besar re-attempt user (butuh deteksi duplikat berbasis identity, bukan locking). Dua kelas bug ini butuh fix berbeda.

---

## [2026-07-13] Field yang ada di form self-service tidak otomatis ikut ditambahkan ke form admin
**Masalah:** Form admin `members/new` dan `members/[id]/edit` tidak punya field PC IKPM sama sekali — hanya bisa diisi lewat self-service `/akun/lengkapi`, jadi selamanya kosong kalau admin yang input.
**Root cause:** Dua form (`step1-identity.tsx` untuk admin, `akun/lengkapi/page.tsx` untuk self-service) punya struktur field mirip tapi dikembangkan terpisah, tidak saling sinkron otomatis.
**Fix:** Tambahkan field yang sama ke form admin + prop data referensi yang dibutuhkan.
**Pencegahan:** Kalau sebuah field ada di self-service dan juga masuk akal diisi admin, wajib cek apakah form admin punya field yang sama — dua form ini mudah drift karena dikembangkan terpisah. Audit ini harus jadi langkah rutin tiap kali menambah field baru ke salah satu form.

---

## [2026-07-13] Tombol submit yang disabled tanpa indikator visual terlihat seperti bug
**Masalah:** Dilaporkan sebagai "tombol tidak muncul" — sebenarnya tombol selalu dirender tapi disabled (opacity rendah) kalau field wajib kosong, dan 4 dari 6 field wajib tidak punya tanda asterisk merah.
**Root cause:** User tidak tahu field mana yang wajib karena tidak ada indikator visual, tombol tetap redup tanpa penjelasan.
**Fix:** Tambah prop `required` pada helper field lokal untuk render asterisk merah.
**Pencegahan:** Di semua form aplikasi — kalau sebuah field diperiksa di kondisi `disabled={... || !field}` pada tombol submit, field itu wajib punya indikator visual (asterisk merah) di labelnya.

---

## [2026-07-12] Field Tiptap JSON jangan pernah di-slice mentah untuk keperluan di luar renderer resmi
**Masalah:** `generateMetadata` halaman event publik men-`slice()` field Tiptap JSON langsung — meta description dan `og:description` jadi string JSON mentah di search engine/social share.
**Root cause:** Kolom `description` berisi Tiptap JSON, bukan plain text — pola bug sama persis dengan lesson lama soal `renderBody`, kali ini muncul di jalur SEO.
**Fix:** `tiptapToPlainText()` — ekstraksi plain text rekursif dari Tiptap JSON, dipakai sebagai fallback description hanya kalau field SEO khusus (`metaDesc`) kosong.
**Pencegahan:** Field yang diisi lewat Tiptap editor jangan pernah di-`slice()` atau dipakai mentah untuk keperluan apa pun di luar Tiptap renderer resminya — termasuk SEO, notifikasi, preview, meta tag. Kalau menambah halaman single baru, cek dulu apakah `generateMetadata` sudah pakai field SEO khusus.

---

## [2026-07] Better Auth CSRF menolak origin custom domain baru dengan pesan error menyesatkan
**Masalah:** Login berhasil di domain sendiri dan 1 custom domain lama, tapi gagal di custom domain baru dengan pesan "Email atau password salah" meski kredensial benar.
**Root cause:** Better Auth mencocokkan `Origin` request terhadap `baseURL` env dan `BETTER_AUTH_TRUSTED_ORIGINS` — domain baru yang belum terdaftar di keduanya ditolak sebagai CSRF, tapi client hanya expose pesan generik.
**Fix:** Intercept POST di route handler Better Auth — cek apakah `Origin` adalah custom domain aktif di DB, kalau ya spoof header `origin`/`referer` ke `BETTER_AUTH_URL` sebelum diteruskan ke handler asli (aman karena cookie sesi ditentukan dari header `Host`, bukan `Origin`).
**Pencegahan:** Kalau ada auth library dengan origin-check berbasis whitelist statis sementara aplikasi harus mendukung custom domain dinamis, jangan andalkan menambah whitelist manual per domain — intercept & normalisasi origin di server, verifikasi terhadap status "custom domain aktif" di DB.

---

## [2026-07] Chicken-and-egg: tenant baru butuh setup dari konteks yang lebih tinggi, bukan dari dalam dirinya sendiri
**Masalah:** Tenant baru dibuat platform admin tidak punya siapa pun yang bisa login ke dashboardnya — untuk masuk butuh record di `tenant.users`, tapi untuk membuat record itu harus sudah bisa masuk dulu.
**Root cause:** Alur buat-tenant hanya insert schema + `public.tenants`, tidak membuat user apa pun.
**Fix:** `createFirstOwnerAction` yang berjalan dari konteks PLATFORM ADMIN — insert langsung ke 3 tabel sekaligus (Better Auth user, `public.members`, `tenant_{slug}.users` role=owner) dalam satu alur atomic dengan rollback.
**Pencegahan:** Untuk fitur baru dengan konsep "setup pertama kali butuh sesuatu yang belum ada", jangan serahkan setup itu ke konteks yang justru butuh setup itu selesai dulu — beri jalur setup dari konteks yang lebih tinggi/sudah punya akses.

---

## [2026-07] `router.push()` setelah login/logout bisa menyajikan redirect/cache basi di aplikasi multi-domain
**Masalah:** Setelah login admin platform, `router.push("/platform/dashboard")` bisa kena `next.config.ts redirects()` yang cocok tidak sengaja, atau menyajikan cached response basi.
**Root cause:** `router.push()` adalah client-side navigation yang tidak selalu memicu evaluasi ulang server-side (redirects, cache) yang seharusnya jalan dari nol setelah operasi yang mengubah sesi.
**Fix:** Pakai `window.location.href = dest` (bukan `router.push`) setelah operasi yang membuat atau menghancurkan sesi.
**Pencegahan:** Setelah login atau logout di semua permukaan (platform admin, tenant admin, front-end publik), navigasi wajib pakai `window.location.href`, tidak pernah `router.push()`.

---

## [2026-07] Regex lookahead exclude-slug pakai `$` gagal kalau path punya segmen setelahnya
**Masalah:** `platform.jalakarta.com/platform/login` ter-redirect salah ke `/app/platform/dashboard` — "platform" dianggap slug tenant valid padahal seharusnya dikecualikan.
**Root cause:** `next.config.ts` pakai `TENANT_SLUG = "(?!platform$)..."` — path-to-regexp menguji pattern ini terhadap string path PENUH (`"platform/dashboard"`), bukan per-segmen, jadi `platform$` hanya cocok kalau "platform" adalah akhir string total.
**Fix:** Ganti semua term lookahead dari `nama$` menjadi `nama(?:/|$)` — cocok baik di batas segmen maupun akhir string.
**Pencegahan:** Setiap kali menulis lookahead regex untuk mengecualikan satu SEGMEN dari path multi-level, jangan pakai `$` polos — `$` hanya cocok di akhir string total, bukan akhir segmen.

---

## [2026-07] Register flow tidak atomic menyisakan orphan Better Auth account kalau insert app-level gagal
**Masalah:** `POST /api/akun/register` (dan variannya) memanggil `auth.api.signUpEmail()` lalu baru insert ke `profiles`/`members`/`contacts` — kalau operasi setelahnya gagal, akun sudah terbentuk di Better Auth tapi tidak ada padanannya di tabel aplikasi. User bisa login tapi identity lookup return null, redirect loop tanpa jalan keluar.
**Root cause:** Tidak ada rollback antara `signUpEmail()` sukses dan insert app-level yang mengikutinya.
**Fix:** `cleanupAuthUser(authUserId)` — hapus `public."user"` kalau app-level insert gagal, dibungkus try/catch di sekitar setiap insert app-level setelah `signUpEmail`.
**Pencegahan:** Setiap alur yang memanggil `auth.api.signUpEmail()` wajib membungkus operasi DB app-level sesudahnya dengan try/catch + rollback (`cleanupAuthUser`).

---

## [2026-07] Cookie signing double-encode kalau `encodeURIComponent` manual dipakai di atas `response.cookies.set()`
**Masalah:** `signCookieValue` di endpoint login-via-OTP custom membangun `${value}.${signature}` dengan `encodeURIComponent` manual, lalu menulis lewat `response.cookies.set()` — verifikasi signature selalu gagal.
**Root cause:** `response.cookies.set()` (Next.js / @edge-runtime/cookies) SELALU memanggil `encodeURIComponent` sendiri sebelum menulis header Set-Cookie — pre-encode manual di atasnya menghasilkan double-encode (`+` → `%2B` → `%252B`), signature memanjang, `verifySignature` selalu return null.
**Fix:** Jangan pre-encode nilai sebelum diserahkan ke `.cookies.set()`.
**Pencegahan:** `encodeURIComponent` manual hanya sah dipakai kalau menulis cookie lewat `headers.append("set-cookie", ...)` RAW. Kalau menulis lewat `.cookies.set()`, jangan pernah pre-encode — API itu sudah encode otomatis.

<!-- Entri chunk lain (1, 3, 4, 5, 8) ditambahkan menyusul setelah proses klasifikasi selesai -->
