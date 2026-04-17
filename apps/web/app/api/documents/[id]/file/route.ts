// GET /api/documents/[id]/file?slug={slug}&version={versionId}
// Stream file dokumen dari MinIO. Internal → wajib login + akses tenant. Public → bebas.

import { NextRequest } from "next/server";
import { createTenantDb } from "@jalajogja/db";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getTenantAccess } from "@/lib/tenant";
import { s3, tenantBucket } from "@/lib/minio";
import { GetObjectCommand } from "@aws-sdk/client-s3";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: docId } = await params;
  const slug      = req.nextUrl.searchParams.get("slug");
  const versionId = req.nextUrl.searchParams.get("version"); // opsional — override versi aktif

  if (!slug) {
    return Response.json({ error: "slug diperlukan" }, { status: 400 });
  }

  const { db, schema } = createTenantDb(slug);

  // Fetch dokumen
  const [doc] = await db
    .select({
      id:               schema.documents.id,
      visibility:       schema.documents.visibility,
      currentVersionId: schema.documents.currentVersionId,
    })
    .from(schema.documents)
    .where(eq(schema.documents.id, docId))
    .limit(1);

  if (!doc) {
    return Response.json({ error: "Dokumen tidak ditemukan" }, { status: 404 });
  }

  // Cek auth untuk dokumen internal
  if (doc.visibility === "internal") {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) {
      return Response.json({ error: "Login diperlukan" }, { status: 401 });
    }
    const access = await getTenantAccess(slug);
    if (!access) {
      return Response.json({ error: "Tidak punya akses ke tenant ini" }, { status: 403 });
    }
  }

  // Tentukan versi yang akan diambil
  const targetVersionId = versionId ?? doc.currentVersionId;
  if (!targetVersionId) {
    return Response.json({ error: "Dokumen belum punya file" }, { status: 404 });
  }

  // Fetch versi
  const [version] = await db
    .select({
      fileId:   schema.documentVersions.fileId,
      fileName: schema.documentVersions.fileName,
      mimeType: schema.documentVersions.mimeType,
    })
    .from(schema.documentVersions)
    .where(eq(schema.documentVersions.id, targetVersionId))
    .limit(1);

  if (!version || !version.fileId) {
    return Response.json({ error: "File tidak ditemukan" }, { status: 404 });
  }

  // Fetch path dari media table
  const [media] = await db
    .select({ path: schema.media.path })
    .from(schema.media)
    .where(eq(schema.media.id, version.fileId))
    .limit(1);

  if (!media) {
    return Response.json({ error: "File media tidak ditemukan" }, { status: 404 });
  }

  // Stream dari MinIO
  try {
    const command = new GetObjectCommand({
      Bucket: tenantBucket(slug),
      Key:    media.path,
    });

    const s3Res = await s3.send(command);
    if (!s3Res.Body) {
      return Response.json({ error: "File kosong" }, { status: 500 });
    }

    const contentType = version.mimeType ?? "application/octet-stream";
    const fileName    = encodeURIComponent(version.fileName);

    return new Response(s3Res.Body as ReadableStream, {
      headers: {
        "Content-Type":        contentType,
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Cache-Control":       doc.visibility === "public"
          ? "public, max-age=3600"
          : "private, no-cache",
      },
    });
  } catch (e) {
    console.error("dokumen file proxy:", e);
    return Response.json({ error: "Gagal mengambil file" }, { status: 500 });
  }
}
