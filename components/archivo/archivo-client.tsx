"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { PersonaModal } from "./persona-modal";
import { PersonaListItem } from "./persona-list-item";
import type { PersonaConNivel } from "@/lib/supabase/types";

interface ArchivoClientProps {
  personas: PersonaConNivel[];
}

type EstadoModal =
  | { tipo: "crear" }
  | { tipo: "editar"; persona: PersonaConNivel }
  | null;

export function ArchivoClient({ personas }: ArchivoClientProps) {
  const [modal, setModal] = useState<EstadoModal>(null);

  return (
    <div className="px-6 py-8 md:py-10 max-w-2xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-1">
        <h1 className="font-display text-2xl text-velvet">
          Archivo Familiar
        </h1>

        <button
          onClick={() => setModal({ tipo: "crear" })}
          className="flex items-center gap-1.5 rounded-xl bg-velvet px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          <Plus size={16} />
          Agregar persona
        </button>
      </div>

      <p className="text-sm text-ink/60 mb-8">
        {personas.length === 0
          ? "Todavía no hay personas cargadas."
          : `${personas.length} persona${personas.length === 1 ? "" : "s"} registrada${personas.length === 1 ? "" : "s"}.`}
      </p>

      <ul className="flex flex-col gap-2">
  {personas.map((persona) => (
    <PersonaListItem
      key={persona.id}
      persona={persona}
      onEditar={(p) => setModal({ tipo: "editar", persona: p })}
    />
  ))}
</ul>

      {modal && (
        <PersonaModal
          key={modal.tipo === "editar" ? modal.persona.id : "crear"}
          persona={modal.tipo === "editar" ? modal.persona : undefined}
          onCerrar={() => setModal(null)}
        />
      )}
    </div>
  );
}
