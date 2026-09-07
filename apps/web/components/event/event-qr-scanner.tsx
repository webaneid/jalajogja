"use client";

// Scanner QR kamera untuk check-in event — dipakai di EventCheckinClient sebagai alternatif
// (bukan pengganti) search manual. Lihat docs/arsitektur-event.md § "RENCANA — Check-in via Scan
// Kamera (QR)" untuk desain lengkap + alasan pilihan library.
//
// Kamera SENGAJA tidak pernah ditutup sendiri setelah satu scan sukses/gagal — tetap menyala
// terus-menerus sampai admin klik "Matikan Kamera", supaya peserta berikutnya bisa langsung
// discan tanpa admin harus buka-tutup kamera tiap orang.

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Info, Camera, CameraOff, Loader2 } from "lucide-react";
import { checkInByTokenAction } from "@/app/(dashboard)/app/[tenant]/event/actions";

const SCANNER_ELEMENT_ID = "event-qr-scanner-region";
// Jangan proses ulang token yang sama dalam window ini — kamera terus menyala jadi QR yang sama
// masih ada di frame beberapa detik setelah sukses discan.
const RESCAN_COOLDOWN_MS = 3000;

type Mode = "idle" | "starting" | "active" | "camera-error";

type FeedbackState =
  | { kind: "idle" }
  | { kind: "success"; message: string }
  | { kind: "already"; message: string }
  | { kind: "error"; message: string };

export function EventQrScanner({
  slug,
  eventId,
  onCheckedIn,
}: {
  slug:        string;
  eventId:     string;
  // Dipanggil setelah check-in BENAR-BENAR baru terjadi (bukan untuk kasus "sudah check-in
  // sebelumnya") — supaya parent (list peserta) bisa update baris yang sesuai tanpa reload.
  onCheckedIn?: (registrationId: string, attendeeName: string) => void;
}) {
  const [mode,        setMode]        = useState<Mode>("idle");
  const [feedback,    setFeedback]    = useState<FeedbackState>({ kind: "idle" });
  const [cameraError, setCameraError] = useState<string | null>(null);

  const scannerRef    = useRef<Html5Qrcode | null>(null);
  const processingRef = useRef(false); // cegah dua scan diproses bersamaan (race antar frame)
  const lastTokenRef   = useRef<{ token: string; at: number } | null>(null);

  async function handleDecoded(token: string) {
    const now = Date.now();
    if (
      lastTokenRef.current &&
      lastTokenRef.current.token === token &&
      now - lastTokenRef.current.at < RESCAN_COOLDOWN_MS
    ) {
      return; // QR yang sama, masih dalam cooldown — abaikan
    }
    if (processingRef.current) return;
    processingRef.current = true;
    lastTokenRef.current = { token, at: now };

    try {
      const res = await checkInByTokenAction(slug, eventId, token);
      if (!res.success) {
        setFeedback({ kind: "error", message: res.error });
        return;
      }
      if (res.alreadyCheckedIn) {
        const time = res.checkedInAt
          ? new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit" }).format(new Date(res.checkedInAt))
          : null;
        setFeedback({
          kind:    "already",
          message: `${res.attendeeName} sudah check-in sebelumnya${time ? ` pukul ${time}` : ""}.`,
        });
        return;
      }
      setFeedback({ kind: "success", message: `Selamat datang, ${res.attendeeName}, di ${res.eventTitle}!` });
      onCheckedIn?.(res.registrationId, res.attendeeName);
    } finally {
      processingRef.current = false;
    }
  }

  // Mulai kamera SETELAH container-nya benar-benar ter-render (mode "starting" me-render div
  // yang dibutuhkan html5-qrcode) — bukan langsung di handler klik, supaya elemen DOM-nya sudah
  // pasti ada & terlihat (html5-qrcode butuh ukuran container yang valid, bukan display:none).
  useEffect(() => {
    if (mode !== "starting") return;

    let cancelled = false;
    const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
    scannerRef.current = scanner;

    const config = { fps: 10, qrbox: { width: 250, height: 250 } };
    const onSuccess = (decodedText: string) => { void handleDecoded(decodedText); };
    const onScanFailure = () => { /* "tidak ketemu QR di frame ini" — normal, terus jalan */ };

    async function run() {
      try {
        await scanner.start({ facingMode: "environment" }, config, onSuccess, onScanFailure);
      } catch {
        // facingMode "environment" mungkin tidak ada (laptop cuma 1 kamera) — fallback ke kamera
        // pertama yang terdeteksi.
        try {
          const cameras = await Html5Qrcode.getCameras();
          if (cameras.length === 0) throw new Error("no-camera");
          await scanner.start(cameras[0].id, config, onSuccess, onScanFailure);
        } catch {
          if (!cancelled) {
            setCameraError("Tidak bisa mengakses kamera. Pastikan izin kamera browser sudah diizinkan, lalu coba lagi.");
            setMode("camera-error");
          }
          return;
        }
      }
      if (!cancelled) setMode("active");
    }

    void run();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode === "starting"]);

  // Cleanup kamera saat komponen di-unmount (mis. admin pindah ke tab "Cari Manual")
  useEffect(() => {
    return () => {
      const scanner = scannerRef.current;
      if (scanner) {
        scanner.stop().then(() => scanner.clear()).catch(() => { /* sudah stopped, abaikan */ });
      }
    };
  }, []);

  async function stopCamera() {
    const scanner = scannerRef.current;
    if (scanner) {
      try {
        await scanner.stop();
        scanner.clear();
      } catch { /* sudah stopped, abaikan */ }
    }
    scannerRef.current = null;
    setMode("idle");
    setFeedback({ kind: "idle" });
  }

  const showRegion = mode === "starting" || mode === "active";

  return (
    <div className="space-y-3">
      {(mode === "idle" || mode === "camera-error") && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center space-y-3">
          <Camera className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Aktifkan kamera untuk mulai scan QR tiket peserta.
          </p>
          <Button onClick={() => { setCameraError(null); setMode("starting"); }}>
            <Camera className="h-4 w-4 mr-2" />
            Aktifkan Kamera
          </Button>
          {cameraError && <p className="text-xs text-destructive">{cameraError}</p>}
        </div>
      )}

      {/* Container video kamera — di-mount hanya saat starting/active supaya elemen selalu
          terlihat (bukan display:none) ketika html5-qrcode mulai attach video-nya. */}
      {showRegion && (
        <div className="space-y-3">
          <div id={SCANNER_ELEMENT_ID} className="rounded-lg overflow-hidden" />

          {mode === "starting" && (
            <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Membuka kamera...
            </p>
          )}

          {mode === "active" && (
            <>
              <Button variant="outline" size="sm" onClick={stopCamera} className="w-full">
                <CameraOff className="h-4 w-4 mr-2" />
                Matikan Kamera
              </Button>

              {feedback.kind !== "idle" && (
                <div
                  className={`rounded-lg border p-4 text-center space-y-1 ${
                    feedback.kind === "success"
                      ? "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950"
                      : feedback.kind === "already"
                      ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950"
                      : "border-destructive/40 bg-destructive/10"
                  }`}
                >
                  {feedback.kind === "success" && <CheckCircle2 className="h-6 w-6 mx-auto text-green-600" />}
                  {feedback.kind === "already"  && <Info className="h-6 w-6 mx-auto text-amber-600" />}
                  {feedback.kind === "error"    && <XCircle className="h-6 w-6 mx-auto text-destructive" />}
                  <p
                    className={`text-sm font-medium ${
                      feedback.kind === "success"
                        ? "text-green-800 dark:text-green-200"
                        : feedback.kind === "already"
                        ? "text-amber-800 dark:text-amber-200"
                        : "text-destructive"
                    }`}
                  >
                    {feedback.message}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
