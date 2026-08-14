"use client";

import { useMemo, useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { crearEntradaBitacora, actualizarEntradaBitacora, eliminarEntradaBitacora } from "@/lib/bitacora-actions";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { EntradaBitacoraConPersona } from "@/lib/bitacora";
import type { PersonaConNivel, TipoEntradaBitacora } from "@/lib/supabase/types";

const etiquetas: Record<TipoEntradaBitacora, string> = { nota: "Nota", hipotesis: "Hipótesis", duda: "Duda", hallazgo: "Hallazgo", tarea_pendiente: "Tarea pendiente", documento_pendiente: "Documento pendiente" };
const tipos = Object.keys(etiquetas) as TipoEntradaBitacora[];
type Edicion = { id?: string; tipo: TipoEntradaBitacora; contenido: string; persona_id: string } | null;

export function BitacoraClient({ entradas, personas }: { entradas: EntradaBitacoraConPersona[]; personas: PersonaConNivel[] }) {
  const [tipoFiltro, setTipoFiltro] = useState<"todas" | TipoEntradaBitacora>("todas");
  const [personaFiltro, setPersonaFiltro] = useState("");
  const [edicion, setEdicion] = useState<Edicion>(null);
  const [confirmarId, setConfirmarId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const filtradas = useMemo(() => entradas.filter((entrada) => (tipoFiltro === "todas" || entrada.tipo === tipoFiltro) && (!personaFiltro || entrada.persona_id === personaFiltro)), [entradas, tipoFiltro, personaFiltro]);
  const guardar = () => {
    if (!edicion) return;
    setError(null);
    startTransition(async () => {
      const input = { tipo: edicion.tipo, contenido: edicion.contenido, persona_id: edicion.persona_id || null };
      const resultado = edicion.id ? await actualizarEntradaBitacora(edicion.id, input) : await crearEntradaBitacora(input);
      if (resultado.error) { setError(resultado.error); return; }
      setEdicion(null);
    });
  };
  const eliminar = () => { if (!confirmarId) return; startTransition(async () => { const resultado = await eliminarEntradaBitacora(confirmarId); if (resultado.error) setError(resultado.error); setConfirmarId(null); }); };
  return <main className="mx-auto max-w-5xl px-5 py-7 sm:px-6 md:py-10"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="font-display text-3xl text-velvet">Bitácora</h1><p className="mt-2 text-sm text-ink/60">Cuaderno de trabajo de la investigación familiar.</p></div><button type="button" onClick={() => setEdicion({ tipo: "nota", contenido: "", persona_id: "" })} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-velvet px-4 py-2.5 text-sm font-medium text-white hover:bg-velvet/90"><Plus size={16} />Nueva entrada</button></div>
    <div className="mt-7 flex flex-col gap-3 rounded-2xl border border-border bg-sakura-paper p-4 shadow-sakura-card sm:flex-row"><select value={tipoFiltro} onChange={(event) => setTipoFiltro(event.target.value as "todas" | TipoEntradaBitacora)} className="campo sm:max-w-52"><option value="todas">Todos los tipos</option>{tipos.map((tipo) => <option key={tipo} value={tipo}>{etiquetas[tipo]}</option>)}</select><select value={personaFiltro} onChange={(event) => setPersonaFiltro(event.target.value)} className="campo sm:max-w-xs"><option value="">Todas las personas</option>{personas.map((persona) => <option key={persona.id} value={persona.id}>{persona.nombre} {persona.apellido}</option>)}</select></div>
    {error && <p className="mt-4 text-sm text-estado-incompleta" role="alert">{error}</p>}
    <div className="mt-5 space-y-3">{filtradas.map((entrada) => <article key={entrada.id} className="rounded-2xl border border-border bg-sakura-paper p-5 shadow-soft"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-medium uppercase tracking-[.14em] text-velvet/70">{etiquetas[entrada.tipo]}</p>{entrada.persona && <p className="mt-1 text-xs text-ink/55">{entrada.persona.nombre} {entrada.persona.apellido}</p>}</div><div className="flex gap-1"><button type="button" onClick={() => setEdicion({ id: entrada.id, tipo: entrada.tipo, contenido: entrada.contenido, persona_id: entrada.persona_id ?? "" })} className="rounded-lg p-1.5 text-ink/45 hover:bg-lavender/30 hover:text-velvet" aria-label="Editar entrada"><Pencil size={16} /></button><button type="button" onClick={() => setConfirmarId(entrada.id)} className="rounded-lg p-1.5 text-ink/45 hover:bg-estado-incompleta/10 hover:text-estado-incompleta" aria-label="Eliminar entrada"><Trash2 size={16} /></button></div></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-ink/80">{entrada.contenido}</p></article>)}{filtradas.length === 0 && <p className="rounded-2xl border border-dashed border-border bg-sakura-paper px-5 py-12 text-center text-sm text-ink/55">Todavía no hay entradas con estos filtros.</p>}</div>
    {edicion && <Editor edicion={edicion} personas={personas} pendiente={pendiente} onCambiar={setEdicion} onCancelar={() => setEdicion(null)} onGuardar={guardar} />}{confirmarId && <ConfirmDialog abierto titulo="Eliminar entrada" descripcion="¿Querés eliminar esta entrada de la Bitácora?" confirmar="Eliminar entrada" pendiente={pendiente} onCancelar={() => setConfirmarId(null)} onConfirmar={eliminar} />}
  </main>;
}
function Editor({ edicion, personas, pendiente, onCambiar, onCancelar, onGuardar }: { edicion: NonNullable<Edicion>; personas: PersonaConNivel[]; pendiente: boolean; onCambiar: (edicion: Edicion) => void; onCancelar: () => void; onGuardar: () => void }) { return <div className="fixed inset-0 z-30 flex items-end bg-ink/30 sm:items-center sm:justify-center sm:p-5" onClick={onCancelar}><form onSubmit={(event) => { event.preventDefault(); onGuardar(); }} onClick={(event) => event.stopPropagation()} className="w-full rounded-t-2xl border border-border bg-sakura-paper p-5 shadow-sakura-float sm:max-w-xl sm:rounded-2xl sm:p-6"><h2 className="font-display text-2xl text-velvet">{edicion.id ? "Editar entrada" : "Nueva entrada"}</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm text-ink/70">Tipo<select value={edicion.tipo} onChange={(event) => onCambiar({ ...edicion, tipo: event.target.value as TipoEntradaBitacora })} className="campo mt-1.5">{tipos.map((tipo) => <option key={tipo} value={tipo}>{etiquetas[tipo]}</option>)}</select></label><label className="text-sm text-ink/70">Persona asociada<select value={edicion.persona_id} onChange={(event) => onCambiar({ ...edicion, persona_id: event.target.value })} className="campo mt-1.5"><option value="">Sin asociar</option>{personas.map((persona) => <option key={persona.id} value={persona.id}>{persona.nombre} {persona.apellido}</option>)}</select></label></div><label className="mt-4 block text-sm text-ink/70">Contenido<textarea required rows={7} value={edicion.contenido} onChange={(event) => onCambiar({ ...edicion, contenido: event.target.value })} className="campo mt-1.5 resize-y" autoFocus /></label><div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={onCancelar} className="boton-secundario">Cancelar</button><button disabled={pendiente} className="rounded-xl bg-velvet px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{pendiente ? "Guardando…" : "Guardar entrada"}</button></div></form></div>; }
