"use client";

import Link from "next/link";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { navLinks } from "./nav-links";

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
    router.refresh();
  }

  return (
    <nav
      aria-label="Navegación principal"
      className="hidden md:fixed md:inset-y-0 md:left-0 md:flex md:w-56 md:flex-col md:border-r md:border-sakura-line md:bg-sakura-canvas md:px-4 md:py-8"
    >
      <div className="mb-8 rounded-2xl border border-sakura-line bg-sakura-lavender px-4 py-5 text-center shadow-sakura-panel">
        <span className="block font-brand text-4xl font-bold leading-[1.05] tracking-[-0.035em] text-sakura-plum">Árbol Biani</span>
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

      <div className="mt-auto">
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
