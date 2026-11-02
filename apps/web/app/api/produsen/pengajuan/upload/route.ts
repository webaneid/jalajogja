// Unggah berkas Pengajuan Produsen (foto contoh, foto proses, dokumen legalitas gambar/PDF) — docs/arsitektur-pengajuan-produsen.md § 13.
// Route handler (bukan Server Action) karena Server Action dibatasi body 1 MB. Urutan jaminan:
//   Origin/Referer → sesi + anggota + keanggotaan tenant (SEBELUM body dibaca) → rate limit → Content-Length → validasi isi berkas
//   → simpan ke bucket PRIVAT → lampirkan ke draf (transaksi + kunci per anggota; batas jumlah dicek DI DALAM transaksi)
//   → bila lampiran gagal, objek yang baru diunggah dihapus lagi.
// Format ditentukan dari ISI file (bukan file.type klien): gambar diproses ulang Sharp → WebP (EXIF dibuang, maks 1600 px);
// PDF (hanya slot dokumen) divalidasi header/penutup dan disimpan apa adanya. Nama berkas = UUID buatan server.
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { ensurePrivateBucket, uploadPrivate } from "@/lib/minio";
import { processApplicationFile } from "@/lib/producer-application-file.server";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  resolveApplicant, getOrCreateDraft, attachFile, deleteKeys, type AttachSpec,
} from "@/lib/producer-application.server";
import { APP_DOC_KINDS, APP_FIELD_LIMITS, APP_IMAGE_MAX_BYTES } from "@/lib/producer-application";
import { isValidUuid } from "@/lib/is-uuid";

const MAX_BODY = APP_IMAGE_MAX_BYTES + 1024 * 1024; // + overhead multipart

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function POST(req: NextRequest) {
  // CSRF: Origin ATAU Referer wajib ada dan harus host kita (cookie sesi juga SameSite=Lax sebagai lapis kedua)
  const host = req.headers.get("host");
  const from = req.headers.get("origin") ?? req.headers.get("referer");
  if (!from) return fail("Permintaan ditolak.", 403);
  try { if (new URL(from).host !== host) return fail("Permintaan ditolak.", 403); } catch { return fail("Permintaan ditolak.", 403); }

  const slug = req.nextUrl.searchParams.get("tenant") ?? "";
  const r = await resolveApplicant(slug);                       // sesi + anggota + keanggotaan, SEBELUM body dibaca
  if (!r.ok) return fail(r.error, r.status);
  const a = r.a;
  if (!a.enabled) return fail("Pengajuan produsen sedang ditutup.", 403);
  if (a.hasProducer) return fail("Anda sudah terdaftar sebagai produsen di tenant ini.", 409);

  const rl = checkRateLimit(`prodapp-upload:${a.member.id}`, 30, 60 * 60_000);
  if (!rl.allowed) return fail("Terlalu banyak unggahan. Coba lagi nanti.", 429);

  const len = Number(req.headers.get("content-length") ?? "");
  if (!Number.isFinite(len) || len <= 0) return fail("Ukuran permintaan tidak diketahui.", 411);
  if (len > MAX_BODY) return fail("Ukuran berkas terlalu besar.", 413);

  let form: FormData;
  try { form = await req.formData(); } catch { return fail("Data tidak valid.", 400); }
  const slot = String(form.get("slot") ?? "");
  const fileRaw = form.get("file");
  if (!(fileRaw instanceof File) || fileRaw.size === 0) return fail("Pilih berkas terlebih dahulu.", 400);
  if (slot !== "sample" && slot !== "process" && slot !== "document") return fail("Data tidak valid.", 400);

  let sampleId = "";
  if (slot === "sample") {
    sampleId = String(form.get("sampleId") ?? "");
    if (!isValidUuid(sampleId)) return fail("Contoh produk tidak valid. Simpan draf lalu coba lagi.", 400);
  }
  let kind = "", note: string | null = null;
  if (slot === "document") {
    kind = String(form.get("kind") ?? "");
    if (!(APP_DOC_KINDS as readonly string[]).includes(kind)) return fail("Pilih jenis dokumen.", 400);
    const n = String(form.get("note") ?? "").replace(/\s+/g, " ").trim().slice(0, APP_FIELD_LIMITS.docNote);
    note = n || null;
  }

  // Draf/status diperiksa LEBIH DULU (murah) — pengajuan yang sudah pending tidak boleh memicu dekode gambar (memori)
  const draft = await getOrCreateDraft(a);
  if (!draft.ok) return fail(draft.error, 409);

  // ── Validasi & pemrosesan dari ISI berkas (lib/producer-application-file.server.ts) ──
  const processed = await processApplicationFile(Buffer.from(await fileRaw.arrayBuffer()), slot);
  if (!processed.ok) return fail(processed.error, processed.busy ? 503 : 400);
  const { body, mime, ext } = processed;

  // ── Simpan objek + lampirkan ──
  const fileId = randomUUID();
  const key = `pengajuan-produsen/${draft.app.id}/${fileId}.${ext}`;
  try {
    await ensurePrivateBucket(a.tenant.slug);
    await uploadPrivate(a.tenant.slug, key, body, mime);
  } catch (e) {
    console.error("[produsen-pengajuan-upload] simpan objek:", e);
    return fail("Gagal menyimpan berkas.", 500);
  }

  const file = { id: fileId, key, mime };
  const spec: AttachSpec = slot === "sample" ? { slot, sampleId, file } : slot === "process" ? { slot, file } : { slot, kind, note, file };
  let attached;
  try {
    attached = await attachFile(a, draft.app.id, spec);
  } catch (e) {
    console.error("[produsen-pengajuan-upload] lampirkan:", e);
    await deleteKeys(a.tenant.slug, [key]);
    return fail("Gagal menyimpan berkas.", 500);
  }
  if (!attached.ok) {                                   // batas jumlah/draf berubah → objek baru tak boleh yatim
    await deleteKeys(a.tenant.slug, [key]);
    return fail(attached.error, 409);
  }
  if (attached.replacedKey) await deleteKeys(a.tenant.slug, [attached.replacedKey]);   // foto lama slot yang sama
  return NextResponse.json({ ok: true, view: attached.view });
}
