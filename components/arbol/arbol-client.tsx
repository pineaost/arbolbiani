"use client";

import Link from "next/link";
import { Minus, Move, Plus, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { SakuraBackdrop } from "@/components/arbol/sakura-backdrop";
import {
  compararHijosParaLayout,
  crearDatosFamilyChart,
  crearModeloArbol,
  crearTrazoVinculoArbol,
  crearVinculosVisualesArbol,
  diagnosticarDatosFamilyChart,
  diagnosticarModeloArbol,
  GEOMETRIA_ARBOL,
  ordenarConyugesParaLayout,
  RAIZ_MAPA_ID,
} from "@/lib/arbol-chart";
import type { NodoPosicionadoArbol, VinculoVisualArbol } from "@/lib/arbol-chart";
import type { PersonaArbol } from "@/lib/supabase/types";

type FamilyChart = ReturnType<(typeof import("family-chart"))["createChart"]>;
type FamilyChartModule = typeof import("family-chart");
interface Props { personas: PersonaArbol[]; }

function nombreCompleto(persona: PersonaArbol) { return `${persona.nombre} ${persona.apellido}`.trim(); }
function anios(persona: PersonaArbol) { return [persona.fecha_nacimiento?.slice(0, 4), persona.fecha_fallecimiento?.slice(0, 4)].filter(Boolean).join(" — "); }
function lugarPrincipal(persona: PersonaArbol) { return persona.lugar_nacimiento ?? persona.lugar_fallecimiento ?? null; }
function escaparHtml(valor: unknown) { return String(valor ?? "").replace(/[&<>'"]/g, (caracter) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[caracter] ?? caracter); }

const variablesGeometriaArbol = {
  "--arbol-nodo-ancho": `${GEOMETRIA_ARBOL.anchoNodo}px`,
  "--arbol-nodo-alto": `${GEOMETRIA_ARBOL.altoNodo}px`,
} as CSSProperties;

type NodoPosicionado = NodoPosicionadoArbol;

function trazoVinculo(vinculo: VinculoVisualArbol, nodos: NodoPosicionado[]) {
  return crearTrazoVinculoArbol(vinculo, nodos);
}

function dibujarVinculosNormalizados(
  svg: SVGElement,
  nodos: NodoPosicionado[],
  vinculos: VinculoVisualArbol[],
) {
  const capa = svg.querySelector<SVGGElement>(".links_view");
  if (!capa) return;
  capa.querySelectorAll(".arbol-vinculo-normalizado").forEach((path) => path.remove());
  capa.querySelectorAll<SVGPathElement>("path.link").forEach((path) => {
    path.style.display = "none";
  });
  for (const vinculo of vinculos) {
    const trazo = trazoVinculo(vinculo, nodos);
    if (!trazo) continue;
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("class", `arbol-vinculo-normalizado arbol-vinculo-${vinculo.tipo}`);
    path.setAttribute("d", trazo.d);
    path.setAttribute("data-vinculo-id", vinculo.id);
    path.setAttribute("data-vinculo-tipo", vinculo.tipo);
    path.setAttribute("data-vinculo-modo", trazo.modo);
    path.setAttribute("fill", "none");
    capa.appendChild(path);
    if (trazo.degradado && process.env.NODE_ENV !== "production") {
      console.info("[Árbol Biani] Unión familiar degradada a curvas individuales por hijos no contiguos", {
        vinculoId: vinculo.id,
        hijosIds: vinculo.tipo === "union-familiar" ? vinculo.hijosIds : [],
      });
    }
  }
}

export function ArbolClient({ personas }: Props) {
  const contenedorRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<FamilyChart | null>(null);
  const libreriaRef = useRef<FamilyChartModule | null>(null);
  const [personaSeleccionadaId, setPersonaSeleccionadaId] = useState<string | null>(null);
  const [detalleZoom, setDetalleZoom] = useState<"lejos" | "medio" | "cerca">("medio");
  const modeloArbol = useMemo(() => crearModeloArbol(personas), [personas]);
  const datosChart = useMemo(() => crearDatosFamilyChart(personas), [personas]);
  const vinculosVisuales = useMemo(() => crearVinculosVisualesArbol(modeloArbol), [modeloArbol]);
  const personaPorId = useMemo(() => new Map(personas.map((persona) => [persona.id, persona])), [personas]);
  const personaSeleccionada = personaSeleccionadaId ? personaPorId.get(personaSeleccionadaId) ?? null : null;

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const diagnosticoModelo = diagnosticarModeloArbol(personas);
    const diagnosticoLayout = diagnosticarDatosFamilyChart(datosChart);
    const nivel = diagnosticoModelo.errores.length || diagnosticoLayout.errores.length ? console.error : console.info;
    nivel("[Árbol Biani] Auditoría del grafo normalizado y su bosque de layout", { diagnosticoModelo, diagnosticoLayout });
  }, [datosChart, personas]);

  const ajustarVistaCompleta = useCallback(() => {
    const chart = chartRef.current;
    const f3 = libreriaRef.current;
    const tree = chart?.store.getTree();
    if (!chart || !f3 || !tree) return;
    f3.handlers.treeFit({ svg: chart.svg, svg_dim: chart.svg.getBoundingClientRect(), tree_dim: tree.dim, transition_time: 280 });
  }, []);
  const modificarZoom = useCallback((cantidad: number) => {
    const chart = chartRef.current;
    const f3 = libreriaRef.current;
    if (chart && f3) f3.handlers.manualZoom({ amount: cantidad, svg: chart.svg, transition_time: 180 });
  }, []);
  const centrarEnPersona = useCallback((personaId: string) => {
    setPersonaSeleccionadaId(personaId);
    const chart = chartRef.current;
    const f3 = libreriaRef.current;
    const datum = chart?.store.getTreeDatum(personaId);
    if (!chart || !f3 || !datum) return;
    const escala = f3.handlers.getCurrentZoom(chart.svg).k;
    f3.handlers.cardToMiddle({ datum, svg: chart.svg, svg_dim: chart.svg.getBoundingClientRect(), scale: Math.max(escala, 0.72), transition_time: 260 });
  }, []);

  useEffect(() => {
    const contenedor = contenedorRef.current;
    if (!contenedor || personas.length === 0) return;
    let activo = true;
    let intervaloZoom: number | null = null;
    let resizeObserver: ResizeObserver | null = null;
    const deseleccionarFondo = (event: PointerEvent) => { if (!(event.target as HTMLElement).closest("[data-persona-id]")) setPersonaSeleccionadaId(null); };

    async function iniciarMapa() {
      const f3 = await import("family-chart");
      if (!activo || !contenedorRef.current) return;
      const actual = contenedorRef.current;
      actual.innerHTML = "";
      // La librería muta su entrada durante el cálculo; cada montaje recibe una copia.
      const chart = f3.createChart(actual, structuredClone(datosChart))
        .setOrientationVertical().setSingleParentEmptyCard(false).setShowSiblingsOfMain(false)
        .setAncestryDepth(99).setProgenyDepth(99)
        .setCardXSpacing(GEOMETRIA_ARBOL.separacionHorizontal)
        .setCardYSpacing(GEOMETRIA_ARBOL.separacionVertical)
        .setTransitionTime(0)
        .setSortChildrenFunction(compararHijosParaLayout)
        .setSortSpousesFunction(ordenarConyugesParaLayout);
      chart.setCardHtml().setStyle("rect").setCardDim({ w: GEOMETRIA_ARBOL.anchoNodo, h: GEOMETRIA_ARBOL.altoNodo }).setCardInnerHtmlCreator((datum) => {
        if (datum.data.data.virtual) return '<div class="arbol-raiz-tecnica" aria-hidden="true"></div>';
        const datosPersona = datum.data.data;
        const nombre = datosPersona.nombre ?? "";
        const apellido = datosPersona.apellido ?? "";
        const nombrePersona = `${nombre} ${apellido}`.trim();
        const claseLineaSangre = datosPersona.sinLineaSangre ? " arbol-nodo-sin-linea-sangre" : "";
        const claseGenero = datosPersona.sinGeneroDefinido ? " arbol-nodo-sin-genero" : "";
        return `<div class="arbol-nodo${claseLineaSangre}${claseGenero}" data-persona-id="${escaparHtml(datum.data.id)}" role="button" tabindex="0" aria-label="Abrir ficha de ${escaparHtml(nombrePersona)}" title="${escaparHtml(nombrePersona)}"><span class="arbol-nodo-nombre">${escaparHtml(nombrePersona)}</span>${datosPersona.anios ? `<span class="arbol-nodo-anios">${escaparHtml(datosPersona.anios)}</span>` : ""}</div>`;
      }).setOnCardClick((_event: MouseEvent, datum: { data: { id: string; data: { virtual?: boolean } } }) => { if (!datum.data.data.virtual) setPersonaSeleccionadaId(datum.data.id); });
      chart.setAfterUpdate(() => {
        const nodos = (chart.store.getTree()?.data ?? []) as NodoPosicionado[];
        dibujarVinculosNormalizados(chart.svg, nodos, vinculosVisuales);
      });
      chart.updateTree({ initial: true, tree_position: "fit", transition_time: 0 });
      if (process.env.NODE_ENV !== "production") {
        const diagnosticoLayout = diagnosticarDatosFamilyChart(datosChart);
        const raicesEnviadas = diagnosticoLayout.raicesLayout.map((id) => ({
          id,
          nombre: `${datosChart.find((dato) => dato.id === id)?.data.nombre ?? ""} ${datosChart.find((dato) => dato.id === id)?.data.apellido ?? ""}`.trim(),
        }));
        console.info("[Árbol Biani] main_id/root y raíces entregadas a family-chart", {
          mainIdFamilyChart: chart.store.getMainId(),
          raizTecnicaId: RAIZ_MAPA_ID,
          raicesEnviadas,
          raicesAuditadas: diagnosticoLayout.raicesLayout,
          coincideConAuditoria: raicesEnviadas.map(({ id }) => id).join("|") === diagnosticoLayout.raicesLayout.join("|"),
        });
        const esperados = datosChart.filter((dato) => !dato.data.virtual).map((dato) => dato.id);
        const idsVirtuales = new Set(datosChart.filter((dato) => dato.data.virtual).map((dato) => dato.id));
        const idsRenderizados = (chart.store.getTree()?.data.map((dato) => dato.data.id) ?? []).filter((id) => !idsVirtuales.has(id));
        const renderizados = new Set(idsRenderizados);
        const faltantesEnLayout = esperados.filter((id) => !renderizados.has(id));
        const duplicadosEnLayout = [...new Set(idsRenderizados.filter((id, indice) => idsRenderizados.indexOf(id) !== indice))];
        const idsVisibles = [...actual.querySelectorAll<HTMLElement>("[data-persona-id]")]
          .filter((nodo) => nodo.dataset.personaId && window.getComputedStyle(nodo).display !== "none" && window.getComputedStyle(nodo).visibility !== "hidden")
          .map((nodo) => nodo.dataset.personaId!);
        const visibles = new Set(idsVisibles);
        const faltantesVisibles = esperados.filter((id) => !visibles.has(id));
        const duplicadosVisibles = [...new Set(idsVisibles.filter((id, indice) => idsVisibles.indexOf(id) !== indice))];
        const cobertura = {
          esperadas: esperados.length,
          renderizadasEnLayout: esperados.length - faltantesEnLayout.length,
          nodosVisibles: visibles.size,
          vinculosEsperados: vinculosVisuales.length,
          vinculosDibujados: actual.querySelectorAll(".arbol-vinculo-normalizado").length,
          faltantesEnLayout: faltantesEnLayout.map((id) => ({ id, motivo: "family-chart no generó un nodo renderizable desde el componente" })),
          duplicadosEnLayout: duplicadosEnLayout.map((id) => ({ id, motivo: "family-chart recorrió la persona por más de una rama" })),
          faltantesVisibles: faltantesVisibles.map((id) => ({ id, motivo: "family-chart no creó una tarjeta visible en el DOM" })),
          duplicadosVisibles: duplicadosVisibles.map((id) => ({ id, motivo: "family-chart creó más de una tarjeta visible para la persona" })),
        };
        (faltantesEnLayout.length || duplicadosEnLayout.length || faltantesVisibles.length || duplicadosVisibles.length ? console.error : console.info)("[Árbol Biani] Cobertura calculada por family-chart", cobertura);
      }
      chart.setTransitionTime(240);
      chartRef.current = chart;
      libreriaRef.current = f3;
      actual.addEventListener("pointerdown", deseleccionarFondo);
      intervaloZoom = window.setInterval(() => {
        if (!chartRef.current || !libreriaRef.current) return;
        const escala = libreriaRef.current.handlers.getCurrentZoom(chartRef.current.svg).k;
        const detalle = escala < 0.53 ? "lejos" : escala < 0.9 ? "medio" : "cerca";
        setDetalleZoom((anterior) => anterior === detalle ? anterior : detalle);
      }, 180);
      resizeObserver = new ResizeObserver(() => window.requestAnimationFrame(ajustarVistaCompleta));
      resizeObserver.observe(actual);
    }
    iniciarMapa();
    return () => { activo = false; if (intervaloZoom) window.clearInterval(intervaloZoom); resizeObserver?.disconnect(); contenedor.removeEventListener("pointerdown", deseleccionarFondo); chartRef.current = null; libreriaRef.current = null; contenedor.innerHTML = ""; };
  }, [ajustarVistaCompleta, datosChart, personas.length, vinculosVisuales]);

  useEffect(() => {
    const contenedor = contenedorRef.current;
    contenedor?.querySelectorAll<HTMLElement>("[data-persona-id]").forEach((nodo) => nodo.classList.toggle("arbol-nodo-seleccionado", nodo.dataset.personaId === personaSeleccionadaId));
  }, [personaSeleccionadaId, detalleZoom]);

  if (personas.length === 0) return <div className="flex min-h-[calc(100svh-4rem)] items-center justify-center px-6 md:min-h-screen"><div className="max-w-sm text-center"><h1 className="font-display text-3xl text-velvet">Árbol</h1><p className="mt-3 text-sm leading-6 text-ink/60">Cuando haya personas cargadas, el mapa familiar aparecerá acá.</p><Link href="/archivo" className="mt-5 inline-flex text-sm text-velvet underline underline-offset-4">Ir al Archivo Familiar</Link></div></div>;
  return <div className="relative h-[calc(100svh-4rem)] overflow-hidden bg-background md:h-screen"><SakuraBackdrop /><div className={`arbol-mapa f3 arbol-zoom-${detalleZoom}`} ref={contenedorRef} style={variablesGeometriaArbol} aria-label="Mapa interactivo del árbol genealógico" /><div className="absolute right-4 top-4 z-10 flex overflow-hidden rounded-xl border border-border bg-white/95 shadow-soft backdrop-blur-sm sm:right-6 sm:top-6"><button type="button" onClick={() => modificarZoom(1.22)} className="arbol-control" aria-label="Acercar"><Plus size={18} /></button><button type="button" onClick={() => modificarZoom(0.82)} className="arbol-control border-x border-border" aria-label="Alejar"><Minus size={18} /></button><button type="button" onClick={ajustarVistaCompleta} className="arbol-control gap-1.5 px-3 text-xs font-medium" aria-label="Ver todo el árbol"><Move size={16} /> <span className="hidden sm:inline">Ver todo</span></button></div>{personaSeleccionada && <aside className="absolute inset-x-3 bottom-3 z-10 max-h-[62vh] overflow-y-auto rounded-2xl border border-border bg-white/95 p-5 shadow-[0_16px_42px_-18px_rgba(36,26,51,0.35)] backdrop-blur-sm sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-80"><div className="flex items-start justify-between gap-4"><div><h2 className="font-display text-2xl leading-tight text-velvet">{nombreCompleto(personaSeleccionada)}</h2></div><button type="button" onClick={() => setPersonaSeleccionadaId(null)} className="rounded-lg p-1 text-ink/45 transition-colors hover:bg-lavender/30 hover:text-velvet" aria-label="Cerrar ficha"><X size={18} /></button></div>{(anios(personaSeleccionada) || lugarPrincipal(personaSeleccionada)) && <p className="mt-3 text-sm leading-6 text-ink/65">{[anios(personaSeleccionada), lugarPrincipal(personaSeleccionada)].filter(Boolean).join(" · ")}</p>}<div className="mt-5 space-y-4 border-t border-border pt-4"><GrupoPersonas etiqueta="Padres / madres" ids={personaSeleccionada.padres_ids} personas={personaPorId} onElegir={centrarEnPersona} /><GrupoPersonas etiqueta="Hijos / hijas" ids={personaSeleccionada.hijos_ids} personas={personaPorId} onElegir={centrarEnPersona} /><GrupoPersonas etiqueta="Cónyuges / parejas" ids={personaSeleccionada.conyuges_ids} personas={personaPorId} onElegir={centrarEnPersona} /><GrupoPersonas etiqueta="Hermanos / hermanas" ids={personaSeleccionada.hermanos_ids} personas={personaPorId} onElegir={centrarEnPersona} /></div><Link href={`/archivo/${personaSeleccionada.id}`} className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-velvet px-3 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90">Editar en Archivo Familiar</Link></aside>}</div>;
}

function GrupoPersonas({ etiqueta, ids, personas, onElegir }: { etiqueta: string; ids: string[]; personas: Map<string, PersonaArbol>; onElegir: (id: string) => void }) {
  const vinculadas = ids.map((id) => personas.get(id)).filter((persona): persona is PersonaArbol => !!persona);
  if (vinculadas.length === 0) return null;
  return <section><p className="text-xs font-medium text-ink/45">{etiqueta}</p><div className="mt-1.5 flex flex-wrap gap-1.5">{vinculadas.map((persona) => <button key={persona.id} type="button" onClick={() => onElegir(persona.id)} className="rounded-lg bg-lavender/25 px-2 py-1 text-xs text-velvet transition-colors hover:bg-lavender/50 hover:underline">{nombreCompleto(persona)}</button>)}</div></section>;
}
