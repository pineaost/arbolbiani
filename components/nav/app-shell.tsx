"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { BottomNav } from "./bottom-nav";

const RUTAS_SIN_NAV = ["/login"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const sinNav = RUTAS_SIN_NAV.some((ruta) => pathname.startsWith(ruta));

  if (sinNav) {
    return <main className="min-h-screen">{children}</main>;
  }

  return (
    <>
      <Sidebar />
      <main className="md:pl-56 pb-16 md:pb-0 min-h-screen">{children}</main>
      <BottomNav />
    </>
  );
}
