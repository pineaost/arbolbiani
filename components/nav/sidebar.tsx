"use client";

import Link from "next/link";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { navLinks } from "./nav-links";

// árbol-biani:sidebar-sakura-v1
// Decoración gráfica y estática (sin animación) del sidebar: una rama y
// pétalos de sakura usando la misma forma de cinco círculos superpuestos
// ya validada en el fondo del Árbol. Vive detrás del contenido (z-0); no
// participa de la navegación ni de ninguna lógica.
function SidebarSakuraDecor() {
  return (
    <svg
      viewBox="0 0 224 640"
      preserveAspectRatio="xMidYMid slice"
      className="sidebar-sakura-decor"
      aria-hidden="true"
    >
      <defs>
        <g id="sidebar-sakura-petalo">
          <circle cx="20" cy="10" r="8" />
          <circle cx="28" cy="16" r="8" />
          <circle cx="25" cy="26" r="8" />
          <circle cx="15" cy="26" r="8" />
          <circle cx="12" cy="16" r="8" />
        </g>
      </defs>
      <path
        d="M204 30 C 182 96, 214 168, 190 240 C 170 300, 202 366, 182 432 C 166 486, 196 546, 176 610"
        className="sidebar-sakura-rama"
        fill="none"
      />
      <use href="#sidebar-sakura-petalo" className="sidebar-sakura-flor sidebar-sakura-flor-a" transform="translate(176,58) scale(0.85)" />
      <use href="#sidebar-sakura-petalo" className="sidebar-sakura-flor sidebar-sakura-flor-b" transform="translate(150,140) scale(0.6) rotate(18)" />
      <use href="#sidebar-sakura-petalo" className="sidebar-sakura-flor sidebar-sakura-flor-c" transform="translate(196,236) scale(1.05) rotate(-12)" />
      <use href="#sidebar-sakura-petalo" className="sidebar-sakura-flor sidebar-sakura-flor-d" transform="translate(158,318) scale(0.5) rotate(8)" />
      <use href="#sidebar-sakura-petalo" className="sidebar-sakura-flor sidebar-sakura-flor-e" transform="translate(188,420) scale(0.8) rotate(-20)" />
      <use href="#sidebar-sakura-petalo" className="sidebar-sakura-flor sidebar-sakura-flor-f" transform="translate(150,498) scale(0.55) rotate(14)" />
      <use href="#sidebar-sakura-petalo" className="sidebar-sakura-flor sidebar-sakura-flor-g" transform="translate(182,588) scale(0.7) rotate(-6)" />
    </svg>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [saliendo, setSaliendo] = useState(false);
  const [errorSalida, setErrorSalida] = useState<string | null>(null);

  async function cerrarSesion() {
    setErrorSalida(null);
    setSaliendo(true);

    const { error } = await createClient().auth.signOut();

    if (error) {
      setErrorSalida("No se pudo cerrar la sesión. Intentá nuevamente.");
      setSaliendo(false);
      return;
    }

    router.replace("/login");
  }

  return (
    <nav
      aria-label="Navegación principal"
      className="sidebar-sakura-panel hidden md:fixed md:inset-y-0 md:left-0 md:z-20 md:flex md:w-56 md:flex-col md:overflow-hidden md:border-r md:border-sakura-line md:px-4 md:py-8"
    >
      <SidebarSakuraDecor />

      <div className="relative z-10 mb-8 rounded-2xl border border-sakura-line bg-sakura-lavender px-4 py-5 text-center shadow-sakura-panel">
        <span className="block font-brand text-4xl font-bold leading-[1.05] tracking-[-0.035em] text-sakura-plum">Árbol Biani</span>
      </div>

      <ul className="relative z-10 flex flex-col gap-1">
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

      <div className="relative z-10 mt-auto">
        {errorSalida && <p className="mb-2 px-3 text-xs text-estado-incompleta">{errorSalida}</p>}
        <button
          type="button"
          onClick={cerrarSesion}
          disabled={saliendo}
          aria-busy={saliendo}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-sakura-muted transition-[background-color,color,box-shadow] hover:bg-sakura-lavender hover:text-sakura-plum disabled:cursor-not-allowed disabled:opacity-50"
        >
          <LogOut size={18} strokeWidth={1.75} />
          {saliendo ? "Saliendo..." : "Salir"}
        </button>
      </div>
    </nav>
  );
}
