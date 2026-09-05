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

## [2026-07-31] Auto-link identitas berdasarkan kecocokan email tanpa verifikasi adalah celah identity-takeover
**Masalah:** Kode dari agen lain di `lib/akun-identity.ts` menambahkan blok "auto-link" yang mencocokkan email session user terhadap `contacts.email` member manapun yang belum diklaim, lalu diam-diam menulis `betterAuthUserId = userId` tanpa verifikasi email apa pun.
**Root cause:** Better Auth di project ini tidak punya email verification aktif, dan endpoint register publik tidak cek `members`/`contacts.email` sebelum mendaftarkan — siapa pun bisa daftar akun dengan email siapa saja (tanpa dibuktikan kepemilikannya) lalu otomatis "claim" identitas member yang emailnya kebetulan cocok.
**Fix:** Blok auto-link dihapus total, revert ke lookup `betterAuthUserId` murni.
**Pencegahan:** Jangan pernah auto-link/auto-claim sebuah identitas berdasarkan kecocokan field yang diinput sendiri oleh user (email, nomor HP, dll) tanpa proses verifikasi kepemilikan (OTP, magic link) — terutama di sistem tanpa email verification aktif secara default. Kalau menemukan komponen yang melanggar pattern yang sudah terdokumentasi wajib (mis. `onMouseDown` preventDefault untuk custom dropdown blur-close), grep juga komponen kembaran hasil copy-paste — kalau kembarannya juga melanggar, catat eksplisit sebagai debt terpisah, jangan dibiarkan tanpa jejak.

---

## [2026-08-01] Field UI yang terlihat fungsional belum tentu genuinely dikoneksikan ke logic
**Masalah:** Field "Nama Akun (Linimasa)" di editor section Instagram seharusnya jadi acuan akun yang terhubung, tapi ternyata cuma label kosmetik — foto yang ditarik selalu dari akun OAuth terakhir connect, tidak pernah divalidasi terhadap apa yang diketik admin.
**Root cause:** Sejak rilis OAuth pertama, field `accountName` terlihat fungsional (nama jelas, lokasi masuk akal) tapi tidak pernah genuinely dikoneksikan ke logic resolusi feed.
**Fix:** Nilai field dibawa lintas redirect OAuth (HMAC-signed di `state` param), dibandingkan case-insensitive terhadap username hasil OAuth sebelum token disimpan.
**Pencegahan:** Sebuah field UI yang terlihat jelas namanya/lokasinya belum tentu benar-benar dipakai untuk keperluan yang namanya implikasikan — verifikasi wiring aktual di kode. Kalau user menegur bahwa penjelasan kita salah, jangan membela penjelasan lama — cek ulang kode dari nol dengan asumsi penjelasan sebelumnya salah, dan kalau perbaikannya punya lebih dari satu interpretasi, tanya eksplisit lewat opsi konkret.

---

## [2026-07-30] Section dengan mock data/fallback dummy yang bisa terlihat publik adalah red flag otomatis
**Masalah:** Fitur "Section Directory" yang diklaim agen lain "selesai dengan sempurna" punya 2 bug fatal: fallback mock data (nama usaha/dokter/pesantren fiktif) tercampur tanpa penanda dengan data asli, dan nol tenant scoping — query ke tabel `public.member_*` tanpa `JOIN tenant_memberships`, kebocoran data lintas-tenant.
**Root cause:** Parameter fungsi bernama `tenantClient` memberi kesan palsu bahwa scoping sudah terjadi, padahal tidak ada filter tenant sama sekali di query-nya.
**Fix:** Mock data dihapus total, query ditulis ulang pakai `INNER JOIN tenantMemberships` scoped ke tenant, hardcode nama tenant diganti dinamis.
**Pencegahan:** Frasa "fallback mock data" di laporan manapun adalah red flag otomatis yang harus memicu pemeriksaan apakah data palsu itu genuinely bisa terlihat pengunjung publik. Setiap resolver baru yang query tabel `public.member_*` wajib dicek eksplisit apakah sudah `JOIN tenant_memberships` — jangan asumsikan dari nama parameter bahwa scoping sudah terjadi.

---

## [2026-07-30] "User marah soal agen ngarang data" berarti hapus SEMUA data pengganti, termasuk yang dibuat sesi sendiri
**Masalah:** User marah karena section Instagram "ngarang data" — bukan cuma mock data dari agen sebelumnya, tapi juga fallback "sementara" yang dibuat sendiri oleh sesi ini di sesi sebelumnya dengan niat berbeda.
**Root cause:** User tidak membedakan "data palsu dari agen lain" vs "data palsu dari sesi sendiri" — keduanya sama-sama melanggar maksud asli fitur.
**Fix:** Section dibongkar total, diganti OAuth Graph API sungguhan.
**Pencegahan:** Kalau user marah soal "agen ngarang data", treat itu sebagai instruksi untuk menghilangkan SEMUA bentuk data pengganti/dummy dari fitur itu, termasuk yang sesi ini sendiri pernah buat. Jangan defensif/parsial saat memperbaiki keluhan seperti ini. Riset ke dokumentasi API pihak ketiga yang jarang dipakai wajib pakai web search sungguhan, bukan diasumsikan dari training data yang berpotensi basi.

---

## [2026-07-30] Task audit-bug bukan lisensi menambah keputusan desain baru yang tidak diminta
**Masalah:** Saat mengaudit bug (autoplay, duplikat iframe), ditambahkan juga cap tinggi `max-h-[500px]` pada gambar hero dengan alasan "cegah foto ekstrem mendominasi visual" — user menegur keras karena ini bukan bug fix, murni keputusan desain baru yang tidak diminta.
**Root cause:** `width:100%; height:auto; max-height:Npx` pada elemen `<img>` membuat browser mengorbankan WIDTH demi menjaga rasio asli begitu max-height mengikat (CSS 2.1 §10.4) — bukan cuma memotong tinggi, gambar jadi lebih sempit dari frame dekoratifnya.
**Fix:** Revert total ke `w-full h-auto` polos.
**Pencegahan:** Task audit-bug bukan lisensi menambah keputusan desain/UX baru yang tidak diminta, bahkan kalau niatnya baik. Kalau menemukan potensi masalah UX di luar scope yang diminta, laporkan/tanyakan dulu ke user — jangan langsung eksekusi.

---

## [2026-07-30] Autoplay iframe video butuh mute eksplisit; duplikasi DOM mobile/desktop tidak aman untuk embed berat
**Masalah:** (1) `youtubeAutoplay=true` selalu gagal diam-diam — browser modern memblokir autoplay iframe bersuara tanpa user gesture, kode tidak pernah kirim `mute=1`. (2) iframe YouTube ter-mount 2× bersamaan (pola render mobile+desktop sekaligus, `display` di-toggle CSS) — video ter-load dobel.
**Root cause:** (1) Tidak membedakan "mulai sendiri via config" (harus mute paksa) dari "user klik tombol Putar" (boleh bersuara). (2) `display:none` tidak menghentikan iframe content/network activity — pola duplikasi render aman untuk konten ringan tapi tidak untuk embed berat.
**Fix:** Mute paksa untuk autoplay otomatis. Untuk media berat, satu render dengan posisi diatur via CSS Grid `order`, bukan duplikasi DOM.
**Pencegahan:** Jangan samakan `mute` otomatis dengan `autoplay` — dua konsep berbeda. Untuk embed berat (iframe, video), gunakan satu render + reposisi CSS, bukan duplikasi DOM mobile/desktop.

---

## [2026-07-29] Grid kolom sama rata + `mx-auto` tidak menjamin true center untuk elemen lebar variabel
**Masalah:** Nav menu di header "Pill" tidak benar-benar center, menempel ke kanan begitu nav punya beberapa item menu.
**Root cause:** `grid-cols-3` membagi header jadi 3 kolom sama rata; nav dengan `mx-auto` cuma ter-center di dalam kolom tengahnya sendiri (1/3 lebar header) — begitu lebar konten nav > 1/3 lebar header, `mx-auto` resolve ke 0 dan nav jatuh rata-kiri.
**Fix:** `grid-cols-[1fr_auto_1fr]` — kolom tengah `auto` mengikuti lebar konten nav, kedua kolom `1fr` menyerap sisa ruang sama rata.
**Pencegahan:** Untuk pola "logo kiri, nav tengah (lebar variabel), aksi kanan", pakai grid `[1fr auto 1fr]`, bukan `grid-cols-N` dengan kolom sama rata.

---

## [2026-07-28] Bug `access.userId` vs `access.tenantUser.id` bisa menular ke banyak fungsi bertetangga bertahun-tahun tanpa terdeteksi
**Masalah:** Tombol "Konfirmasi Lunas" di Catat Pemasukan selalu gagal sejak file dibuat (berbulan-bulan) — `confirmPaymentAction` menulis `access.userId` (nanoid) ke kolom UUID, tertangkap try/catch jadi pesan error generik.
**Root cause:** Bug persis pola yang sudah didokumentasikan sebagai lesson lama ("UUID vs nanoid"), sudah benar di fungsi tetangga di file yang sama, tapi tidak pernah di-grep ke fungsi lain — audit menemukan 5 titik lain dengan bug identik di file yang sama (disbursement actions, journal action), seluruh alur konfirmasi pemasukan/pengeluaran/jurnal manual rusak sejak modul dibuat.
**Fix:** Keenam titik diganti `access.tenantUser.id` (UUID asli).
**Pencegahan:** Kalau menemukan bug `access.userId` vs `access.tenantUser.id` di satu fungsi, wajib grep SELURUH file yang sama untuk pola serupa — bug ini terbukti bisa menular ke banyak fungsi bertetangga tanpa terdeteksi bertahun-tahun, bahkan setelah polanya sudah didokumentasikan sebagai lesson. Jangan cukup fix 1 titik yang dilaporkan lalu berhenti.

---

## [2026-07-28] Draft rencana lama bukan sumber kebenaran final; React.cache() hanya dedup argumen primitif
**Masalah:** (1) `React.cache()` di sekitar `resolveSlugKind()` tidak pernah dedup meski dipanggil 2×. (2) Draft rencana lama mengusulkan exclude `robots.txt`/`sitemap.xml` dari matcher middleware — kalau dieksekusi literal akan mematikan rewrite custom domain yang baru saja difix di sesi lain yang berjalan paralel.
**Root cause:** (1) `React.cache()` membandingkan argumen non-primitif secara REFERENCE, bukan deep-equality — array `segments` dari 2 titik `await params` berbeda adalah reference berbeda meski isinya identik. (2) Kode bisa berubah sejak rencana ditulis, terutama kalau ada sesi/agen lain paralel.
**Fix:** (1) Ubah signature fungsi menerima `joinedSegments: string` (di-`.join("/")` sebelum masuk cache) — string dibanding by value. (2) Cek dulu premis draft masih valid sebelum eksekusi literal.
**Pencegahan:** `React.cache()` hanya dedup benar untuk argumen primitif — argumen array/object harus diserialisasi jadi string dulu. Sebelum mengeksekusi draft rencana lama secara literal, cek dulu apakah premisnya masih valid.

---

## [2026-07-28] Metadata Route convention Next.js (robots/manifest/favicon) di-anchor ke root — build sukses bukan bukti route terdaftar
**Masalah:** Memindah `app/robots.ts` ke nested `app/(public)/[tenant]/robots.ts` lolos `tsc`+`next build` tanpa error, tapi menghasilkan NOL route terdaftar.
**Root cause:** Regex pencocokan Next.js untuk `robots`/`manifest`/`favicon.ico` di-anchor dengan `^` — hanya match kalau file ada persis di root `app/` (beda dari `sitemap`/`icon`/`opengraph-image` yang boleh nested). Bug kedua (metodologi verifikasi): test curl dengan Host-header spoofed menunjukkan 200 + konten benar, padahal middleware's internal fetch gagal silent karena `APP_INTERNAL_URL` tidak diset — request jatuh ke file root yang kebetulan isinya identik.
**Fix:** Pakai Route Handler manual (`route.ts`) di folder literal `robots.txt` — tidak terikat regex Metadata Route convention.
**Pencegahan:** Klaim kompatibilitas Next.js Metadata Route convention wajib diverifikasi empiris (cek `app-paths-manifest.json` atau curl langsung, bukan cuma percaya build sukses). Simulasi custom domain via Host-header-spoof wajib disertai `APP_INTERNAL_URL` yang benar dan pengecekan header `x-middleware-rewrite` — status 200 + isi "kelihatan benar" bisa false-positive.

---

## [2026-07-28] Guard validasi field wajib diperiksa di SEMUA jalur input, bukan cuma yang disebut user
**Masalah:** Field `graduationYear` bisa diisi "99" (bukan "1999") lewat beberapa jalur input yang masing-masing tidak divalidasi — auto-join Marhalah gagal diam-diam.
**Root cause:** 3 dari 4 titik input nol/kurang validasi range: form self-service pakai atribut HTML5 `min`/`max` yang dekoratif (submit lewat `fetch()` custom), form admin wizard mengandalkan validasi native HTML5 yang gampang di-bypass, endpoint PATCH partial-update juga nol validasi.
**Fix:** Guard eksplisit (required + range) ditambahkan di ketiga titik SERVER-SIDE.
**Pencegahan:** Kalau diminta tambah guard/validasi untuk sebuah field, jangan cuma tambah di satu tempat yang disebut user — audit semua titik input (form self-service, form admin, endpoint API, importer bulk) untuk field yang sama, field seperti ini nyaris selalu punya beberapa jalur masuk independen yang masing-masing butuh guard server-side sendiri.

---

## [2026-07-27] Kelas bug bundling RSC hanya ketangkap dengan menjalankan lewat Next.js dev server sungguhan, bukan `bun run` standalone
**Masalah:** Fitur import WordPress crash di production dengan "Class extends value undefined is not a constructor" — padahal POC standalone via `bun run` sudah "terbukti aman" menjalankan fungsi yang sama.
**Root cause:** Modul server mengimpor definisi Node extension custom yang punya `addNodeView() { return ReactNodeViewRenderer(...) }` — import `ReactNodeViewRenderer` dari `@tiptap/react` (paket browser-only) ada di level modul, tetap tereksekusi begitu file di-import untuk keperluan apa pun. Next.js/Turbopack menerapkan aturan bundling RSC ketat yang tidak ada di runtime Bun/Node biasa.
**Fix:** Buat duplikasi schema-only (tanpa `addNodeView()`/import `@tiptap/react`) untuk dipakai modul server.
**Pencegahan:** Verifikasi "kode berhasil dijalankan via `bun run`/Node langsung" tidak pernah cukup untuk kode yang akan dipakai di Server Component/Server Action/Client Component Next.js — terutama kalau kode itu mengimpor package pihak ketiga yang biasa dipakai di konteks browser-only. Bug bundling-level jenis ini hanya ketangkap dengan benar-benar menjalankan lewat Next.js dev server dan mengakses halaman yang memicunya.

---

## [2026-07-27] Meng-copy pola/konstanta "karena sama persis" tidak berarti polanya sendiri sudah benar
**Masalah:** Gambar landscape dipotong paksa jadi kotak 1:1 — konstanta `PATH_PRIORITY` loncat langsung dari variant `large` ke variant KOTAK tanpa mempertimbangkan `medium`/`thumbnail` (rasio aspek sama) sebagai fallback antara. Bug sistemik di 3 file duplikat konstanta yang sama.
**Root cause:** File ketiga (importer WordPress) meng-copy pola dari file pertama "karena sama persis" tanpa mempertanyakan urutannya — konsisten dengan yang lama, termasuk konsisten salahnya.
**Fix:** Urutan diperbaiki jadi `["large","medium","thumbnail","square-large","square","profile","original"]` di ketiga file.
**Pencegahan:** Kalau meng-copy sebuah pola/konstanta ke file baru dengan alasan "sama persis dengan yang existing", itu tidak berarti pola itu sendiri sudah benar — tetap pertanyakan apakah logic aslinya benar, jangan asumsikan "sudah dipakai di tempat lain jadi pasti sudah teruji".

---

## [2026-07-28] Route sibling dengan dynamic-segment berbeda nama hanya ketangkap dev server, bukan production build
**Masalah:** Route baru `post/[category]/[slug]/page.tsx` gagal start dengan error "cannot use different slug names for the same dynamic path" — tapi `next build` (production) tidak menangkap konflik ini sama sekali, sukses dan mencantumkan kedua route di listing.
**Root cause:** Next.js App Router mewajibkan satu nama dynamic segment yang sama di kedalaman yang sama untuk semua route sibling — hanya dev server (Turbopack) yang menangkapnya saat start.
**Fix:** Rename folder jadi `post/[slug]/[postSlug]/page.tsx`.
**Pencegahan:** Kalau menambah route baru yang berbagi parent folder dengan route dynamic-segment yang sudah ada, wajib restart dev server (bukan cukup `next build`) untuk memverifikasi tidak ada konflik penamaan dynamic segment.

---

## [2026-07-28] Fitur export untuk skema yang sudah punya importer harus diverifikasi via round-trip, bukan structural parse
**Masalah:** Draf pertama WXR exporter cuma emit 1 dari 2 key Yoast yang dibutuhkan untuk merekonstruksi `posts.robots="noindex,nofollow"` — hasil export, saat di-import ulang, lossy (cuma jadi "noindex").
**Root cause:** Importer (`mapYoastSeo()`) membaca 2 key Yoast terpisah untuk merekonstruksi nilai compound — ketahuan cuma dari menjalankan hasil export balik lewat importer sendiri dan membandingkan field-per-field.
**Fix:** Tambah key kedua yang hilang saat kondisi compound terpenuhi.
**Pencegahan:** Kalau membangun fitur export untuk skema yang sudah punya importer (arah kebalikan), verifikasi paling kuat adalah menjalankan file hasil export balik lewat importer yang sudah ada dan membandingkan field-per-field dengan data asal — bukan cuma "structural parse OK".

---

## [2026-07-27] Node.js URL API punya perilaku IPv6 tidak intuitif yang mudah lolos validator SSRF
**Masalah:** Modul validasi SSRF (`assertSafeExternalUrl`) salah menolak/meloloskan URL dengan IPv6.
**Root cause:** `url.hostname` mempertahankan tanda kurung untuk IPv6 literal (`"[::1]"`) yang tidak dipahami `dns.lookup()`; `new URL("http://[::ffff:127.0.0.1]/")` menormalisasi notasi dotted-quad IPv4-mapped IPv6 jadi hex groups murni sebelum kode sempat melihat string aslinya.
**Fix:** `url.hostname.replace(/^\[|\]$/g, "")` sebelum `dns.lookup()`; deteksi prefix IPv4-mapped dilakukan secara numerik dari grup 16-bit yang sudah di-expand, bukan dari karakter titik di string.
**Pencegahan:** Validator IP/URL berbasis `URL`/`dns` Node.js wajib ditest dengan IPv6 literal (biasa dan IPv4-mapped) untuk KEDUA arah (harus lolos dan harus tertolak) — test hanya kasus "harus tertolak" tidak akan menangkap bug yang tertolak untuk alasan salah.

## [2026-05] `resolveIdentity` di checkout harus terima session, bukan hanya phone/email lookup
**Masalah:** Di `checkoutAction`, `resolveIdentity` dipanggil hanya dengan `phone`/`email` tanpa data session — dua user berbeda dengan nomor HP yang sama menyebabkan invoice ter-assign ke user yang salah.
**Root cause:** Identity resolution mengandalkan lookup by phone/email sebagai satu-satunya sumber, padahal user yang sedang login (session) adalah sumber identitas yang lebih akurat dan harus menang.
**Fix:** Panggil `const session = await auth.api.getSession(...)` di awal `checkoutAction`, kirim `betterAuthUserId: session?.user?.id` ke `resolveIdentity`. Session selalu menang atas lookup HP/email.
**Pencegahan:** Setiap server action yang membuat/mengaitkan transaksi dengan user wajib cek session terlebih dahulu sebelum fallback ke lookup by phone/email.

---

## [2026-05] Bug `ProfessionCombobox` kosong karena API response tidak di-wrap seperti diasumsikan
**Masalah:** `ProfessionCombobox` di `/akun/lengkapi` sempat selalu kosong.
**Root cause:** API `/api/ref/professions` return plain array, tapi kode baca `.data` (undefined).
**Fix:** `Array.isArray(profData) ? profData : (profData.data ?? [])`.
**Pencegahan:** Selalu verifikasi struktur response API sebelum akses `.data` — jangan asumsikan semua API mem-wrap dalam `{ data: [...] }`.

---

## [2026-05] Drizzle `count()`/`sum()` kehilangan type-safety dalam `Promise.all` destructuring
**Masalah:** `count()` dari drizzle-orm menyebabkan TypeScript error saat dipakai dengan `Promise.all` destructuring; `sum()` pada kolom nullable mengembalikan `null` kalau semua row null.
**Root cause:** Helper `count()` drizzle tidak mem-preserve tipe dengan baik dalam context destructuring; `sum()` SQL agregat me-return `null` bukan `0` saat kosong; `Promise.all([...])` dengan destructuring array kehilangan urutan/tipe inferensi di TypeScript.
**Fix:** Gunakan `sql<number>\`count(*)\`` (bukan `count()`), `sql<string>\`coalesce(sum(...),0)\`` untuk aggregate nullable (parse ke `Number()` saat display — return PostgreSQL aggregate selalu string), dan sequential `await` (bukan `Promise.all` destructuring) untuk multi-query yang butuh type-safety.
**Pencegahan:** Berlaku di semua query count/sum di seluruh aplikasi — jangan pakai `count()`/`sum()` drizzle langsung untuk hasil yang akan dipakai lebih lanjut di TypeScript.

---

## [2026-05] Dua error Server/Client Component Next.js App Router yang sering muncul saat split SC↔CC
**Masalah:** (1) `Functions are not valid as a child of Client Components`. (2) `Event handlers cannot be passed to Client Component props`.
**Root cause:** (1) Mengirim fungsi (render prop) sebagai `children` dari Server Component ke Client Component — fungsi tidak serializable lintas SC→CC boundary. (2) Event handler (`onChange`, `onClick`, dll) ditulis langsung di elemen dalam SC.
**Fix:** (1) Kirim data serializable (array/object) sebagai prop, render grid/list di dalam CC. (2) Ekstrak elemen interaktif ke CC terpisah — jangan jadikan seluruh page client hanya karena satu `<select onChange>`.
**Pencegahan:** SC hanya boleh fetch data + pass data (bukan fungsi) ke CC; setiap elemen yang butuh event handler wajib ada di dalam file dengan `"use client"`.

## [2026-07-26] Ringkasan eksekusi dari agent/sesi lain wajib diverifikasi ke kode, bahkan kalau klaim "tsc 0 error" benar
**Masalah:** Agent lain mengklaim fitur editor baru (block "Baca Juga", embed YouTube/Instagram) selesai + `tsc --noEmit` 0 error. Setelah diverifikasi: bug data-breaking (URL path-mode mentah tanpa strip prefix tenant, rusak di custom domain), race condition loader Instagram, dan 2 klaim yang ternyata tidak ada implementasinya sama sekali.
**Root cause:** Ringkasan eksekusi dari agent/sesi lain dipercaya berdasarkan narasi, bukan diverifikasi ke kode aktual.
**Fix:** Bug diperbaiki; klaim yang salah dikoreksi/diabaikan setelah verifikasi.
**Pencegahan:** Ringkasan eksekusi dari agent/sesi lain — termasuk klaim "tsc 0 error" — tidak boleh dipercaya sebagai bukti "tidak ada bug". `tsc` cuma menangkap type error, bukan bug logic, race condition runtime, atau "klaim fitur yang ternyata tidak terhubung ke mana pun". Setiap klaim spesifik ("X sudah di-update", "Y terintegrasi ke Z") wajib diverifikasi dengan membaca file yang disebut dan grep pemakaiannya.

---

## [2026-07-26] Bug: baris "duplicate" ikut membuat member baru ganda karena gate logic tidak menutup semua skenario
**Masalah:** Baris import yang seharusnya SKIP (member sudah jadi anggota tenant ini) malah ikut membuat `contacts`+`addresses`+`members` baru identik setiap kali file yang sama di-import ulang.
**Root cause:** `ImportRowPreview.linkOnly` hanya `true` untuk satu dari tiga skenario match member — `commitImportAction` menggate insert dengan `if (!preview.linkOnly)`, kondisi ini salah bernilai `true` juga untuk skenario "duplicate".
**Fix:** Gate diubah jadi `if (!preview.existingMemberId)` — hanya insert kalau benar-benar tidak ada member existing yang cocok.
**Pencegahan:** Kalau sebuah alur punya lebih dari 2 skenario status, jangan gate logic pakai satu boolean yang cuma membedakan satu pasang skenario — gate langsung dari sumber kebenaran paling primitif (ID existing, null/tidak-null), bukan dari flag turunan yang cuma valid sebagian kasus. Bug kelas ini tidak akan tertangkap tsc/build.

---

## [2026-07-25] Bug tampilan combobox: ID tersimpan tapi display name tidak di-SELECT untuk re-render
**Masalah:** Field kabupaten tempat lahir di form edit anggota tampak kosong lagi setiap form dibuka ulang, padahal sudah dipilih dan disimpan.
**Root cause:** Data tersimpan benar — bug ada di jalur baca/tampilan. `RegencyCombobox` butuh `value` (ID) DAN `displayName` untuk menampilkan pilihan awal, tapi query edit page hanya SELECT ID.
**Fix:** Tambah `refRegencies.name` ke SELECT query edit page, teruskan sampai ke state komponen combobox.
**Pencegahan:** Kalau combobox/autocomplete butuh menampilkan pilihan awal dari data server, field display-name-nya harus di-select eksplisit di server DAN diteruskan ke state komponen — ID saja tidak cukup. Kalau laporan bug "data tidak tersimpan" untuk field combobox, cek dulu apakah datanya benar-benar hilang di DB sebelum menyimpulkan bug di jalur tulis.

---

## [2026-07-25] Guard "generate field kalau kosong" yang dikunci di satu jalur mutasi tidak otomatis berlaku di jalur lain
**Masalah:** `updateMemberAction` (edit admin) tidak pernah men-generate No. Anggota meski admin baru mengisi Tanggal Lahir untuk member yang belum punya nomor.
**Root cause:** Pola "generate No. Anggota begitu Tanggal Lahir pertama kali diketahui" sudah dikunci di `PATCH /api/akun/member-data` (self-service) — tapi `updateMemberAction` (jalur admin, file berbeda) tidak pernah punya guard yang sama.
**Fix:** `updateMemberAction` sekarang SELECT `memberNumber` existing dulu; kalau null, generate dari `data.birthDate` sebelum update.
**Pencegahan:** Pola guard yang dikunci di satu jalur mutasi tidak otomatis berlaku di jalur mutasi lain untuk entitas yang sama. Kalau sebuah field punya banyak titik mutasi (create-admin, edit-admin, self-service, import massal), audit semua titik satu per satu — jangan asumsikan satu fix menutup seluruh kelas masalah.

---

## [2026-07-25] Merge-patch bocor field non-skema karena iterasi berdasarkan `incoming`, bukan `existing`
**Masalah:** Baris import yang match member existing selalu gagal commit dengan `SQL syntax error at or near "where"` — ditemukan dari testing sungguhan.
**Root cause:** `fillEmpty()` iterasi `for (const key in incoming)` — objek `incoming` (`preview.member` apa adanya) punya field `fullName` yang bukan bagian skema `MemberFieldPatch`; `existing["fullName"]` jadi `undefined` → dianggap kosong → masuk patch → Drizzle buang key tak dikenal skema → SQL `SET` kosong → syntax error.
**Fix:** Bangun objek `incomingMember` eksplisit tanpa `fullName`; hardening `fillEmpty()` — iterasi diubah jadi `for (const key in existing)` supaya field ekstra di `incoming` otomatis diabaikan.
**Pencegahan:** Kalau dua fungsi (preview vs commit) sama-sama memanggil helper dengan parameter yang seharusnya identik bentuknya, verifikasi keduanya benar-benar membangun parameter dengan cara yang sama. Untuk helper yang membandingkan "existing" vs "incoming" field-per-field, selalu iterasi berdasarkan key dari `existing` (sumber kebenaran skema), bukan dari `incoming`.

---

## [2026-07-25] Reversal keputusan arsitektur yang sudah dikunci wajib dikonfirmasi eksplisit, tidak diam-diam diubah
**Masalah:** `activateForumMembershipIfApplicable()` menganggap SIAPA PUN yang bayar item syarat iuran forum sebagai niat gabung — donasi organik lewat `/campaign/{slug}` (nol niat gabung) bisa tak sengaja mengaktifkan keanggotaan.
**Root cause:** Keputusan Fase D sebelumnya secara eksplisit "reuse billing universal tanpa menandai invoice" — benar untuk kasus itu, tapi tidak cukup membedakan niat gabung dari donasi biasa.
**Fix:** Penanda `for_gabung_registration` dipropagasi end-to-end dari link `/gabung` → cart → invoice item; `activateForumMembershipIfApplicable` wajib cek flag ini, bukan cuma cocok itemId.
**Pencegahan:** Kalau instruksi/perbaikan tampak membalik keputusan arsitektur yang sudah eksplisit dikunci di sesi sebelumnya, jangan diam-diam ubah — konfirmasi dulu via pertanyaan eksplisit yang menyebutkan ini reversal, baru eksekusi setelah dikonfirmasi.

---

## [2026-07-25] Template import yang "generik" tapi masih anchor ke satu sumber data eksternal belum genuinely schema-first
**Masalah:** Template import yang baru dipivot jadi "generik untuk semua tenant" masih menyusun kolom dari isi Excel sumber (kurang 4 kolom, tambah 1) — kolom "Forbis ID" (nama internal satu forum tertentu) tetap ada di template yang diklaim generik.
**Root cause:** Instruksi "buat sesuai struktur kita, bukan struktur eksternal" dijalankan setengah hati — tetap anchor ke sumber data eksternal (reshuffle kolom) alih-alih audit skema penuh dari nol.
**Fix:** Baca ulang seluruh schema terkait disilangkan dengan field eligibility keanggotaan generik, susun ulang kolom template murni dari situ. "Forbis ID" → "Nomor Keanggotaan" (generik).
**Pencegahan:** Kalau diminta membuat sesuatu "sesuai struktur kita, bukan struktur X", verifikasi: apakah hasil akhirnya bisa ditelusuri balik ke SATU sumber spesifik (satu forum/file/tenant)? Kalau ya, itu tanda belum genuinely schema-first — ulangi dari audit skema penuh.

---

## [2026-07-24] Kolom enum dengan CHECK constraint DB manual butuh sinkronisasi terpisah dari Drizzle schema
**Masalah:** Menambah kategori profesi baru "Kreatif" hanya di `lib/professional-types.ts` + Drizzle schema enum tidak cukup — insert tetap ditolak database.
**Root cause:** Kolom punya CHECK constraint PostgreSQL sungguhan (dibuat via DDL inline manual saat migration, bukan `pgEnum`) — dua tempat terpisah yang harus disinkronkan manual.
**Fix:** Update Drizzle schema enum + migration baru `DROP`+`ADD CONSTRAINT` untuk CHECK constraint. Nama constraint diverifikasi via `psql \d`, bukan ditebak.
**Pencegahan:** Kalau kolom `text(...,{enum:[...]})` punya "kembaran" konseptual di file konstanta terpisah, keduanya wajib diupdate bersamaan — dan kalau kolom dibuat via migration SQL manual, kemungkinan besar ada CHECK constraint DB yang juga perlu di-ALTER terpisah. `tsc` tidak pernah menangkap CHECK constraint DB yang ketinggalan — verifikasi manual via `\d` wajib jadi bagian proses.

---

## [2026-07-23] `displayPhone()` adalah fungsi terminal — jangan diproses ulang untuk membangun link
**Masalah:** Link `wa.me` rusak total di production — 4 titik membangun link dengan `.replace(/\D/g,"")` pada nilai yang sudah melewati `displayPhone()` (`+6281234567890` → `081234567890` → stripped, hilang kode negara). Juga ditemukan 3 implementasi `normalizePhone`-like yang saling kompetitif.
**Root cause:** `displayPhone()` diperlakukan sebagai nilai yang bisa diproses ulang, padahal hasilnya sudah dilokalkan untuk tampilan (kehilangan info yang dibutuhkan link).
**Fix:** Helper baru `toWaDigits()` sebagai satu-satunya cara membangun digit `wa.me`/GOWA. Migration backfill pakai `COALESCE(normalize(...), original)`, bukan assign langsung.
**Pencegahan:** `displayPhone()` hasilnya hanya untuk ditampilkan sebagai teks — begitu lewat fungsi ini, jangan proses ulang untuk keperluan lain (link, kalkulasi), selalu turunkan dari nilai E.164 asli. Untuk migration SQL yang menormalisasi kolom `NOT NULL` massal, wajib `COALESCE(fungsi_normalize(...), nilai_asli)` karena fungsi normalize bisa return NULL.

---

## [2026-07-22] Payment ditolak/dibatalkan tetap kelihatan seperti pemasukan kalau tidak difilter status
**Masalah:** User khawatir payment yang ditolak masih ikut kehitung sebagai pemasukan.
**Root cause:** Bukan bug data — `/finance/pemasukan` menampilkan semua status (termasuk rejected/cancelled) tanpa filter default, nominal selalu hijau tanpa mempedulikan status.
**Fix:** Filter default exclude `rejected`/`cancelled`; nominal baris itu jadi abu-abu+dicoret.
**Pencegahan:** Untuk pertanyaan finansial yang menyangkut uang sungguhan, verifikasi ke data sungguhan dulu. Query deteksi "duplikat pembayaran" harus bandingkan SUM aktual terhadap nilai yang seharusnya (total + kode unik), bukan cuma `COUNT(*) > 1` — sistem ini sengaja mendukung pembayaran dicicil, "lebih dari 1 payment lunas" bukan sinyal bug dengan sendirinya.

---

## [2026-07-22] Wrapper component yang destructuring manual field config bisa diam-diam menjatuhkan field baru
**Masalah:** User pilih "Landscape" di editor Galeri Foto tapi foto tetap kotak di front-end.
**Root cause:** `<Gallery>` melakukan `const { layout, columns } = { ...DEFAULT, ...config }` — hanya menarik `layout`+`columns` manual, `aspectRatio` tidak ikut diteruskan meski valid secara type.
**Fix:** Tambah `aspectRatio` ke destructuring + teruskan sebagai prop.
**Pencegahan:** Kalau komponen wrapper menerima `config` dan meneruskan sebagian field via destructuring manual (bukan spread utuh), setiap field baru di tipe config wajib dicek juga di wrapper. `tsc` tidak menangkap ini — hanya ketahuan lewat testing visual.

---

## [2026-07-22] Memperluas standar ke section baru butuh identifikasi perilaku default ASLI-nya dulu
**Masalah:** Memperluas field `titleAlign` ke section Galeri/Statistik hampir didefault ke `"left"` mengikuti section lain — padahal Galeri/Statistik sebelumnya selalu hardcode `text-center`.
**Root cause:** Default baru yang dipaksa `"left"` akan membuat section existing yang sudah dikonfigurasi admin tiba-tiba lompat dari center ke kiri — regresi visual yang tidak tertangkap tsc/build.
**Fix:** Default runtime `d.titleAlign ?? "center"` khusus section yang perilaku aslinya selalu center.
**Pencegahan:** Saat memperluas standar ke section baru yang pernah punya default berbeda dari acuan awal, identifikasi dulu perilaku asli section itu sebelum field baru ditambahkan — jadikan default runtime DAN default eksplisit di konstanta. Kelas regresi visual ini paling gampang lolos audit tsc/build.

---

## [2026-07-22] Nama class CSS yang kebetulan sama dengan class global tidak berarti instruksi untuk menimpanya
**Masalah:** User memberi spesifikasi CSS untuk tombol dengan nama class `.btn-ghost` — project sudah punya `.btn-ghost` sistem-wide (Public Button System) dengan visual total berbeda.
**Root cause:** Risiko menimpa definisi class global yang dipakai luas hanya karena user memberi spesifikasi dengan nama yang kebetulan sama.
**Fix:** Dibuat komponen React berdiri sendiri, bukan menimpa class global.
**Pencegahan:** Kalau user memberi CSS/spesifikasi eksternal dengan nama class yang kebetulan sama dengan class yang sudah dipakai luas, jangan asumsikan itu instruksi menimpa definisi lama — cek dulu apakah keduanya menjelaskan visual yang sama. Kalau beda, buat implementasi terpisah.

---

## [2026-07-22] Root cause bug scroll/state sering ada di komponen tetangga, bukan di komponen yang menampilkan gejalanya
**Masalah:** Navigasi lightbox galeri menyebabkan scroll jump ke atas, padahal kode navigasi internal lightbox sudah benar (`router.replace(..., {scroll:false})`).
**Root cause:** Root cause sesungguhnya di titik berbeda — thumbnail grid memakai anchor HTML polos (`<a href>`), bukan `next/link`, sehingga navigasi native browser tidak bisa dipasang `scroll:false`.
**Fix:** Ganti `<a>` → `<Link href={...} scroll={false}>`.
**Pencegahan:** Kalau ada laporan "navigasi X di dalam Y menyebabkan scroll jump/state hilang", cek juga titik pembuka/pemicu di luar komponen yang dicurigai — root cause sering ada di komponen tetangga yang menghubungkan dua state.

---

## [2026-07-21] Deploy: pisahkan command build dari restart, selalu verifikasi sebelum lanjut
**Masalah:** `bun run build` dan `pm2 restart --update-env` tereksekusi menyatu tanpa jeda — build belum selesai tapi restart tetap jalan terhadap `.next/` lama/tidak lengkap, menyebabkan crash-loop.
**Root cause:** Instruksi deploy menggabungkan command build dan restart tanpa penekanan "tunggu sampai selesai dulu".
**Fix:** Jalankan build sendirian, tunggu selesai, verifikasi file target ada dengan timestamp baru, baru restart.
**Pencegahan:** Untuk instruksi deploy, selalu minta command build terpisah dari restart (jangan digabung tanpa penekanan tunggu), dan selalu sertakan langkah verifikasi (cek file target, restart counter stabil, curl response) sebagai bagian instruksi.

---

## [2026-07-21] Lookup "cari row di tabel helper dulu, baru cari entitas pemilik di query terpisah" bisa gagal kalau baris pertama bukan milik entitas yang dicari
**Masalah:** `api/akun/register/route.ts` mengecek duplikat email/HP dengan query terpisah (`contacts.findFirst` lalu `members.findFirst`) — kalau contact yang ketemu adalah baris usaha/profesional/pesantren (bukan yang tertaut ke members), pengecekan "sudah terdaftar" gagal total.
**Root cause:** Pola dua-query terpisah — kalau baris pertama yang match bukan milik entitas yang dicari, hasil kedua jadi `undefined` padahal seharusnya ketemu. Bug yang sama sebelumnya juga ditemukan di lookup-member donasi.
**Fix:** Ganti jadi satu query JOIN (`members INNER JOIN contacts WHERE contacts.email = X OR contacts.phone = Y`).
**Pencegahan:** Begitu kelas bug ini ditemukan sekali, wajib langsung grep pola yang sama (`{helperTable}.findFirst` diikuti `eq({entitas}.{fk}, hasil_pencarian_pertama)`) di seluruh codebase — pola yang sama besar kemungkinan di-copy-paste ke kebutuhan serupa lain.

## [2026-06] Jangan reflex pakai Redis untuk kebutuhan TTL/rate-limit sederhana — PostgreSQL sudah cukup
**Masalah:** Ada dorongan menambah Redis untuk sistem OTP hanya karena asosiasi umum "OTP = TTL = butuh Redis".
**Root cause:** Asumsi keliru bahwa TTL/sekali-pakai/rate-limit selalu butuh in-memory store terpisah, padahal untuk skala traffic proyek ini PostgreSQL sudah cukup: TTL via kolom `expires_at` + filter `WHERE expires_at > NOW()`; sekali pakai via kolom `used_at` (NULL=belum, non-NULL=sudah); rate limit via `COUNT WHERE created_at > NOW() - INTERVAL '1 hour'`.
**Fix:** Tabel `public.otp_tokens` biasa, tanpa dependency tambahan.
**Pencegahan:** Redis (atau in-memory store lain) hanya diperlukan kalau operasi TTL/rate-limit sungguh-sungguh dipanggil jutaan kali per hari (high-traffic genuinely terbukti, bukan diasumsikan). Untuk fitur baru dengan kebutuhan skala kecil-menengah, defaultkan ke kolom timestamp PostgreSQL yang sudah dipakai sebelum mengusulkan infrastruktur tambahan.

---

## [2026-05] Route group Next.js `(dashboard)`/`(public)` tidak mengubah URL — path yang sama di keduanya bentrok
**Masalah:** Dev server gagal start dengan error "You cannot have two parallel pages that resolve to the same path" saat menambah halaman publik baru.
**Root cause:** Route group Next.js App Router (`(namafolder)`) murni organisasi filesystem — tidak pernah muncul di URL. `(dashboard)/[tenant]/akun/page.tsx` dan `(public)/[tenant]/akun/page.tsx` sama-sama resolve ke `/{tenant}/akun`.
**Fix:** Rename salah satu (dashboard admin `/akun` → `/accounts`, dst).
**Pencegahan:** Sebelum menambah halaman baru di `(public)` atau `(dashboard)`, selalu cek dulu apakah path yang sama sudah dipakai di sisi lain. Gunakan nama folder berbeda untuk halaman admin vs publik yang konsepnya serupa (produk vs toko, event vs agenda, donasi vs campaign) — update juga `nav-menu.ts` setiap kali rename terjadi.

---

## [2026-04] Kolom timestamp konfirmasi eksplisit (signed_at/confirmed_at/approved_at/paid_at) tidak boleh punya DEFAULT
**Masalah:** Slot tanda tangan baru di `letter_signatures` langsung tampil "✓ TTD" begitu di-assign officer, padahal belum ada yang benar-benar menandatangani.
**Root cause:** Kolom `signed_at` di DDL tenant lama punya `DEFAULT now()` (sisa versi sebelum refactor) — setiap INSERT baru otomatis mendapat `signed_at = NOW()` tanpa aksi TTD sungguhan. Gejala pasti: `signed_at = created_at` persis sama.
**Fix:** `ALTER TABLE ... ALTER COLUMN signed_at DROP DEFAULT` per tenant terdampak, lalu reset baris yang ter-auto-sign.
**Pencegahan:** Kolom apa pun yang merepresentasikan konfirmasi eksplisit user (`signed_at`, `confirmed_at`, `approved_at`, `paid_at`, dll di modul manapun) tidak boleh punya `DEFAULT` di DDL — harus selalu NULL saat row dibuat, diisi eksplisit hanya saat event konfirmasi genuinely terjadi. Kalau menemukan bug "status langsung true padahal belum ada aksi user", cek dulu apakah `created_at === kolom_timestamp_terkait`.

---

## [2026-04] Tiga kebiasaan modul baru: toggle tanpa konsumen, Drizzle notNull vs DDL, nama fitur menentukan validasi
**Masalah:** Saat membangun modul Event, ditemukan 3 pola kesalahan berulang: (1) toggle UI ditambahkan sebelum consumer-nya diimplementasikan (`showAttendeeList` sempat tampil padahal belum ada efeknya di halaman publik); (2) DDL `NOT NULL` tanpa `.notNull()` yang cocok di Drizzle schema membuat TypeScript type lebih lebar dari realita; (3) fitur "Sertifikat Kehadiran" nyaris divalidasi untuk status `confirmed` padahal namanya menyiratkan hanya untuk `attended`.
**Root cause:** Ketidaksesuaian antara apa yang ditawarkan UI/nama fitur vs apa yang benar-benar diimplementasikan/divalidasi di baliknya.
**Fix:** Toggle baru hanya ditambahkan setelah consumer-nya ada; DDL `NOT NULL` selalu dipasangkan `.notNull()` di baris Drizzle yang sama; validasi backend disesuaikan ketat dengan semantik nama fitur di UI.
**Pencegahan:** Jangan expose toggle boolean di form admin sebelum ada consumer yang benar-benar membaca nilainya. Setiap menulis DDL `NOT NULL`, langsung tambahkan `.notNull()` di baris Drizzle yang sama. Kalau nama fitur di UI menyiratkan kondisi spesifik, validasi backend harus secermat itu — kalau ragu, pilih validasi yang lebih ketat.

<!-- Entri chunk lain (3) ditambahkan menyusul setelah proses klasifikasi selesai -->
