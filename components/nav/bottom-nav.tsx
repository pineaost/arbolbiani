"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navLinks } from "./nav-links";

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegación principal"
      className="md:hidden fixed inset-x-0 bottom-0 z-10 flex items-stretch justify-around border-t border-border bg-sakura-paper px-2 py-1.5 shadow-sakura-panel"
      style={{ paddingBottom: "max(0.375rem, env(safe-area-inset-bottom))" }}
    >
      {navLinks.map(({ href, label, icon: Icon, principal }) => {
        const activo = pathname.startsWith(href);

        return (
          <Link
            key={href}
            href={href}
            className={[
              "flex flex-col items-center gap-1 rounded-xl px-4 py-1.5 text-xs transition-colors",
              activo ? "text-velvet" : "text-ink/60",
            ].join(" ")}
          >
            <Icon size={principal ? 24 : 20} strokeWidth={activo ? 2 : 1.75} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
