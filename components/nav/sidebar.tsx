"use client";

import Link from "next/link";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { navLinks } from "./nav-links";

// Decoración gráfica y estática del sidebar. Vive detrás del contenido y
// usa exclusivamente la paleta Sakura compartida; no participa de la
// navegación ni de ninguna lógica.
function SidebarSakuraDecor() {
  return (
    <svg
      viewBox="0 0 224 800"
      preserveAspectRatio="xMidYMid slice"
      className="sidebar-sakura-decor"
      aria-hidden="true"
    >
      <defs>
        <g id="sidebar-sakura-flor" fill="currentColor">
          <circle cx="20" cy="10" r="8" />
          <circle cx="28" cy="16" r="8" />
          <circle cx="25" cy="26" r="8" />
          <circle cx="15" cy="26" r="8" />
          <circle cx="12" cy="16" r="8" />
        </g>
        <ellipse id="sidebar-sakura-petalo" cx="0" cy="0" rx="3" ry="7" fill="currentColor" />
      </defs>
      <path
        d="M118 -20 C 103 48, 128 104, 110 166 C 96 218, 120 276, 106 334 C 92 390, 115 454, 101 516 C 88 575, 111 649, 96 820"
        className="sidebar-sakura-rama"
        fill="none"
      />
      <path d="M110 166 C 88 146, 68 139, 45 141 M106 334 C 134 310, 158 303, 184 307 M101 516 C 78 495, 54 490, 29 496 M99 635 C 126 610, 151 606, 178 617" className="sidebar-sakura-ramita" fill="none" />

      <use href="#sidebar-sakura-flor" className="sidebar-sakura-flor-rosa" transform="translate(17,120) scale(0.54) rotate(-12)" />
      <use href="#sidebar-sakura-flor" className="sidebar-sakura-flor-lavanda" transform="translate(45,133) scale(0.72) rotate(10)" />
      <use href="#sidebar-sakura-flor" className="sidebar-sakura-flor-gris" transform="translate(106,78) scale(0.5) rotate(-18)" />
      <use href="#sidebar-sakura-flor" className="sidebar-sakura-flor-rosa" transform="translate(149,283) scale(0.66) rotate(14)" />
      <use href="#sidebar-sakura-flor" className="sidebar-sakura-flor-lavanda" transform="translate(177,294) scale(0.48) rotate(-8)" />
      <use href="#sidebar-sakura-flor" className="sidebar-sakura-flor-gris" transform="translate(83,330) scale(0.48) rotate(18)" />
      <use href="#sidebar-sakura-flor" className="sidebar-sakura-flor-rosa" transform="translate(15,469) scale(0.68) rotate(-16)" />
      <use href="#sidebar-sakura-flor" className="sidebar-sakura-flor-lavanda" transform="translate(55,492) scale(0.46) rotate(9)" />
      <use href="#sidebar-sakura-flor" className="sidebar-sakura-flor-gris" transform="translate(137,592) scale(0.54) rotate(-10)" />
      <use href="#sidebar-sakura-flor" className="sidebar-sakura-flor-rosa" transform="translate(174,607) scale(0.68) rotate(14)" />
      <use href="#sidebar-sakura-flor" className="sidebar-sakura-flor-lavanda" transform="translate(83,702) scale(0.5) rotate(-16)" />

      <use href="#sidebar-sakura-petalo" className="sidebar-sakura-flor-rosa" transform="translate(36,254) rotate(34)" />
      <use href="#sidebar-sakura-petalo" className="sidebar-sakura-flor-lavanda" transform="translate(181,414) rotate(-28) scale(0.82)" />
      <use href="#sidebar-sakura-petalo" className="sidebar-sakura-flor-gris" transform="translate(63,620) rotate(22) scale(0.76)" />
      <use href="#sidebar-sakura-petalo" className="sidebar-sakura-flor-rosa" transform="translate(161,748) rotate(42) scale(0.86)" />
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
