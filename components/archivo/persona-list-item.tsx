"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { eliminarPersona } from "@/lib/personas-actions";
import { NivelInformacionBadge } from "./nivel-informacion-badge";
import type { PersonaConNivel } from "@/lib/supabase/types";

interface PersonaListItemProps {
  persona: PersonaConNivel;
  onEditar: (persona: PersonaConNivel) => void;
}

export function PersonaListItem({ persona, onEditar }: PersonaListItemProps) {
  const [confirmando, setConfirmando] = useState(false);
  const [pendiente, startTransition] = useTransition();

  function handleEliminar() {
    startTransition(async () => {
      const resultado = await eliminarPersona(persona.id);
      if (resultado.error) {
        window.alert(resultado.error);
        setConfirmando(false);
      }
    });
  }

  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-border bg-white px-4 py-3 shadow-soft">
      <div className="flex items-center gap-2 min-w-0">
        <Link href={`/archivo/${persona.id}`} className="text-sm text-ink truncate hover:text-velvet hover:underline">
          {persona.nombre} {persona.apellido}
        </Link>
        <NivelInformacionBadge nivel={persona.nivel_informacion} />
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {confirmando ? (
          <>
            <button
              onClick={handleEliminar}
              disabled={pendiente}
              className="text-xs rounded-lg px-2 py-1 text-white bg-estado-incompleta hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {pendiente ? "..." : "Confirmar"}
            </button>
            <button
              onClick={() => setConfirmando(false)}
              disabled={pendiente}
              className="text-xs rounded-lg px-2 py-1 text-ink/60 hover:text-ink transition-colors"
            >
              Cancelar
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => onEditar(persona)}
              aria-label="Editar"
              className="text-ink/40 hover:text-velvet transition-colors p-1"
            >
              <Pencil size={16} />
            </button>
            <button
              onClick={() => setConfirmando(true)}
              aria-label="Eliminar"
              className="text-ink/40 hover:text-estado-incompleta transition-colors p-1"
            >
              <Trash2 size={16} />
            </button>
          </>
        )}
      </div>
    </li>
  );
}
