"use client";

import Link from "next/link";
import { Minus, Move, Plus, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import { SakuraBackdrop } from "@/components/arbol/sakura-backdrop";
import { FiltroFamilias } from "@/components/arbol/filtro-familias";
import { filtrarModeloArbol, obtenerFamiliasArbol } from "@/lib/arbol-filtro";
import {
  calcularLayoutArbol,
  crearModeloArbol,
  crearMarcosParejaArbol,
  diagnosticarLayoutArbol,
  diagnosticarGeometriaArbol,
  diagnosticarModeloArbol,
  diagnosticarVinculosVisualesArbol,
  GEOMETRIA_ARBOL,
} from "@/lib/arbol-chart";
import type { NodoPosicionadoArbol, ModeloArbol } from "@/lib/arbol-chart";
import type { PersonaArbol } from "@/lib/supabase/types";

interface Props { personas: PersonaArbol[]; }
interface VistaMapa { x: number; y: number; escala: number; }
interface ArrastreMapa { pointerId: number; inicioX: number; inicioY: number; vistaX: number; vistaY: number; }

function nombreCompleto(persona: PersonaArbol) { return `${persona.nombre} ${persona.apellido}`.trim(); }
function anios(persona: PersonaArbol) { return [persona.fecha_nacimiento?.slice(0, 4), persona.fecha_fallecimiento?.slice(0, 4)].filter(Boolean).join(" — "); }
function lugarPrincipal(persona: PersonaArbol) { return persona.lugar_nacimiento ?? persona.lugar_fallecimiento ?? null; }
function limitar(valor: number, minimo: number, maximo: number) { return Math.min(maximo, Math.max(minimo, valor)); }

const variablesGeometriaArbol = {
  "--arbol-nodo-ancho": `${GEOMETRIA_ARBOL.anchoNodo}px`,
  "--arbol-nodo-alto": `${GEOMETRIA_ARBOL.altoNodo}px`,
} as CSSProperties;

export function ArbolClient({ personas }: Props) {
  const modeloArbol = useMemo(() => crearModeloArbol(personas), [personas]);
  if (modeloArbol.problemas.length) return <div role="alert" className="m-6 rounded-xl border border-border bg-white p-6">
    <h1 className="font-display text-2xl text-velvet">Hay relaciones que necesitan revisión</h1>
    <p className="mt-3 text-sm text-ink/70">No se puede generar un árbol coherente con estos datos. Revisá las filiaciones de las personas indicadas en Archivo Familiar.</p>
    <ul className="mt-3 list-inside list-disc text-sm text-ink/70">{modeloArbol.problemas.map((p,i)=><li key={i}>{[...new Set(p.ids)].map(id=>modeloArbol.personas.get(id)).filter((p):p is PersonaArbol=>!!p).map(nombreCompleto).join(" · ")}</li>)}</ul>
    <Link href="/archivo" className="mt-4 inline-block text-sm text-velvet underline">Abrir Archivo Familiar</Link>
  </div>;
  return <MapaArbol personas={personas} modeloArbol={modeloArbol} />;
}

function MapaArbol({ personas: personasCompletas, modeloArbol: modeloCompleto }: Props & { modeloArbol: ModeloArbol }) {
  const familias = useMemo(() => obtenerFamiliasArbol(modeloCompleto), [modeloCompleto]);
  const [familiasOcultas, setFamiliasOcultas] = useState<Set<string>>(() => new Set());
  const familiasActivas = useMemo(() => new Set(familias.filter(f => !familiasOcultas.has(f.id)).map(f => f.id)), [familias, familiasOcultas]);
  const modeloArbol = useMemo(() => filtrarModeloArbol(modeloCompleto, familias, familiasActivas), [modeloCompleto, familias, familiasActivas]);
  const personas = useMemo(() => modeloArbol === modeloCompleto ? personasCompletas : [...modeloArbol.personas.values()], [modeloArbol, modeloCompleto, personasCompletas]);
  const contenedorRef = useRef<HTMLDivElement | null>(null);
  const vistaRef = useRef<VistaMapa>({ x: 0, y: 0, escala: 1 });
  const arrastreRef = useRef<ArrastreMapa | null>(null);
  const [vista, setVista] = useState<VistaMapa>(vistaRef.current);
  const [personaSeleccionadaId, setPersonaSeleccionadaId] = useState<string | null>(null);
  const layout = useMemo(() => calcularLayoutArbol(modeloArbol), [modeloArbol]);
  const vinculosVisuales = useMemo(() => layout.trazos.map(({ vinculo }) => vinculo), [layout]);
  const personaPorId = useMemo(() => new Map(personas.map((persona) => [persona.id, persona])), [personas]);
  const personaSeleccionada = personaSeleccionadaId ? personaPorId.get(personaSeleccionadaId) ?? null : null;
  const nodosParaTrazado = useMemo<NodoPosicionadoArbol[]>(() => layout.nodos.map((nodo) => ({
    data: { id: nodo.id, data: {} },
    x: nodo.x,
    y: nodo.y,
  })), [layout]);
  const trazos = layout.trazos;
  const marcosPareja = useMemo(() => crearMarcosParejaArbol(modeloArbol, layout), [modeloArbol, layout]);
  const unidadSeleccionada = useMemo(() => new Set(personaSeleccionadaId
    ? [personaSeleccionadaId, ...modeloArbol.conyugesPorPersona.get(personaSeleccionadaId) ?? []]
    : []), [personaSeleccionadaId, modeloArbol]);
  const detalleZoom = vista.escala < 0.08 ? "extremo" : vista.escala < 0.22 ? "lejos" : vista.escala < 0.65 ? "medio" : "cerca";
  // Primero se retiran las fechas; el nombre sólo se desvanece entre 8% y 4%.
  // La ficha y su área interactiva conservan las dimensiones del layout.
  const opacidadAnios = limitar((vista.escala - 0.45) / 0.2, 0, 1);
  const opacidadNombre = limitar((vista.escala - 0.04) / 0.04, 0, 1);

  const cambiarFamilias = (activas: Set<string>) => {
    setFamiliasOcultas(new Set(familias.filter(f => !activas.has(f.id)).map(f => f.id)));
    setPersonaSeleccionadaId(null);
    arrastreRef.current = null;
  };

  const actualizarVista = useCallback((siguiente: VistaMapa) => {
    vistaRef.current = siguiente;
    setVista(siguiente);
  }, []);

  const ajustarVistaCompleta = useCallback(() => {
    const contenedor = contenedorRef.current;
    if (!contenedor || layout.ancho === 0 || layout.alto === 0) return;
    const rect = contenedor.getBoundingClientRect();
    const espacio = familiasOcultas.size ? 80 : 48;
    const escala = limitar(Math.min(
      (rect.width - espacio * 2) / layout.ancho,
      (rect.height - espacio * 2) / layout.alto,
      1.12,
    ), 0.02, 1.12);
    actualizarVista({
      x: (rect.width - layout.ancho * escala) / 2,
      y: (rect.height - layout.alto * escala) / 2,
      escala,
    });
  }, [actualizarVista, layout, familiasOcultas.size]);

  const modificarZoom = useCallback((cantidad: number, centro?: { x: number; y: number }) => {
    const contenedor = contenedorRef.current;
    if (!contenedor) return;
    const rect = contenedor.getBoundingClientRect();
    const punto = centro ?? { x: rect.width / 2, y: rect.height / 2 };
    const actual = vistaRef.current;
    const escala = limitar(actual.escala * cantidad, 0.02, 2.4);
    const proporcion = escala / actual.escala;
    actualizarVista({
      x: punto.x - (punto.x - actual.x) * proporcion,
      y: punto.y - (punto.y - actual.y) * proporcion,
      escala,
    });
  }, [actualizarVista]);

  const centrarEnPersona = useCallback((personaId: string) => {
    setPersonaSeleccionadaId(personaId);
    const contenedor = contenedorRef.current;
    const posicion = layout.posiciones.get(personaId);
    if (!contenedor || !posicion) return;
    const rect = contenedor.getBoundingClientRect();
    const escala = Math.max(vistaRef.current.escala, 0.72);
    actualizarVista({
      x: rect.width / 2 - posicion.x * escala,
      y: rect.height / 2 - posicion.y * escala,
      escala,
    });
  }, [actualizarVista, layout.posiciones]);

  useEffect(() => {
    if (personas.length === 0) return;
    ajustarVistaCompleta();
    const contenedor = contenedorRef.current;
    if (!contenedor) return;
    const observador = new ResizeObserver(() => window.requestAnimationFrame(ajustarVistaCompleta));
    observador.observe(contenedor);
    return () => observador.disconnect();
  }, [ajustarVistaCompleta, personas.length]);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const diagnosticoModelo = diagnosticarModeloArbol(personas);
    const diagnosticoLayout = diagnosticarLayoutArbol(modeloArbol, layout);
    const geometria = diagnosticarGeometriaArbol(trazos, nodosParaTrazado);
    const diagnosticoVinculos = diagnosticarVinculosVisualesArbol(modeloArbol, vinculosVisuales, nodosParaTrazado);
    const hayErrores = geometria.sinTrazo.length > 0 || geometria.desconectados.length > 0
      || geometria.extremosLibres.length > 0 || geometria.puertosInvalidos.length > 0
      || geometria.tarjetasAtravesadas.length > 0 || geometria.noFinitos.length > 0
      || diagnosticoModelo.errores.length > 0
      || diagnosticoLayout.faltantes.length > 0
      || diagnosticoLayout.desconocidos.length > 0
      || diagnosticoLayout.solapamientos.length > 0
      || diagnosticoLayout.filiacionesNoDescendentes.length > 0
      || diagnosticoLayout.conyugesEnFilasDistintas.length > 0
      || diagnosticoLayout.familiasConHijosEnFilasDistintas.length > 0
      || diagnosticoVinculos.filiacionesFaltantes.length > 0
      || diagnosticoVinculos.filiacionesDuplicadas.length > 0
      || diagnosticoVinculos.vinculosConyugalesFaltantes.length > 0
      || diagnosticoVinculos.vinculosConyugalesDuplicados.length > 0
      || diagnosticoVinculos.personasVinculadasSinRepresentacion.length > 0
      || diagnosticoVinculos.idsVisualesDuplicados.length > 0
      || diagnosticoVinculos.vinculosSinTrazo.length > 0;
    (hayErrores ? console.error : console.info)("[Árbol Biani] Auditoría del modelo y layout familiar propio", {
      diagnosticoModelo,
      diagnosticoLayout,
      diagnosticoVinculos,
      geometria,
      advertencias: layout.advertencias,
      vinculosEsperados: vinculosVisuales.length,
      vinculosDibujados: trazos.length,
    });
  }, [layout, modeloArbol, nodosParaTrazado, personas, trazos, vinculosVisuales]);

  const iniciarArrastre = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("[data-persona-id]")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const actual = vistaRef.current;
    arrastreRef.current = {
      pointerId: event.pointerId,
      inicioX: event.clientX,
      inicioY: event.clientY,
      vistaX: actual.x,
      vistaY: actual.y,
    };
    setPersonaSeleccionadaId(null);
  };

  const arrastrar = (event: ReactPointerEvent<HTMLDivElement>) => {
    const arrastre = arrastreRef.current;
    if (!arrastre || arrastre.pointerId !== event.pointerId) return;
    actualizarVista({
      ...vistaRef.current,
      x: arrastre.vistaX + event.clientX - arrastre.inicioX,
      y: arrastre.vistaY + event.clientY - arrastre.inicioY,
    });
  };

  const terminarArrastre = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (arrastreRef.current?.pointerId !== event.pointerId) return;
    arrastreRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const usarRueda = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    modificarZoom(Math.exp(-event.deltaY * 0.0012), { x: event.clientX - rect.left, y: event.clientY - rect.top });
  };

  if (personasCompletas.length === 0) {
    return <div className="flex min-h-[calc(100svh-4rem)] items-center justify-center px-6 md:min-h-screen"><div className="max-w-sm text-center"><h1 className="font-display text-3xl text-velvet">Árbol</h1><p className="mt-3 text-sm leading-6 text-ink/60">Cuando haya personas cargadas, el mapa familiar aparecerá acá.</p><Link href="/archivo" className="mt-5 inline-flex text-sm text-velvet underline underline-offset-4">Ir al Archivo Familiar</Link></div></div>;
  }

  return <div className="relative h-[calc(100svh-4rem)] overflow-hidden bg-background md:h-screen">
    <SakuraBackdrop />
    <div
      className={`arbol-mapa arbol-mapa-propio arbol-zoom-${detalleZoom}`}
      ref={contenedorRef}
      style={{ ...variablesGeometriaArbol,
        "--arbol-grosor-vinculo": `${Math.max(1.9, 0.85 / vista.escala)}px`,
        "--arbol-opacidad-anios": opacidadAnios,
        "--arbol-opacidad-nombre": opacidadNombre,
        "--arbol-opacidad-punto": 1 - opacidadNombre,
      } as CSSProperties}
      aria-label="Mapa interactivo del árbol genealógico"
      onPointerDown={iniciarArrastre}
      onPointerMove={arrastrar}
      onPointerUp={terminarArrastre}
      onPointerCancel={terminarArrastre}
      onWheel={usarRueda}
    >
      <div
        className="arbol-escena"
        style={{
          width: layout.ancho,
          height: layout.alto,
          transform: `translate3d(${vista.x}px, ${vista.y}px, 0) scale(${vista.escala})`,
        }}
      >
        <svg className="arbol-vinculos" width={layout.ancho} height={layout.alto} viewBox={`0 0 ${Math.max(1, layout.ancho)} ${Math.max(1, layout.alto)}`} aria-hidden="true">
          <g className="arbol-marcos-pareja">
            {marcosPareja.map(marco => <rect key={marco.id}
              data-pareja-id={marco.id}
              className={`arbol-marco-pareja${marco.ramaNumerosa ? " arbol-marco-pareja-rama-numerosa" : ""}${marco.personasIds.some(id => unidadSeleccionada.has(id)) ? " arbol-marco-pareja-seleccionada" : ""}`}
              x={marco.x} y={marco.y} width={marco.ancho} height={marco.alto} rx={19}
            />)}
          </g>
          <g className="links_view">
            {trazos.map(({ vinculo, trazo }) => {
              if (!trazo) return null;
              const ids = vinculo.tipo === "conyugal" ? [vinculo.origenId, vinculo.destinoId] : [...vinculo.progenitoresIds, ...vinculo.hijosIds];
              const destacado = ids.some(id => unidadSeleccionada.has(id));
              const esPareja = vinculo.tipo === "conyugal" || vinculo.progenitoresIds.length === 2;
              return <g key={vinculo.id}
                className={unidadSeleccionada.size ? destacado ? "arbol-vinculo-destacado" : "arbol-vinculo-contexto" : ""}
                data-vinculo-id={vinculo.id}
                data-vinculo-tipo={vinculo.tipo}
                data-vinculo-modo={trazo.modo}
              >
                {trazo.partes.map((parte, indice) => <path key={`${parte.papel}-${indice}`}
                  className={`arbol-vinculo-normalizado arbol-vinculo-${vinculo.tipo} arbol-tramo-${parte.papel}${parte.jerarquia ? ` arbol-rama-${parte.jerarquia}` : ""}`}
                  d={parte.d}
                />)}
                {esPareja && <circle className="arbol-punto-union" cx={trazo.ancla.x} cy={trazo.ancla.y} r={2.6} />}
              </g>;
            })}
          </g>
        </svg>
        {layout.nodos.map((nodo) => {
          const persona = personaPorId.get(nodo.id);
          if (!persona) return null;
          const sinLineaSangre = (modeloArbol.padresPorHijo.get(persona.id)?.size ?? 0) === 0
            && (modeloArbol.hijosPorPadre.get(persona.id)?.size ?? 0) === 0
            && (modeloArbol.conyugesPorPersona.get(persona.id)?.size ?? 0) > 0;
          const claseGenero = persona.genero === "femenino"
            ? "arbol-nodo-femenino"
            : persona.genero === "masculino" ? "arbol-nodo-masculino" : "arbol-nodo-sin-genero";
          return <button
            key={persona.id}
            type="button"
            className={`arbol-nodo arbol-nodo-propio ${claseGenero}${sinLineaSangre ? " arbol-nodo-sin-linea-sangre" : ""}${personaSeleccionadaId === persona.id ? " arbol-nodo-seleccionado" : ""}`}
            data-persona-id={persona.id}
            style={{ left: nodo.x - GEOMETRIA_ARBOL.anchoNodo / 2, top: nodo.y - GEOMETRIA_ARBOL.altoNodo / 2 }}
            onClick={() => setPersonaSeleccionadaId(persona.id)}
            aria-label={`Abrir ficha de ${nombreCompleto(persona)}`}
            aria-pressed={personaSeleccionadaId === persona.id}
            title={nombreCompleto(persona)}
          >
            <span className="arbol-nodo-nombre">{nombreCompleto(persona)}</span>
            {anios(persona) && <span className="arbol-nodo-anios">{anios(persona)}</span>}
          </button>;
        })}
      </div>
    </div>
    <FiltroFamilias familias={familias} activas={familiasActivas} onCambiar={cambiarFamilias} />
    {personas.length === 0 && <div role="status" className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-6">
      <div className="arbol-filtro-superficie max-w-sm rounded-2xl border p-6 text-center">
        <h2 className="font-display text-2xl text-velvet">Ninguna familia seleccionada</h2>
        <p className="mt-2 text-sm text-ink/60">Abrí Familias para elegir qué ramas mostrar.</p>
        <button type="button" className="boton-secundario pointer-events-auto mt-4 text-sm" onClick={() => cambiarFamilias(new Set(familias.map(f => f.id)))}>Mostrar todas</button>
      </div>
    </div>}
    <div className="absolute right-4 top-4 z-10 flex overflow-hidden rounded-xl border border-border bg-white/95 shadow-soft backdrop-blur-sm sm:right-6 sm:top-6">
      <button type="button" onClick={() => modificarZoom(1.22)} className="arbol-control" aria-label="Acercar"><Plus size={18} /></button>
      <button type="button" onClick={() => modificarZoom(0.82)} className="arbol-control border-x border-border" aria-label="Alejar"><Minus size={18} /></button>
      <button type="button" onClick={ajustarVistaCompleta} className="arbol-control gap-1.5 px-3 text-xs font-medium" aria-label="Ver todo el árbol"><Move size={16} /> <span className="hidden sm:inline">Ver todo</span></button>
    </div>
    {personaSeleccionada && <aside className="absolute inset-x-3 bottom-3 z-10 max-h-[62vh] overflow-y-auto rounded-2xl border border-border bg-white/95 p-5 shadow-[0_16px_42px_-18px_rgba(36,26,51,0.35)] backdrop-blur-sm sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-80">
      <div className="flex items-start justify-between gap-4"><div><h2 className="font-display text-2xl leading-tight text-velvet">{nombreCompleto(personaSeleccionada)}</h2></div><button type="button" onClick={() => setPersonaSeleccionadaId(null)} className="rounded-lg p-1 text-ink/45 transition-colors hover:bg-lavender/30 hover:text-velvet" aria-label="Cerrar ficha"><X size={18} /></button></div>
      {(anios(personaSeleccionada) || lugarPrincipal(personaSeleccionada)) && <p className="mt-3 text-sm leading-6 text-ink/65">{[anios(personaSeleccionada), lugarPrincipal(personaSeleccionada)].filter(Boolean).join(" · ")}</p>}
      <div className="mt-5 space-y-4 border-t border-border pt-4"><GrupoPersonas etiqueta="Padres / madres" ids={personaSeleccionada.padres_ids} personas={personaPorId} onElegir={centrarEnPersona} /><GrupoPersonas etiqueta="Hijos / hijas" ids={personaSeleccionada.hijos_ids} personas={personaPorId} onElegir={centrarEnPersona} /><GrupoPersonas etiqueta="Cónyuges / parejas" ids={personaSeleccionada.conyuges_ids} personas={personaPorId} onElegir={centrarEnPersona} /><GrupoPersonas etiqueta="Hermanos / hermanas" ids={personaSeleccionada.hermanos_ids} personas={personaPorId} onElegir={centrarEnPersona} /></div>
      <Link href={`/archivo/${personaSeleccionada.id}`} className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-velvet px-3 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90">Editar en Archivo Familiar</Link>
    </aside>}
  </div>;
}

function GrupoPersonas({ etiqueta, ids, personas, onElegir }: { etiqueta: string; ids: string[]; personas: Map<string, PersonaArbol>; onElegir: (id: string) => void }) {
  const vinculadas = ids.map((id) => personas.get(id)).filter((persona): persona is PersonaArbol => !!persona);
  if (vinculadas.length === 0) return null;
  return <section><p className="text-xs font-medium text-ink/45">{etiqueta}</p><div className="mt-1.5 flex flex-wrap gap-1.5">{vinculadas.map((persona) => <button key={persona.id} type="button" onClick={() => onElegir(persona.id)} className="rounded-lg bg-lavender/25 px-2 py-1 text-xs text-velvet transition-colors hover:bg-lavender/50 hover:underline">{nombreCompleto(persona)}</button>)}</div></section>;
}
