"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navLinks } from "./nav-links";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegación principal"
      className="hidden md:fixed md:inset-y-0 md:left-0 md:flex md:w-56 md:flex-col md:border-r md:border-sakura-line md:bg-sakura-canvas md:px-4 md:py-8"
    >
      <div className="mb-8 rounded-2xl border border-sakura-line bg-sakura-paper px-3.5 py-3.5 shadow-sakura-panel">
        <span className="block font-display text-base font-semibold tracking-[.08em] text-sakura-plum">Árbol Biani</span>
      </div>

      <ul className="flex flex-col gap-1">
        {navLinks.map(({ href, label, icon: Icon, principal }) => {
          const activo = pathname.startsWith(href);

          return (
            <li key={href}>
              <Link
                href={href}
                className={[
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-[background-color,color,box-shadow]",
                  principal ? "font-medium" : "font-normal",
                  activo
                    ? "bg-sakura-petal text-sakura-plum shadow-sakura-card"
                    : "text-sakura-muted hover:bg-sakura-lavender hover:text-sakura-plum",
                ].join(" ")}
              >
                <Icon size={principal ? 20 : 18} strokeWidth={1.75} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
