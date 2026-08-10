"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navLinks } from "./nav-links";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegación principal"
      className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:left-0 md:w-56 md:border-r md:border-border md:bg-background md:py-8 md:px-4"
    >
      <span className="font-display text-lg text-velvet px-2 mb-8">
        Árbol Familiar
      </span>

      <ul className="flex flex-col gap-1">
        {navLinks.map(({ href, label, icon: Icon, principal }) => {
          const activo = pathname.startsWith(href);

          return (
            <li key={href}>
              <Link
                href={href}
                className={[
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                  principal ? "font-medium" : "font-normal",
                  activo
                    ? "bg-lavender/50 text-velvet"
                    : "text-ink/70 hover:bg-lavender/25 hover:text-velvet",
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
