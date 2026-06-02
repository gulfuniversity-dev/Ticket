"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const path = usePathname();
  const active = path === href || (href !== "/admin" && path.startsWith(href));
  return (
    <Link
      href={href}
      className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
        active ? "bg-white/15 text-white" : "text-gu-light hover:bg-white/10 hover:text-white"
      }`}
    >
      {children}
    </Link>
  );
}
