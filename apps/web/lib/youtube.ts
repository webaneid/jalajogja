/**
 * Helper extractor ID video YouTube dari berbagai format URL:
 * - https://www.youtube.com/watch?v=dQw4w9WgXcQ
 * - https://youtu.be/dQw4w9WgXcQ
 * - https://www.youtube.com/embed/dQw4w9WgXcQ
 * - https://www.youtube.com/shorts/dQw4w9WgXcQ
 */
export function getYouTubeVideoId(url?: string): string | null {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

/**
 * Deteksi apakah URL YouTube adalah format Shorts (vertikal 9:16)
 */
export function isYouTubeShorts(url?: string): boolean {
  if (!url) return false;
  return url.includes("/shorts/");
}

/**
 * Membangun URL embed YouTube yang bersih (minimalis, tanpa rekomendasi luar, modest branding)
 *
 * `mute` WAJIB `true` untuk autoplay yang terjadi TANPA klik user (mis. `youtubeAutoplay` config
 * yang membuat video mulai putar sendiri saat halaman dimuat) — browser modern (Chrome/Safari/
 * Firefox) SELALU memblokir autoplay iframe ber-suara tanpa user gesture langsung sebelumnya.
 * Tanpa mute di skenario ini, video diam-diam gagal autoplay — cuma diam di frame pertama.
 *
 * Untuk autoplay yang DIPICU KLIK USER (tombol "Putar Video", buka popup lightbox) — `mute`
 * boleh `false`, karena klik itu sendiri adalah user gesture yang melonggarkan restriksi
 * autoplay-bersuara browser untuk media yang di-insert setelahnya. Caller menentukan lewat
 * parameter `mute` eksplisit — JANGAN samakan otomatis dengan `autoplay` (dua konsep berbeda:
 * "apakah video mulai sendiri" vs "apakah video mulai TANPA interaksi user").
 */
export function buildYouTubeEmbedUrl(videoId: string, autoplay = true, mute = false): string {
  const params = new URLSearchParams({
    autoplay: autoplay ? "1" : "0",
    mute: mute ? "1" : "0",
    rel: "0",              // Hanya rekomendasikan video dari channel yang sama
    modestbranding: "1",   // Sembunyikan logo besar YouTube di bar kontrol
    iv_load_policy: "3",   // Sembunyikan anotasi/pop-up interaktif di atas video
    showinfo: "0",         // Sembunyikan info judul terpisah jika didukung
  });
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}
