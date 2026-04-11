import { UserMenu } from "./user-menu";

type HeaderProps = {
  userName: string;
  userEmail: string;
  userRole: string;
};

export function Header({ userName, userEmail, userRole }: HeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between
                       border-b bg-card px-6">
      {/* Kiri: bisa dipakai untuk breadcrumb di masa depan */}
      <div />

      {/* Kanan: user menu */}
      <UserMenu name={userName} email={userEmail} role={userRole} />
    </header>
  );
}
