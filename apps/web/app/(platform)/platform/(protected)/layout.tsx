import { redirect } from "next/navigation";
import { getPlatformSession } from "@/lib/platform-auth";
import { PlatformSidebar } from "@/components/platform/sidebar";
import { PlatformHeader }  from "@/components/platform/header";

export const metadata = { title: "Platform Admin — jalakarta" };

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getPlatformSession();
  if (!session) redirect("/platform/login");

  return (
    <div className="flex h-screen overflow-hidden bg-muted/20">
      <PlatformSidebar role={session.role} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <PlatformHeader name={session.name} email={session.email} role={session.role} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
