"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";
import {
  agregarConyuge,
  agregarFiliacion,
  actualizarConyuge,
  eliminarConyuge,
  eliminarFiliacion,
} from "@/lib/relaciones-actions";
import { NivelInformacionBadge } from "./nivel-informacion-badge";
import type { PersonaConNivel, PersonaFicha } from "@/lib/supabase/types";

interface Props {
  persona: PersonaFicha;
  personas: PersonaConNivel[];
}

function nombreCompleto(persona: { nombre: string; apellido: string }) {
  return `${persona.nombre} ${persona.apellido}`;
}

function fechaVisible(fecha: string | null) {
  if (!fecha) return null;
  const [anio, mes, dia] = fecha.split("-");
  return `${dia}/${mes}/${anio}`;
}

export function PersonaFichaClient({ persona, personas }: Props) {
  const router = useRouter();
  const [personaElegida, setPersonaElegida] = useState("");
  const [conyugeElegido, setConyugeElegido] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [notasConyuge, setNotasConyuge] = useState("");
  const [conyugeEditando, setConyugeEditando] = useState<PersonaFicha["conyuges"][number] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const opciones = personas.filter((p) => p.id !== persona.id);

  function ejecutar(tarea: () => Promise<{ error: string | null }>) {
    setError(null);
    startTransition(async () => {
      const resultado = await tarea();
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      setPersonaElegida("");
      setConyugeElegido("");
      setFechaInicio("");
      setFechaFin("");
      setNotasConyuge("");
      setConyugeEditando(null);
      router.refresh();
    });
  }

  function eliminar(etiqueta: string, tarea: () => Promise<{ error: string | null }>) {
    if (window.confirm(`¿Eliminar el vínculo con ${etiqueta}?`)) ejecutar(tarea);
  }

  function editarConyuge(vinculo: PersonaFicha["conyuges"][number]) {
    setConyugeEditando(vinculo);
    setConyugeElegido(vinculo.conyuge.id);
    setFechaInicio(vinculo.fecha_inicio ?? "");
    setFechaFin(vinculo.fecha_fin ?? "");
    setNotasConyuge(vinculo.notas ?? "");
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-8 md:py-10">
      <Link href="/archivo" className="mb-6 inline-flex items-center gap-1.5 text-sm text-ink/60 hover:text-velvet">
        <ArrowLeft size={16} /> Volver al Archivo Familiar
      </Link>

      <section className="rounded-2xl border border-border bg-white p-6 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-sm text-ink/55">Ficha de persona</p>
            <h1 className="font-display text-3xl text-velvet">{nombreCompleto(persona)}</h1>
          </div>
          <NivelInformacionBadge nivel={persona.nivel_informacion} />
        </div>
        <div className="mt-6 grid gap-4 text-sm text-ink/75 sm:grid-cols-2">
          <Dato etiqueta="Nacimiento" valor={[fechaVisible(persona.fecha_nacimiento), persona.lugar_nacimiento].filter(Boolean).join(" · ")} />
          <Dato etiqueta="Fallecimiento" valor={[fechaVisible(persona.fecha_fallecimiento), persona.lugar_fallecimiento].filter(Boolean).join(" · ")} />
        </div>
        {persona.notas && <p className="mt-5 border-l-2 border-lavender pl-3 text-sm leading-6 text-ink/70">{persona.notas}</p>}
      </section>

      <p className="mt-4 min-h-5 text-sm text-estado-incompleta" role="alert">{error}</p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <RelacionCard titulo="Padres / madres" descripcion="Personas registradas como progenitores.">
          <ListaVinculos vinculos={persona.padres} onEliminar={(v) => eliminar(nombreCompleto(v.persona), () => eliminarFiliacion(v.id))} />
          <FormularioPersona
            valor={personaElegida}
            onCambio={setPersonaElegida}
            opciones={opciones}
            etiqueta="Agregar padre o madre"
            pendiente={pendiente}
            onAgregar={() => ejecutar(() => agregarFiliacion({ padre_id: personaElegida, hijo_id: persona.id }))}
          />
        </RelacionCard>

        <RelacionCard titulo="Hijos / hijas" descripcion="Personas para las que figura como progenitor/a.">
          <ListaVinculos vinculos={persona.hijos} onEliminar={(v) => eliminar(nombreCompleto(v.persona), () => eliminarFiliacion(v.id))} />
          <FormularioPersona
            valor={personaElegida}
            onCambio={setPersonaElegida}
            opciones={opciones}
            etiqueta="Agregar hijo o hija"
            pendiente={pendiente}
            onAgregar={() => ejecutar(() => agregarFiliacion({ padre_id: persona.id, hijo_id: personaElegida }))}
          />
        </RelacionCard>
      </div>

      <RelacionCard titulo="Cónyuges / parejas" descripcion="Podés registrar fechas y una nota opcionales.">
        <ul className="mb-4 divide-y divide-border">
          {persona.conyuges.map((vinculo) => (
            <li key={vinculo.id} className="flex items-start justify-between gap-3 py-3 first:pt-0">
              <div>
                <p className="text-sm text-ink">{nombreCompleto(vinculo.conyuge)}</p>
                {(vinculo.fecha_inicio || vinculo.fecha_fin || vinculo.notas) && <p className="mt-1 text-xs leading-5 text-ink/55">{[vinculo.fecha_inicio && `Desde ${fechaVisible(vinculo.fecha_inicio)}`, vinculo.fecha_fin && `hasta ${fechaVisible(vinculo.fecha_fin)}`, vinculo.notas].filter(Boolean).join(" · ")}</p>}
              </div>
              <div className="flex shrink-0 gap-1"><button onClick={() => editarConyuge(vinculo)} className="p-1 text-ink/40 hover:text-velvet" aria-label={`Editar vínculo con ${nombreCompleto(vinculo.conyuge)}`}><Pencil size={15} /></button><button onClick={() => eliminar(nombreCompleto(vinculo.conyuge), () => eliminarConyuge(vinculo.id))} className="p-1 text-ink/40 hover:text-estado-incompleta" aria-label={`Eliminar vínculo con ${nombreCompleto(vinculo.conyuge)}`}><Trash2 size={16} /></button></div>
            </li>
          ))}
          {persona.conyuges.length === 0 && <li className="pb-3 text-sm text-ink/45">Todavía no hay vínculos cargados.</li>}
        </ul>
        <div className="grid gap-3 sm:grid-cols-2">
          <select value={conyugeElegido} onChange={(e) => setConyugeElegido(e.target.value)} disabled={!!conyugeEditando} className="campo disabled:cursor-not-allowed disabled:opacity-60">
            <option value="">Elegir persona</option>
            {opciones.map((opcion) => <option key={opcion.id} value={opcion.id}>{nombreCompleto(opcion)}</option>)}
          </select>
          <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className="campo" aria-label="Fecha de inicio" />
          <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} className="campo" aria-label="Fecha de fin" />
          <input value={notasConyuge} onChange={(e) => setNotasConyuge(e.target.value)} placeholder="Nota opcional" className="campo" />
        </div>
        <div className="mt-3 flex items-center gap-3"><button disabled={!conyugeElegido || pendiente} onClick={() => conyugeEditando ? ejecutar(() => actualizarConyuge(conyugeEditando.id, { fecha_inicio: fechaInicio || null, fecha_fin: fechaFin || null, notas: notasConyuge.trim() || null })) : ejecutar(() => agregarConyuge({ persona1_id: persona.id, persona2_id: conyugeElegido, fecha_inicio: fechaInicio || null, fecha_fin: fechaFin || null, notas: notasConyuge.trim() || null }))} className="boton-secundario">{conyugeEditando ? <Pencil size={15} /> : <Plus size={15} />}{conyugeEditando ? "Guardar cambios" : "Agregar vínculo"}</button>{conyugeEditando && <button onClick={() => { setConyugeEditando(null); setConyugeElegido(""); setFechaInicio(""); setFechaFin(""); setNotasConyuge(""); }} className="text-sm text-ink/60 hover:text-velvet">Cancelar</button>}</div>
      </RelacionCard>
    </main>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return <div><p className="text-xs uppercase tracking-wide text-ink/45">{etiqueta}</p><p className="mt-1">{valor || "Sin datos"}</p></div>;
}

function RelacionCard({ titulo, descripcion, children }: { titulo: string; descripcion: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-border bg-white p-5 shadow-soft"><h2 className="font-display text-lg text-velvet">{titulo}</h2><p className="mt-1 text-xs leading-5 text-ink/55">{descripcion}</p><div className="mt-4">{children}</div></section>;
}

function ListaVinculos({ vinculos, onEliminar }: { vinculos: PersonaFicha["padres"]; onEliminar: (vinculo: PersonaFicha["padres"][number]) => void }) {
  return <ul className="mb-4 divide-y divide-border">{vinculos.map((vinculo) => <li key={vinculo.id} className="flex items-center justify-between gap-3 py-2 first:pt-0"><Link href={`/archivo/${vinculo.persona.id}`} className="text-sm text-ink hover:text-velvet hover:underline">{nombreCompleto(vinculo.persona)}</Link><button onClick={() => onEliminar(vinculo)} className="p-1 text-ink/40 hover:text-estado-incompleta" aria-label={`Eliminar vínculo con ${nombreCompleto(vinculo.persona)}`}><Trash2 size={16} /></button></li>)}{vinculos.length === 0 && <li className="pb-3 text-sm text-ink/45">Todavía no hay vínculos cargados.</li>}</ul>;
}

function FormularioPersona({ valor, onCambio, opciones, etiqueta, pendiente, onAgregar }: { valor: string; onCambio: (valor: string) => void; opciones: PersonaConNivel[]; etiqueta: string; pendiente: boolean; onAgregar: () => void }) {
  return <div className="flex gap-2"><select value={valor} onChange={(e) => onCambio(e.target.value)} className="campo min-w-0 flex-1"><option value="">Elegir persona</option>{opciones.map((opcion) => <option key={opcion.id} value={opcion.id}>{nombreCompleto(opcion)}</option>)}</select><button disabled={!valor || pendiente} onClick={onAgregar} className="boton-secundario shrink-0" aria-label={etiqueta}><Plus size={15} /><span className="hidden sm:inline">Agregar</span></button></div>;
}
