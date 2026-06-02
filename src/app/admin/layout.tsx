import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import NavLink from "@/components/NavLink";
import LogoutButton from "@/components/LogoutButton";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/scan");

  return (
    <div className="min-h-screen">
      <header className="bg-gu-navy">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <div className="flex items-center gap-2 pr-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gu-gold text-sm font-bold text-gu-navy">
              GU
            </span>
            <span className="font-semibold text-white">Graduation Admin</span>
          </div>
          <nav className="flex flex-wrap items-center gap-1">
            <NavLink href="/admin">Dashboard</NavLink>
            <NavLink href="/admin/students">Students &amp; Tickets</NavLink>
            <NavLink href="/admin/import">Import</NavLink>
            <NavLink href="/admin/reports">Reports</NavLink>
            <NavLink href="/scan">Scanner</NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-gu-light sm:inline">{user.name}</span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
