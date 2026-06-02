import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import NavLink from "@/components/NavLink";
import LogoutButton from "@/components/LogoutButton";

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen">
      <header className="bg-gu-navy">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-3 px-4 py-3">
          <Link href="/scan" className="flex items-center gap-2 pr-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gu-gold text-sm font-bold text-gu-navy">
              GU
            </span>
            <span className="font-semibold text-white">Gate Check-in</span>
          </Link>
          <nav className="flex items-center gap-1">
            <NavLink href="/scan">Scanner</NavLink>
            <NavLink href="/search">Manual Search</NavLink>
            {user.role === "admin" && <NavLink href="/admin">Admin</NavLink>}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-gu-light sm:inline">{user.name}</span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
    </div>
  );
}
