"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, X } from "lucide-react";
import { PersonaModal } from "./persona-modal";
import { PersonaListItem } from "./persona-list-item";
import { PersonaFichaClient } from "./persona-ficha-client";
import { obtenerFichaPersona } from "@/lib/relaciones-actions";
import { importarPersonasDesdeExcel } from "@/lib/importacion-excel-actions";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { NoticeDialog } from "@/components/ui/notice-dialog";
import type { PersonaConNivel, PersonaFicha } from "@/lib/supabase/types";

interface ArchivoClientProps {
  personas: PersonaConNivel[];
}

type EstadoModal =
  | { tipo: "crear" }
  | null;

export function ArchivoClient({ personas }: ArchivoClientProps) {
  const router = useRouter();
  const [modal, setModal] = useState<EstadoModal>(null);
  const [busqueda, setBusqueda] = useState("");
  const [fichaAbierta, setFichaAbierta] = useState<PersonaFicha | null>(null);
  const [abriendoFicha, startTransition] = useTransition();
  const [confirmarImportacion, setConfirmarImportacion] = useState(false);
  const [avisoImportacion, setAvisoImportacion] = useState<string | null>(null);
  const [importando, startImportacion] = useTransition();

  function abrirFicha(personaId: string) {
    startTransition(async () => {
      const ficha = await obtenerFichaPersona(personaId);
      setFichaAbierta(ficha);
    });
  }

  async function actualizarFichaAbierta(personaId: string) {
    const ficha = await obtenerFichaPersona(personaId);
    setFichaAbierta((actual) => actual?.id === personaId ? ficha : actual);
  }

  function confirmarCargaDesdeExcel() {
    startImportacion(async () => {
      const resultado = await importarPersonasDesdeExcel();
      setConfirmarImportacion(false);
      if (resultado.error) {
        setAvisoImportacion(resultado.error);
        return;
      }

      const conflictos = resultado.conflictos?.length
        ? ` ${resultado.conflictos.length} coincidencia${resultado.conflictos.length === 1 ? " quedó" : "s quedaron"} para revisión por tener el mismo nombre sin una fecha de nacimiento idéntica.`
        : "";
      setAvisoImportacion(`Importación terminada: ${resultado.importadas ?? 0} persona${resultado.importadas === 1 ? "" : "s"} nueva${resultado.importadas === 1 ? "" : "s"}, ${resultado.existentes ?? 0} ya existente${resultado.existentes === 1 ? "" : "s"} sin modificar.${conflictos}`);
      router.refresh();
    });
  }

  const personasFiltradas = useMemo(() => {
    const consulta = busqueda.trim().toLocaleLowerCase("es");
    if (!consulta) return personas;

    return personas.filter((persona) =>
      [
        persona.nombre,
        persona.apellido,
        persona.lugar_nacimiento,
        persona.lugar_fallecimiento,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("es")
        .includes(consulta)
    );
  }, [busqueda, personas]);

  return (
    <div className="mx-auto max-w-7xl px-5 py-7 sm:px-6 md:py-10">
      <div className="mb-7 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl text-velvet">Archivo Familiar</h1>
          <p className="mt-2 text-sm text-ink/60">
            {personas.length === 0
              ? "Empezá por registrar la primera persona de la familia."
              : `${personas.length} persona${personas.length === 1 ? "" : "s"} registrada${personas.length === 1 ? "" : "s"}.`}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => setConfirmarImportacion(true)}
            className="boton-secundario"
          >
            Importar desde Excel
          </button>
          <button
            onClick={() => setModal({ tipo: "crear" })}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-velvet px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-velvet/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-velvet focus-visible:ring-offset-2"
          >
            <Plus size={16} />
            Agregar persona
          </button>
        </div>
      </div>

      {personas.length > 0 && (
        <div className="relative mb-6 max-w-md">
          <Search
            size={17}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/40"
            aria-hidden="true"
          />
          <input
            type="search"
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Buscar por nombre o lugar"
            aria-label="Buscar personas por nombre o lugar"
            className="w-full rounded-xl border border-border bg-sakura-paper py-2.5 pl-9 pr-3 text-sm text-ink outline-none transition-colors placeholder:text-ink/40 focus:border-velvet focus:ring-2 focus:ring-lavender/50"
          />
        </div>
      )}

      {personasFiltradas.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {personasFiltradas.map((persona) => (
            <PersonaListItem
              key={persona.id}
              persona={persona}
              onAbrir={abrirFicha}
            />
          ))}
        </ul>
      ) : personas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-sakura-paper px-5 py-12 text-center text-sm text-ink/55">
          Todavía no hay fichas en el archivo.
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-sakura-paper px-5 py-12 text-center text-sm text-ink/55">
          No encontramos personas para “{busqueda.trim()}”.
        </div>
      )}

      {modal && (
        <PersonaModal
          key="crear"
          onCerrar={() => setModal(null)}
        />
      )}
      {confirmarImportacion && <ConfirmDialog abierto titulo="Importar personas desde el Excel" descripcion="Se crearán únicamente las personas propuestas en el archivo de revisión. No se modificarán fichas existentes ni se crearán vínculos, documentos o entradas de Bitácora." confirmar="Importar personas" pendiente={importando} onCancelar={() => setConfirmarImportacion(false)} onConfirmar={confirmarCargaDesdeExcel} />}
      {avisoImportacion && <NoticeDialog abierto titulo="Importación desde Excel" mensaje={avisoImportacion} onCerrar={() => setAvisoImportacion(null)} />}
      {fichaAbierta && <div className="fixed inset-0 z-20 bg-ink/25" onClick={() => setFichaAbierta(null)}><aside role="dialog" aria-modal="true" aria-label={`Ficha de ${fichaAbierta.nombre} ${fichaAbierta.apellido}`} onClick={(event) => event.stopPropagation()} className="absolute inset-y-0 right-0 w-full overflow-y-auto border-l border-border bg-background shadow-sakura-drawer sm:max-w-3xl"><button type="button" onClick={() => setFichaAbierta(null)} className="sticky top-4 z-10 float-right mr-4 rounded-lg border border-border bg-sakura-paper p-2 text-ink/50 shadow-soft hover:bg-lavender/30 hover:text-velvet" aria-label="Cerrar ficha"><X size={18} /></button><PersonaFichaClient persona={fichaAbierta} personas={personas} enDrawer onCerrar={() => setFichaAbierta(null)} onActualizarFicha={() => actualizarFichaAbierta(fichaAbierta.id)} /></aside></div>}
      {abriendoFicha && <div className="fixed inset-0 z-20 grid place-items-center bg-ink/20" aria-live="polite"><p className="rounded-xl border border-border bg-sakura-paper px-4 py-3 text-sm text-ink/65 shadow-soft">Abriendo ficha…</p></div>}
    </div>
  );
}
