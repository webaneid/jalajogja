import { db, platformUsers } from "@jalajogja/db";
import { desc } from "drizzle-orm";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PlatformUserActions } from "@/components/platform/user-actions";

export default async function PlatformUsersPage() {
  const users = await db
    .select()
    .from(platformUsers)
    .orderBy(desc(platformUsers.createdAt));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Tim Platform</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{users.length} pengguna</p>
        </div>
        <Link
          href="/platform/users/new"
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus size={15} /> Tambah
        </Link>
      </div>

      <div className="rounded-xl border border-border bg-background overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs text-muted-foreground">
            <tr>
              <th className="text-left px-5 py-2.5 font-medium">Nama</th>
              <th className="text-left px-5 py-2.5 font-medium">Email</th>
              <th className="text-left px-5 py-2.5 font-medium">Role</th>
              <th className="text-left px-5 py-2.5 font-medium">Status</th>
              <th className="text-left px-5 py-2.5 font-medium">Login Terakhir</th>
              <th className="px-5 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">
                  Belum ada pengguna platform.
                </td>
              </tr>
            ) : users.map((u) => (
              <tr key={u.id} className="hover:bg-muted/20">
                <td className="px-5 py-3 font-medium">{u.name}</td>
                <td className="px-5 py-3 text-muted-foreground">{u.email}</td>
                <td className="px-5 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                    u.role === "owner" ? "bg-purple-100 text-purple-700"
                    : u.role === "admin" ? "bg-blue-100 text-blue-700"
                    : "bg-muted text-muted-foreground"
                  }`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    u.isActive ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
                  }`}>
                    {u.isActive ? "Aktif" : "Non-aktif"}
                  </span>
                </td>
                <td className="px-5 py-3 text-xs text-muted-foreground">
                  {u.lastLoginAt
                    ? u.lastLoginAt.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
                    : "Belum pernah"}
                </td>
                <td className="px-5 py-3">
                  <PlatformUserActions userId={u.id} isActive={u.isActive} role={u.role as "owner" | "admin" | "staff"} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
