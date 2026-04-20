import { getTenantAccess } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { createTenantDb } from "@jalajogja/db";
import { desc, eq } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { MarkReadButton } from "./mark-read-button";

export default async function PesanPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) redirect("/login");

  const { db, schema } = createTenantDb(slug);

  const submissions = await db
    .select({
      id:        schema.contactSubmissions.id,
      pageId:    schema.contactSubmissions.pageId,
      name:      schema.contactSubmissions.name,
      email:     schema.contactSubmissions.email,
      phone:     schema.contactSubmissions.phone,
      message:   schema.contactSubmissions.message,
      isRead:    schema.contactSubmissions.isRead,
      createdAt: schema.contactSubmissions.createdAt,
      pageTitle: schema.pages.title,
    })
    .from(schema.contactSubmissions)
    .leftJoin(schema.pages, eq(schema.pages.id, schema.contactSubmissions.pageId))
    .orderBy(desc(schema.contactSubmissions.createdAt))
    .limit(100);

  const unreadCount = submissions.filter((s) => !s.isRead).length;

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-xl font-semibold">Pesan Masuk</h1>
        {unreadCount > 0 && (
          <Badge variant="default">{unreadCount} belum dibaca</Badge>
        )}
      </div>

      {submissions.length === 0 ? (
        <div className="border-2 border-dashed rounded-xl py-16 text-center text-muted-foreground">
          Belum ada pesan dari halaman kontak.
        </div>
      ) : (
        <div className="space-y-3">
          {submissions.map((s) => (
            <div
              key={s.id}
              className={`border rounded-xl p-4 space-y-2 transition-colors ${s.isRead ? "bg-background" : "bg-primary/5 border-primary/30"}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{s.name}</span>
                    {!s.isRead && <Badge variant="default" className="text-[10px] px-1.5 py-0">Baru</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 space-x-3">
                    {s.email && <span>📧 {s.email}</span>}
                    {s.phone && <span>📞 {s.phone}</span>}
                    <span>
                      dari halaman <em>{s.pageTitle ?? "—"}</em>
                    </span>
                    <span>·</span>
                    <span>
                      {new Intl.DateTimeFormat("id-ID", {
                        day: "numeric", month: "short", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      }).format(s.createdAt)}
                    </span>
                  </div>
                </div>
                {!s.isRead && (
                  <MarkReadButton slug={slug} id={s.id} />
                )}
              </div>
              <p className="text-sm text-foreground/80 whitespace-pre-wrap">{s.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
