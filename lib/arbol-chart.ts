import type { PersonaArbol } from "@/lib/supabase/types";

export const RAIZ_MAPA_ID = "__arbol_mapa_raiz__";

// Unica fuente de dimensiones para el DOM de las fichas, el posicionador
// genealogico propio y los vinculos normalizados superpuestos.
export const GEOMETRIA_ARBOL = {
  anchoNodo: 176,
  altoNodo: 92,
  separacionHorizontal: 216,
  separacionVertical: 148,
  separacionPareja: 20,
  separacionEntreHermanos: 40,
  separacionUnidadesFamiliares: 148,
  separacionComponentes: 648,
  margenMapa: 72,
} as const;

export interface DatoFamilyChart {
  id: string;
  data: {
    gender: "M" | "F";
    nombre?: string;
    apellido?: string;
    anios?: string;
    iniciales?: string;
    orden: string;
    virtual?: boolean;
    sinLineaSangre?: boolean;
    sinGeneroDefinido?: boolean;
    tieneConyuge?: boolean;
    ordenLayout?: number;
    raizLayoutId?: string;
  };
  rels: { parents: string[]; children: string[]; spouses: string[] };
}

export interface FamiliaArbol {
  id: string;
  progenitores: string[];
  hijos: string[];
}

export interface ComponenteArbol {
  ids: string[];
  raicesAncestrales: string[];
}

export type CodigoProblemaArbol =
  | "referencia-ausente"
  | "auto-referencia-filiacion"
  | "auto-referencia-conyugal"
  | "mas-de-dos-progenitores"
  | "ciclo-filiacion";

export interface ProblemaArbol {
  codigo: CodigoProblemaArbol;
  ids: string[];
  detalle: string;
}

export interface ModeloArbol {
  personas: Map<string, PersonaArbol>;
  padresPorHijo: Map<string, Set<string>>;
  hijosPorPadre: Map<string, Set<string>>;
  conyugesPorPersona: Map<string, Set<string>>;
  familias: FamiliaArbol[];
  componentes: ComponenteArbol[];
  problemas: ProblemaArbol[];
}

export interface BosqueLayoutArbol {
  padrePrincipalPorHijo: Map<string, string>;
  hijosPorPadrePrincipal: Map<string, Set<string>>;
  personaAdjuntaAConyuge: Map<string, string>;
  conyugesAdjuntosPorPersona: Map<string, Set<string>>;
  ordenLayoutPorPersona: Map<string, number>;
  profundidadObjetivoPorRaiz: Map<string, number>;
  raices: string[];
}

export interface VinculoVisualConyugalArbol {
  id: string;
  tipo: "conyugal";
  origenId: string;
  destinoId: string;
}

export interface VinculoVisualUnionFamiliarArbol {
  id: string;
  tipo: "union-familiar";
  familiaId: string;
  progenitoresIds: string[];
  hijosIds: string[];
}

export type VinculoVisualArbol = VinculoVisualConyugalArbol | VinculoVisualUnionFamiliarArbol;

export interface NodoPosicionadoArbol {
  data: { id: string; data?: { virtual?: boolean } };
  x: number;
  y: number;
}

export interface PosicionPersonaArbol {
  id: string;
  x: number;
  y: number;
  generacion: number;
  grupoFamiliarId: string;
  componenteIndice: number;
}

export interface LimitesLayoutArbol {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface LayoutArbol {
  posiciones: Map<string, PosicionPersonaArbol>;
  nodos: PosicionPersonaArbol[];
  ancho: number;
  alto: number;
  limites: LimitesLayoutArbol;
}

export interface TrazoVinculoArbol {
  d: string;
  modo: "curva" | "bus" | "individual";
  degradado: boolean;
}

function numeroSvg(valor: number) {
  return String(Math.round(valor * 1000) / 1000);
}

function puntoEnBorde(origen: NodoPosicionadoArbol, destino: NodoPosicionadoArbol) {
  const dx = destino.x - origen.x;
  const dy = destino.y - origen.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return { x: origen.x + Math.sign(dx || 1) * GEOMETRIA_ARBOL.anchoNodo / 2, y: origen.y };
  }
  return { x: origen.x, y: origen.y + Math.sign(dy || 1) * GEOMETRIA_ARBOL.altoNodo / 2 };
}

function curvaEntrePuntos(inicio: { x: number; y: number }, fin: { x: number; y: number }) {
  const yMedio = (inicio.y + fin.y) / 2;
  return `M${numeroSvg(inicio.x)},${numeroSvg(inicio.y)} C${numeroSvg(inicio.x)},${numeroSvg(yMedio)} ${numeroSvg(fin.x)},${numeroSvg(yMedio)} ${numeroSvg(fin.x)},${numeroSvg(fin.y)}`;
}

function hijosContiguosEnLayout(hijos: NodoPosicionadoArbol[], nodos: NodoPosicionadoArbol[]) {
  if (hijos.length < 2) return true;
  const yFila = hijos[0].y;
  if (hijos.some((hijo) => Math.abs(hijo.y - yFila) > 1)) return false;
  const idsHijos = new Set(hijos.map(({ data }) => data.id));
  const fila = nodos
    .filter((nodo) => !nodo.data.data?.virtual && Math.abs(nodo.y - yFila) <= 1)
    .sort((a, b) => a.x - b.x || a.data.id.localeCompare(b.data.id, "es"));
  const posiciones = fila
    .map((nodo, indice) => idsHijos.has(nodo.data.id) ? indice : -1)
    .filter((indice) => indice >= 0);
  return posiciones.length === hijos.length
    && Math.max(...posiciones) - Math.min(...posiciones) + 1 === hijos.length;
}

/**
 * Calcula el path SVG a partir de las coordenadas estabilizadas del mapa.
 * Una union no contigua conserva su semantica degradando a una curva por hijo.
 */
export function crearTrazoVinculoArbol(
  vinculo: VinculoVisualArbol,
  nodos: NodoPosicionadoArbol[],
): TrazoVinculoArbol | null {
  const nodosPorId = new Map(nodos.map((nodo) => [nodo.data.id, nodo]));
  if (vinculo.tipo === "conyugal") {
    const origen = nodosPorId.get(vinculo.origenId);
    const destino = nodosPorId.get(vinculo.destinoId);
    if (!origen || !destino) return null;
    const inicio = puntoEnBorde(origen, destino);
    const fin = puntoEnBorde(destino, origen);
    if (Math.abs(inicio.x - fin.x) >= Math.abs(inicio.y - fin.y)) {
      const xMedio = (inicio.x + fin.x) / 2;
      return {
        d: `M${numeroSvg(inicio.x)},${numeroSvg(inicio.y)} C${numeroSvg(xMedio)},${numeroSvg(inicio.y)} ${numeroSvg(xMedio)},${numeroSvg(fin.y)} ${numeroSvg(fin.x)},${numeroSvg(fin.y)}`,
        modo: "curva",
        degradado: false,
      };
    }
    return { d: curvaEntrePuntos(inicio, fin), modo: "curva", degradado: false };
  }

  const progenitores = vinculo.progenitoresIds
    .map((id) => nodosPorId.get(id))
    .filter((nodo): nodo is NodoPosicionadoArbol => !!nodo);
  const hijos = vinculo.hijosIds
    .map((id) => nodosPorId.get(id))
    .filter((nodo): nodo is NodoPosicionadoArbol => !!nodo);
  if (progenitores.length !== vinculo.progenitoresIds.length || hijos.length !== vinculo.hijosIds.length || hijos.length === 0) {
    return null;
  }

  const ancla = progenitores.length === 1
    ? { x: progenitores[0].x, y: progenitores[0].y + GEOMETRIA_ARBOL.altoNodo / 2 }
    : {
      x: progenitores.reduce((total, nodo) => total + nodo.x, 0) / progenitores.length,
      y: progenitores.reduce((total, nodo) => total + nodo.y, 0) / progenitores.length,
    };
  const finHijo = (hijo: NodoPosicionadoArbol) => ({ x: hijo.x, y: hijo.y - GEOMETRIA_ARBOL.altoNodo / 2 });

  if (!hijosContiguosEnLayout(hijos, nodos)) {
    return {
      d: hijos.map((hijo) => curvaEntrePuntos(ancla, finHijo(hijo))).join(" "),
      modo: "individual",
      degradado: true,
    };
  }

  const extremos = hijos.map((hijo) => finHijo(hijo));
  const xMinimo = Math.min(...extremos.map(({ x }) => x));
  const xMaximo = Math.max(...extremos.map(({ x }) => x));
  const ySuperiorHijos = Math.min(...extremos.map(({ y }) => y));
  const yBus = ancla.y + (ySuperiorHijos - ancla.y) / 2;
  const tramos = [
    `M${numeroSvg(ancla.x)},${numeroSvg(ancla.y)} V${numeroSvg(yBus)}`,
    `M${numeroSvg(xMinimo)},${numeroSvg(yBus)} H${numeroSvg(xMaximo)}`,
    ...extremos.map((fin) => `M${numeroSvg(fin.x)},${numeroSvg(yBus)} V${numeroSvg(fin.y)}`),
  ];
  return { d: tramos.join(" "), modo: "bus", degradado: false };
}

// Superconjunto minimo compatible tanto con DatoFamilyChart como con Datum
// de family-chart, que permite pasar estas funciones directo a su API.
interface DatoOrdenableParaLayout {
  id: string;
  data: { gender: "M" | "F"; orden?: string; tieneConyuge?: boolean; ordenLayout?: number };
  rels: { spouses: string[] };
}

function claveOrden(persona: PersonaArbol) {
  return `${persona.fecha_nacimiento ?? "9999-99-99"}|${persona.apellido}|${persona.nombre}|${persona.id}`.toLocaleLowerCase("es");
}

function anios(persona: PersonaArbol) {
  return [persona.fecha_nacimiento?.slice(0, 4), persona.fecha_fallecimiento?.slice(0, 4)].filter(Boolean).join(" — ");
}

function iniciales(persona: PersonaArbol) {
  return `${persona.nombre.charAt(0)}${persona.apellido.charAt(0)}`.toLocaleUpperCase("es");
}

function asegurar(mapa: Map<string, Set<string>>, id: string) {
  if (!mapa.has(id)) mapa.set(id, new Set());
  return mapa.get(id)!;
}

function ordenarIds(ids: Iterable<string>, personas: Map<string, PersonaArbol>) {
  const prioridadGenero = (id: string) => personas.get(id)?.genero === "masculino" ? 0 : personas.get(id)?.genero === "femenino" ? 1 : 2;
  return [...new Set(ids)]
    .filter((id) => personas.has(id))
    .sort((a, b) => prioridadGenero(a) - prioridadGenero(b) || claveOrden(personas.get(a)!).localeCompare(claveOrden(personas.get(b)!), "es"));
}

function claveProblema(codigo: CodigoProblemaArbol, ids: string[]) {
  return `${codigo}:${ids.join(":")}`;
}

function detectarCiclosFiliacion(
  personas: Map<string, PersonaArbol>,
  hijosPorPadre: Map<string, Set<string>>,
): ProblemaArbol[] {
  const estado = new Map<string, "visitando" | "visitado">();
  const camino: string[] = [];
  const ciclos = new Map<string, ProblemaArbol>();

  const visitar = (id: string) => {
    estado.set(id, "visitando");
    camino.push(id);
    for (const hijo of ordenarIds(hijosPorPadre.get(id) ?? [], personas)) {
      if (estado.get(hijo) === "visitando") {
        const inicio = camino.indexOf(hijo);
        const ciclo = [...camino.slice(inicio), hijo];
        const miembros = [...new Set(ciclo.slice(0, -1))].sort();
        ciclos.set(claveProblema("ciclo-filiacion", miembros), {
          codigo: "ciclo-filiacion",
          ids: ciclo,
          detalle: `Ciclo de filiacion detectado: ${ciclo.join(" -> ")}.`,
        });
      } else if (!estado.has(hijo)) {
        visitar(hijo);
      }
    }
    camino.pop();
    estado.set(id, "visitado");
  };

  ordenarIds(personas.keys(), personas).forEach((id) => {
    if (!estado.has(id)) visitar(id);
  });
  return [...ciclos.values()];
}

// family-chart inserta la pareja a la izquierda de una mujer y a la derecha
// de un varon. El bosque entrega una sola orientacion tecnica por pareja y
// conserva la prioridad visual completa mediante tieneConyuge.
export function compararHijosParaLayout(a: DatoOrdenableParaLayout, b: DatoOrdenableParaLayout) {
  const prioridad = (dato: DatoOrdenableParaLayout) => {
    const tieneConyuge = dato.data.tieneConyuge || dato.rels.spouses.length > 0;
    if (!tieneConyuge) return 1;
    return dato.data.gender === "F" ? 0 : 2;
  };
  const orden = (dato: DatoOrdenableParaLayout) => typeof dato.data.orden === "string" ? dato.data.orden : "";
  const ordenLayoutA = a.data.ordenLayout;
  const ordenLayoutB = b.data.ordenLayout;
  return typeof ordenLayoutA === "number" && typeof ordenLayoutB === "number"
    ? ordenLayoutA - ordenLayoutB || orden(a).localeCompare(orden(b), "es")
    : prioridad(a) - prioridad(b) || orden(a).localeCompare(orden(b), "es");
}

export function ordenarConyugesParaLayout(persona: DatoOrdenableParaLayout, datos: DatoOrdenableParaLayout[]) {
  const orden = (id: string) => {
    const valor = datos.find((dato) => dato.id === id)?.data.orden;
    return typeof valor === "string" ? valor : "";
  };
  persona.rels.spouses.sort((a, b) => orden(a).localeCompare(orden(b), "es"));
}

/*
 * Modelo genealogico canonico. La filiacion siempre queda dirigida de
 * progenitor a hijo y el vinculo conyugal siempre queda disponible en ambos
 * sentidos, sin importar desde que ficha se creo la unica fila persistida.
 */
export function crearModeloArbol(entrada: PersonaArbol[]): ModeloArbol {
  const personas = new Map<string, PersonaArbol>();
  entrada.forEach((persona) => {
    if (!personas.has(persona.id)) personas.set(persona.id, persona);
  });
  const padresPorHijo = new Map<string, Set<string>>();
  const hijosPorPadre = new Map<string, Set<string>>();
  const conyugesPorPersona = new Map<string, Set<string>>();
  const problemasPorClave = new Map<string, ProblemaArbol>();

  const registrarProblema = (problema: ProblemaArbol) => {
    const idsClave = problema.codigo.includes("conyugal") ? [...problema.ids].sort() : problema.ids;
    problemasPorClave.set(claveProblema(problema.codigo, idsClave), problema);
  };
  const filiacion = (padre: string, hijo: string) => {
    if (padre === hijo) {
      registrarProblema({ codigo: "auto-referencia-filiacion", ids: [padre], detalle: `${padre} figura como su propio progenitor.` });
      return;
    }
    if (!personas.has(padre) || !personas.has(hijo)) {
      registrarProblema({ codigo: "referencia-ausente", ids: [padre, hijo], detalle: `La filiacion ${padre} -> ${hijo} referencia una persona ausente.` });
      return;
    }
    asegurar(padresPorHijo, hijo).add(padre);
    asegurar(hijosPorPadre, padre).add(hijo);
  };
  const conyuge = (a: string, b: string) => {
    if (a === b) {
      registrarProblema({ codigo: "auto-referencia-conyugal", ids: [a], detalle: `${a} figura como su propio conyuge.` });
      return;
    }
    if (!personas.has(a) || !personas.has(b)) {
      registrarProblema({ codigo: "referencia-ausente", ids: [a, b], detalle: `El vinculo conyugal ${a} <-> ${b} referencia una persona ausente.` });
      return;
    }
    asegurar(conyugesPorPersona, a).add(b);
    asegurar(conyugesPorPersona, b).add(a);
  };

  for (const persona of personas.values()) {
    persona.padres_ids.forEach((padre) => filiacion(padre, persona.id));
    persona.hijos_ids.forEach((hijo) => filiacion(persona.id, hijo));
    persona.conyuges_ids.forEach((pareja) => conyuge(persona.id, pareja));
  }

  for (const [hijo, padres] of padresPorHijo) {
    if (padres.size > 2) {
      registrarProblema({
        codigo: "mas-de-dos-progenitores",
        ids: [hijo, ...ordenarIds(padres, personas)],
        detalle: `${hijo} tiene ${padres.size} progenitores registrados.`,
      });
    }
  }
  detectarCiclosFiliacion(personas, hijosPorPadre).forEach(registrarProblema);

  const familiasPorId = new Map<string, FamiliaArbol>();
  for (const persona of personas.values()) {
    const progenitores = ordenarIds(padresPorHijo.get(persona.id) ?? [], personas);
    if (progenitores.length === 0) continue;
    const id = progenitores.join(":");
    const familia = familiasPorId.get(id) ?? { id, progenitores, hijos: [] };
    familia.hijos.push(persona.id);
    familiasPorId.set(id, familia);
  }
  const familias = [...familiasPorId.values()].map((familia) => ({
    ...familia,
    hijos: ordenarIds(familia.hijos, personas),
  }));

  const visitados = new Set<string>();
  const componentes: ComponenteArbol[] = [];
  for (const persona of [...personas.values()].sort((a, b) => claveOrden(a).localeCompare(claveOrden(b), "es"))) {
    if (visitados.has(persona.id)) continue;
    const ids: string[] = [];
    const cola = [persona.id];
    visitados.add(persona.id);
    for (let indice = 0; indice < cola.length; indice += 1) {
      const id = cola[indice];
      ids.push(id);
      const vecinos = [
        ...(padresPorHijo.get(id) ?? []),
        ...(hijosPorPadre.get(id) ?? []),
        ...(conyugesPorPersona.get(id) ?? []),
      ];
      vecinos.forEach((vecino) => {
        if (!visitados.has(vecino)) {
          visitados.add(vecino);
          cola.push(vecino);
        }
      });
    }
    const idsOrdenados = ordenarIds(ids, personas);
    const sinProgenitores = idsOrdenados.filter((id) => (padresPorHijo.get(id)?.size ?? 0) === 0);
    const conDescendencia = sinProgenitores.filter((id) => (hijosPorPadre.get(id)?.size ?? 0) > 0);
    const raicesAncestrales = conDescendencia.length > 0 ? conDescendencia : sinProgenitores;
    componentes.push({ ids: idsOrdenados, raicesAncestrales });
  }

  return {
    personas,
    padresPorHijo,
    hijosPorPadre,
    conyugesPorPersona,
    familias,
    componentes,
    problemas: [...problemasPorClave.values()],
  };
}

function calcularProfundidades(modelo: ModeloArbol) {
  const pendientes = new Map<string, number>();
  const profundidades = new Map<string, number>();
  const cola: string[] = [];
  for (const id of modelo.personas.keys()) {
    const cantidadPadres = modelo.padresPorHijo.get(id)?.size ?? 0;
    pendientes.set(id, cantidadPadres);
    profundidades.set(id, 0);
    if (cantidadPadres === 0) cola.push(id);
  }
  cola.sort((a, b) => ordenarIds([a, b], modelo.personas).indexOf(a) - ordenarIds([a, b], modelo.personas).indexOf(b));
  for (let indice = 0; indice < cola.length; indice += 1) {
    const padre = cola[indice];
    for (const hijo of modelo.hijosPorPadre.get(padre) ?? []) {
      profundidades.set(hijo, Math.max(profundidades.get(hijo) ?? 0, (profundidades.get(padre) ?? 0) + 1));
      const restantes = (pendientes.get(hijo) ?? 1) - 1;
      pendientes.set(hijo, restantes);
      if (restantes === 0) cola.push(hijo);
    }
  }
  return profundidades;
}

function creariaCicloEnBosque(padre: string, hijo: string, padrePrincipalPorHijo: Map<string, string>) {
  let actual: string | undefined = padre;
  const visitados = new Set<string>();
  while (actual && !visitados.has(actual)) {
    if (actual === hijo) return true;
    visitados.add(actual);
    actual = padrePrincipalPorHijo.get(actual);
  }
  return false;
}

function seleccionarConyugesAdjuntos(modelo: ModeloArbol) {
  const personaAdjuntaAConyuge = new Map<string, string>();
  const conyugesAdjuntosPorPersona = new Map<string, Set<string>>();
  const tieneFiliacion = (id: string) =>
    (modelo.padresPorHijo.get(id)?.size ?? 0) > 0 || (modelo.hijosPorPadre.get(id)?.size ?? 0) > 0;
  const posiblesPropietarios = ordenarIds(modelo.personas.keys(), modelo.personas).sort((a, b) =>
    Number(tieneFiliacion(b)) - Number(tieneFiliacion(a))
    || (modelo.conyugesPorPersona.get(b)?.size ?? 0) - (modelo.conyugesPorPersona.get(a)?.size ?? 0)
    || claveOrden(modelo.personas.get(a)!).localeCompare(claveOrden(modelo.personas.get(b)!), "es"));

  // family-chart mantiene contiguos los conyuges agregados por una persona.
  // Un conyuge adjunto no puede a su vez ser propietario de otro: asi cada
  // tarjeta tiene un unico punto de entrada al layout, incluso con parejas
  // multiples o cadenas de matrimonios.
  for (const propietario of posiblesPropietarios) {
    if (personaAdjuntaAConyuge.has(propietario)) continue;
    for (const pareja of ordenarIds(modelo.conyugesPorPersona.get(propietario) ?? [], modelo.personas)) {
      if (personaAdjuntaAConyuge.has(pareja) || conyugesAdjuntosPorPersona.has(pareja)) continue;
      personaAdjuntaAConyuge.set(pareja, propietario);
      asegurar(conyugesAdjuntosPorPersona, propietario).add(pareja);
    }
  }
  return { personaAdjuntaAConyuge, conyugesAdjuntosPorPersona };
}

type PesosConexionRaices = Map<string, Map<string, number>>;

function asignarRaizPorPersona(
  modelo: ModeloArbol,
  idsComponente: string[],
  raicesBase: string[],
  hijosPorPadrePrincipal: Map<string, Set<string>>,
  personaAdjuntaAConyuge: Map<string, string>,
) {
  const raizPorPersona = new Map<string, string>();
  const idsDelComponente = new Set(idsComponente);
  const indiceRaiz = new Map(raicesBase.map((id, indice) => [id, indice]));

  for (const raiz of raicesBase) {
    const cola = [raiz];
    for (let indice = 0; indice < cola.length; indice += 1) {
      const id = cola[indice];
      if (!idsDelComponente.has(id) || raizPorPersona.has(id)) continue;
      raizPorPersona.set(id, raiz);
      cola.push(...ordenarIds(hijosPorPadrePrincipal.get(id) ?? [], modelo.personas));
    }
  }

  // Los conyuges adjuntos no forman parte de children en la jerarquia de
  // family-chart. Si tienen progenitores propios conservan la raiz de esa
  // filiacion; solo quienes no tienen una rama propia heredan la del conyuge
  // que los posiciona lateralmente.
  let huboCambios = true;
  while (huboCambios) {
    huboCambios = false;
    for (const id of ordenarIds(idsComponente, modelo.personas)) {
      if (raizPorPersona.has(id)) continue;
      const raicesDePadres = [...new Set(
        ordenarIds(modelo.padresPorHijo.get(id) ?? [], modelo.personas)
          .map((padre) => raizPorPersona.get(padre))
          .filter((raiz): raiz is string => !!raiz),
      )].sort((a, b) => (indiceRaiz.get(a) ?? 0) - (indiceRaiz.get(b) ?? 0));
      const propietario = personaAdjuntaAConyuge.get(id);
      const raizPropietario = propietario ? raizPorPersona.get(propietario) : undefined;
      const raiz = raicesDePadres[0] ?? raizPropietario;
      if (!raiz) continue;
      raizPorPersona.set(id, raiz);
      huboCambios = true;
    }
  }

  const raizDeRespaldo = raicesBase[0];
  if (raizDeRespaldo) {
    idsComponente.forEach((id) => {
      if (!raizPorPersona.has(id)) raizPorPersona.set(id, raizDeRespaldo);
    });
  }
  return raizPorPersona;
}

function construirPesosConexionRaices(
  modelo: ModeloArbol,
  idsComponente: string[],
  raizPorPersona: Map<string, string>,
) {
  const pesos: PesosConexionRaices = new Map();
  const idsDelComponente = new Set(idsComponente);
  const parejasContadas = new Set<string>();
  const sumar = (origen: string, destino: string) => {
    const conexiones = pesos.get(origen) ?? new Map<string, number>();
    conexiones.set(destino, (conexiones.get(destino) ?? 0) + 1);
    pesos.set(origen, conexiones);
  };

  for (const persona of ordenarIds(idsComponente, modelo.personas)) {
    for (const pareja of ordenarIds(modelo.conyugesPorPersona.get(persona) ?? [], modelo.personas)) {
      if (!idsDelComponente.has(pareja)) continue;
      const clavePareja = [persona, pareja].sort().join(":");
      if (parejasContadas.has(clavePareja)) continue;
      parejasContadas.add(clavePareja);
      const raizPersona = raizPorPersona.get(persona);
      const raizPareja = raizPorPersona.get(pareja);
      if (!raizPersona || !raizPareja || raizPersona === raizPareja) continue;
      sumar(raizPersona, raizPareja);
      sumar(raizPareja, raizPersona);
    }
  }
  return pesos;
}

function ordenarRaicesPorConectividad(raicesBase: string[], pesos: PesosConexionRaices) {
  if (raicesBase.length < 2) return [...raicesBase];
  const indiceBase = new Map(raicesBase.map((id, indice) => [id, indice]));
  const ordenadas = [raicesBase[0]];
  const pendientes = new Set(raicesBase.slice(1));

  while (pendientes.size > 0) {
    const candidatas = [...pendientes].map((id) => ({
      id,
      peso: ordenadas.reduce((total, colocada) => total + (pesos.get(id)?.get(colocada) ?? 0), 0),
    })).sort((a, b) => b.peso - a.peso || (indiceBase.get(a.id) ?? 0) - (indiceBase.get(b.id) ?? 0));
    const siguiente = candidatas[0].id;
    ordenadas.push(siguiente);
    pendientes.delete(siguiente);
  }
  return ordenadas;
}

function ordenarHijosBase(ids: Iterable<string>, modelo: ModeloArbol) {
  const prioridad = (id: string) => {
    if ((modelo.conyugesPorPersona.get(id)?.size ?? 0) === 0) return 1;
    return modelo.personas.get(id)?.genero === "femenino" ? 0 : 2;
  };
  return [...new Set(ids)].sort((a, b) =>
    prioridad(a) - prioridad(b)
    || claveOrden(modelo.personas.get(a)!).localeCompare(claveOrden(modelo.personas.get(b)!), "es"));
}

function ordenarHijosPorConectividad(
  modelo: ModeloArbol,
  idsComponente: string[],
  raicesOrdenadas: string[],
  raizPorPersona: Map<string, string>,
  hijosPorPadrePrincipal: Map<string, Set<string>>,
  ordenLayoutPorPersona: Map<string, number>,
) {
  const idsDelComponente = new Set(idsComponente);
  const indiceRaiz = new Map(raicesOrdenadas.map((id, indice) => [id, indice]));

  for (const padre of ordenarIds(idsComponente, modelo.personas)) {
    const hijosBase = ordenarHijosBase(hijosPorPadrePrincipal.get(padre) ?? [], modelo);
    if (hijosBase.length === 0) continue;
    const indiceBase = new Map(hijosBase.map((id, indice) => [id, indice]));
    const puntajePorHijo = new Map<string, number>();

    for (const hijo of hijosBase) {
      const raizPropia = raizPorPersona.get(hijo) ?? raizPorPersona.get(padre);
      const indicePropio = raizPropia ? indiceRaiz.get(raizPropia) : undefined;
      let puntaje = 0;
      const cola = [hijo];
      const visitados = new Set<string>();
      for (let indice = 0; indice < cola.length; indice += 1) {
        const persona = cola[indice];
        if (visitados.has(persona)) continue;
        visitados.add(persona);
        cola.push(...ordenarIds(hijosPorPadrePrincipal.get(persona) ?? [], modelo.personas));
        for (const pareja of ordenarIds(modelo.conyugesPorPersona.get(persona) ?? [], modelo.personas)) {
          if (!idsDelComponente.has(pareja)) continue;
          const raizPareja = raizPorPersona.get(pareja);
          const indicePareja = raizPareja ? indiceRaiz.get(raizPareja) : undefined;
          if (indicePropio === undefined || indicePareja === undefined || indicePropio === indicePareja) continue;
          puntaje += Math.sign(indicePareja - indicePropio);
        }
      }
      puntajePorHijo.set(hijo, puntaje);
    }

    const hijosOrdenados = [...hijosBase].sort((a, b) =>
      (puntajePorHijo.get(a) ?? 0) - (puntajePorHijo.get(b) ?? 0)
      || (indiceBase.get(a) ?? 0) - (indiceBase.get(b) ?? 0));
    hijosPorPadrePrincipal.set(padre, new Set(hijosOrdenados));
    hijosOrdenados.forEach((id, indice) => ordenLayoutPorPersona.set(id, indice));
  }
}

function calcularProfundidadesRelativasBosque(
  raices: string[],
  hijosPorPadrePrincipal: Map<string, Set<string>>,
  conyugesAdjuntosPorPersona: Map<string, Set<string>>,
) {
  const profundidades = new Map<string, number>();
  const cola = raices.map((id) => ({ id, profundidad: 1 }));
  for (let indice = 0; indice < cola.length; indice += 1) {
    const { id, profundidad } = cola[indice];
    const existente = profundidades.get(id);
    if (existente !== undefined && existente <= profundidad) continue;
    profundidades.set(id, profundidad);
    for (const conyuge of conyugesAdjuntosPorPersona.get(id) ?? []) {
      cola.push({ id: conyuge, profundidad });
    }
    for (const hijo of hijosPorPadrePrincipal.get(id) ?? []) {
      cola.push({ id: hijo, profundidad: profundidad + 1 });
    }
  }
  return profundidades;
}

function calcularProfundidadesObjetivoRaices(
  modelo: ModeloArbol,
  raices: string[],
  raizPorPersona: Map<string, string>,
  profundidades: Map<string, number>,
) {
  const objetivos = new Map<string, number>();
  for (const raiz of raices) {
    const profundidadesConyugesExternos = ordenarIds(modelo.conyugesPorPersona.get(raiz) ?? [], modelo.personas)
      .filter((conyuge) => raizPorPersona.get(conyuge) !== raiz)
      .map((conyuge) => profundidades.get(conyuge))
      .filter((profundidad): profundidad is number => typeof profundidad === "number");
    objetivos.set(raiz, Math.max(1, ...profundidadesConyugesExternos));
  }
  return objetivos;
}

/*
 * family-chart calcula una jerarquia, no un grafo genealogico con uniones de
 * ramas. Para posicionar cada tarjeta exactamente una vez se elige un solo
 * progenitor tecnico por hijo. Los demas vinculos no se pierden: se dibujan
 * luego desde el modelo canonico mediante crearVinculosVisualesArbol().
 */
export function crearBosqueLayoutArbol(modelo: ModeloArbol): BosqueLayoutArbol {
  const profundidades = calcularProfundidades(modelo);
  const { personaAdjuntaAConyuge, conyugesAdjuntosPorPersona } = seleccionarConyugesAdjuntos(modelo);
  const padrePrincipalPorHijo = new Map<string, string>();
  const hijosPorPadrePrincipal = new Map<string, Set<string>>();
  const ordenLayoutPorPersona = new Map<string, number>();
  const profundidadObjetivoPorRaiz = new Map<string, number>();
  const idsPorProfundidad = ordenarIds(modelo.personas.keys(), modelo.personas).sort((a, b) =>
    (profundidades.get(a) ?? 0) - (profundidades.get(b) ?? 0)
    || claveOrden(modelo.personas.get(a)!).localeCompare(claveOrden(modelo.personas.get(b)!), "es"));

  for (const hijo of idsPorProfundidad) {
    if (personaAdjuntaAConyuge.has(hijo)) continue;
    const candidatos = ordenarIds(modelo.padresPorHijo.get(hijo) ?? [], modelo.personas)
      .filter((padre) => !personaAdjuntaAConyuge.has(padre))
      .sort((a, b) =>
      (profundidades.get(b) ?? 0) - (profundidades.get(a) ?? 0)
      || claveOrden(modelo.personas.get(a)!).localeCompare(claveOrden(modelo.personas.get(b)!), "es"));
    const padre = candidatos.find((candidato) => !creariaCicloEnBosque(candidato, hijo, padrePrincipalPorHijo));
    if (!padre) continue;
    padrePrincipalPorHijo.set(hijo, padre);
    asegurar(hijosPorPadrePrincipal, padre).add(hijo);
  }

  // Las raices de cada componente quedan consecutivas y, dentro del bloque,
  // las unidas por matrimonios cruzados se atraen por peso de conectividad.
  const raices: string[] = [];
  for (const componente of modelo.componentes) {
    const raicesBase = ordenarIds(
      componente.ids.filter((id) => !padrePrincipalPorHijo.has(id) && !personaAdjuntaAConyuge.has(id)),
      modelo.personas,
    );
    const raizPorPersona = asignarRaizPorPersona(
      modelo,
      componente.ids,
      raicesBase,
      hijosPorPadrePrincipal,
      personaAdjuntaAConyuge,
    );
    const pesos = construirPesosConexionRaices(modelo, componente.ids, raizPorPersona);
    const raicesComponente = ordenarRaicesPorConectividad(raicesBase, pesos);
    ordenarHijosPorConectividad(
      modelo,
      componente.ids,
      raicesComponente,
      raizPorPersona,
      hijosPorPadrePrincipal,
      ordenLayoutPorPersona,
    );
    const profundidadesRelativas = calcularProfundidadesRelativasBosque(
      raicesComponente,
      hijosPorPadrePrincipal,
      conyugesAdjuntosPorPersona,
    );
    const objetivosComponente = calcularProfundidadesObjetivoRaices(
      modelo,
      raicesComponente,
      raizPorPersona,
      profundidadesRelativas,
    );
    objetivosComponente.forEach((profundidad, raiz) => profundidadObjetivoPorRaiz.set(raiz, profundidad));
    raices.push(...raicesComponente);
  }
  raices.forEach((id, indice) => ordenLayoutPorPersona.set(id, indice));
  return {
    padrePrincipalPorHijo,
    hijosPorPadrePrincipal,
    personaAdjuntaAConyuge,
    conyugesAdjuntosPorPersona,
    ordenLayoutPorPersona,
    profundidadObjetivoPorRaiz,
    raices,
  };
}

export function crearVinculosVisualesArbol(modelo: ModeloArbol): VinculoVisualArbol[] {
  const vinculos: VinculoVisualArbol[] = [];
  for (const familia of modelo.familias) {
    vinculos.push({
      id: `union-familiar:${familia.id}`,
      tipo: "union-familiar",
      familiaId: familia.id,
      progenitoresIds: [...familia.progenitores],
      hijosIds: [...familia.hijos],
    });
  }
  const parejasAgregadas = new Set<string>();
  for (const persona of ordenarIds(modelo.personas.keys(), modelo.personas)) {
    for (const pareja of ordenarIds(modelo.conyugesPorPersona.get(persona) ?? [], modelo.personas)) {
      const [a, b] = [persona, pareja].sort();
      const clave = `${a}:${b}`;
      if (parejasAgregadas.has(clave)) continue;
      parejasAgregadas.add(clave);
      vinculos.push({ id: `conyugal:${clave}`, tipo: "conyugal", origenId: a, destinoId: b });
    }
  }
  return vinculos;
}

interface GrupoLayoutInterno {
  id: string;
  personas: string[];
  ordenPersonas: string[];
  componenteIndice: number;
  generacion: number;
  anchoPropio: number;
  anchoSubarbol: number;
}

interface ConexionGruposLayout {
  peso: number;
  familias: Set<string>;
}

function anioNacimiento(persona: PersonaArbol) {
  const anio = Number(persona.fecha_nacimiento?.slice(0, 4));
  return Number.isInteger(anio) && anio > 0 ? anio : null;
}

function crearGruposConyugales(modelo: ModeloArbol) {
  const representante = new Map<string, string>();
  modelo.personas.forEach((_persona, id) => representante.set(id, id));
  const buscar = (id: string): string => {
    const padre = representante.get(id) ?? id;
    if (padre === id) return id;
    const raiz = buscar(padre);
    representante.set(id, raiz);
    return raiz;
  };
  const unir = (a: string, b: string) => {
    const raizA = buscar(a);
    const raizB = buscar(b);
    if (raizA === raizB) return;
    const [primero, segundo] = [raizA, raizB].sort((idA, idB) =>
      claveOrden(modelo.personas.get(idA)!).localeCompare(claveOrden(modelo.personas.get(idB)!), "es"));
    representante.set(segundo, primero);
  };
  modelo.conyugesPorPersona.forEach((conyuges, persona) => {
    conyuges.forEach((conyuge) => unir(persona, conyuge));
  });

  const idsPorRepresentante = new Map<string, string[]>();
  modelo.personas.forEach((_persona, id) => {
    const raiz = buscar(id);
    const ids = idsPorRepresentante.get(raiz) ?? [];
    ids.push(id);
    idsPorRepresentante.set(raiz, ids);
  });
  const grupoPorPersona = new Map<string, string>();
  const personasPorGrupo = new Map<string, string[]>();
  idsPorRepresentante.forEach((ids) => {
    const personas = ordenarIds(ids, modelo.personas);
    const grupoId = `grupo:${personas.join(":")}`;
    personasPorGrupo.set(grupoId, personas);
    personas.forEach((id) => grupoPorPersona.set(id, grupoId));
  });
  return { grupoPorPersona, personasPorGrupo };
}

function construirConexionesGrupos(
  modelo: ModeloArbol,
  grupoPorPersona: Map<string, string>,
) {
  const conexiones = new Map<string, Map<string, ConexionGruposLayout>>();
  for (const familia of modelo.familias) {
    const padresPorGrupo = new Map<string, number>();
    familia.progenitores.forEach((progenitor) => {
      const grupo = grupoPorPersona.get(progenitor);
      if (grupo) padresPorGrupo.set(grupo, (padresPorGrupo.get(grupo) ?? 0) + 1);
    });
    for (const hijo of familia.hijos) {
      const grupoHijo = grupoPorPersona.get(hijo);
      if (!grupoHijo) continue;
      padresPorGrupo.forEach((cantidadProgenitores, grupoPadre) => {
        if (grupoPadre === grupoHijo) return;
        const hijos = conexiones.get(grupoPadre) ?? new Map<string, ConexionGruposLayout>();
        const conexion = hijos.get(grupoHijo) ?? { peso: 0, familias: new Set<string>() };
        conexion.peso += cantidadProgenitores;
        conexion.familias.add(familia.id);
        hijos.set(grupoHijo, conexion);
        conexiones.set(grupoPadre, hijos);
      });
    }
  }
  return conexiones;
}

function calcularGeneracionesGrupos(
  modelo: ModeloArbol,
  personasPorGrupo: Map<string, string[]>,
  grupoPorPersona: Map<string, string>,
  conexiones: Map<string, Map<string, ConexionGruposLayout>>,
) {
  const profundidades = calcularProfundidades(modelo);
  const aniosConocidos = [...modelo.personas.values()]
    .map(anioNacimiento)
    .filter((anio): anio is number => anio !== null);
  const anioBase = aniosConocidos.length > 0 ? Math.min(...aniosConocidos) : null;
  const generacionBase = new Map<string, number>();

  personasPorGrupo.forEach((ids, grupoId) => {
    const estimadas = ids
      .map((id) => anioNacimiento(modelo.personas.get(id)!))
      .filter((anio): anio is number => anio !== null)
      .map((anio) => anioBase === null ? 0 : Math.max(0, Math.round((anio - anioBase) / 28)))
      .sort((a, b) => a - b);
    const mediana = estimadas.length === 0 ? 0 : estimadas[Math.floor(estimadas.length / 2)];
    const profundidad = Math.max(...ids.map((id) => profundidades.get(id) ?? 0), 0);
    generacionBase.set(grupoId, Math.max(mediana, profundidad));
  });

  const entrantes = new Map<string, Set<string>>();
  const gradoEntrada = new Map<string, number>();
  personasPorGrupo.forEach((_ids, grupoId) => gradoEntrada.set(grupoId, 0));
  conexiones.forEach((hijos, padre) => {
    hijos.forEach((_conexion, hijo) => {
      if (padre === hijo) return;
      const padres = entrantes.get(hijo) ?? new Set<string>();
      if (!padres.has(padre)) {
        padres.add(padre);
        entrantes.set(hijo, padres);
        gradoEntrada.set(hijo, (gradoEntrada.get(hijo) ?? 0) + 1);
      }
    });
  });

  const claveGrupo = (grupoId: string) => claveOrden(modelo.personas.get(personasPorGrupo.get(grupoId)![0])!);
  const cola = [...gradoEntrada.entries()]
    .filter(([, grado]) => grado === 0)
    .map(([id]) => id)
    .sort((a, b) => claveGrupo(a).localeCompare(claveGrupo(b), "es"));
  const generaciones = new Map(generacionBase);
  for (let indice = 0; indice < cola.length; indice += 1) {
    const grupo = cola[indice];
    const padres = entrantes.get(grupo) ?? new Set<string>();
    const generacionPadres = [...padres]
      .map((padre) => (generaciones.get(padre) ?? 0) + 1)
      .reduce((maxima, actual) => Math.max(maxima, actual), 0);
    generaciones.set(grupo, Math.max(generacionBase.get(grupo) ?? 0, generacionPadres));
    conexiones.get(grupo)?.forEach((_conexion, hijo) => {
      const restante = (gradoEntrada.get(hijo) ?? 1) - 1;
      gradoEntrada.set(hijo, restante);
      if (restante === 0) cola.push(hijo);
    });
  }

  // Un matrimonio que una ancestro y descendiente puede crear un ciclo sólo
  // después de agrupar parejas. Esos grupos conservan la estimación estable y
  // quedan fuera de la jerarquía primaria; los vínculos reales siguen visibles.
  personasPorGrupo.forEach((_ids, grupoId) => {
    if (!generaciones.has(grupoId)) generaciones.set(grupoId, generacionBase.get(grupoId) ?? 0);
  });
  return generaciones;
}

function costoOrdenConyugal(
  orden: string[],
  modelo: ModeloArbol,
) {
  const indice = new Map(orden.map((id, posicion) => [id, posicion]));
  let costo = 0;
  orden.forEach((persona) => {
    modelo.conyugesPorPersona.get(persona)?.forEach((pareja) => {
      if (persona < pareja && indice.has(pareja)) {
        costo += Math.abs((indice.get(persona) ?? 0) - (indice.get(pareja) ?? 0));
      }
    });
  });
  return costo;
}

function ordenarPersonasGrupo(ids: string[], modelo: ModeloArbol) {
  const base = ordenarIds(ids, modelo.personas);
  if (base.length < 3) return base;
  let mejor = [...base];
  let mejorCosto = costoOrdenConyugal(mejor, modelo);
  let mejorDesempate = mejor.map((id) => String(base.indexOf(id)).padStart(3, "0")).join(":");

  if (base.length <= 8) {
    const visitar = (prefijo: string[], pendientes: string[]) => {
      if (pendientes.length === 0) {
        const costo = costoOrdenConyugal(prefijo, modelo);
        const desempate = prefijo.map((id) => String(base.indexOf(id)).padStart(3, "0")).join(":");
        if (costo < mejorCosto || (costo === mejorCosto && desempate < mejorDesempate)) {
          mejor = [...prefijo];
          mejorCosto = costo;
          mejorDesempate = desempate;
        }
        return;
      }
      pendientes.forEach((id, indice) => visitar([...prefijo, id], [...pendientes.slice(0, indice), ...pendientes.slice(indice + 1)]));
    };
    visitar([], base);
    return mejor;
  }

  // Los grupos enormes son excepcionales. La inserción voraz mantiene el
  // costo acotado sin disparar una búsqueda factorial.
  mejor = [];
  for (const id of base) {
    let mejorInsercion = [...mejor, id];
    let costoInsercion = costoOrdenConyugal(mejorInsercion, modelo);
    for (let indice = 0; indice <= mejor.length; indice += 1) {
      const candidata = [...mejor.slice(0, indice), id, ...mejor.slice(indice)];
      const costo = costoOrdenConyugal(candidata, modelo);
      if (costo < costoInsercion) {
        mejorInsercion = candidata;
        costoInsercion = costo;
      }
    }
    mejor = mejorInsercion;
  }
  return mejor;
}

function contarDescendientesGrupo(
  origen: string,
  conexiones: Map<string, Map<string, ConexionGruposLayout>>,
) {
  const visitados = new Set<string>();
  const cola = [...(conexiones.get(origen)?.keys() ?? [])];
  for (let indice = 0; indice < cola.length; indice += 1) {
    const actual = cola[indice];
    if (visitados.has(actual)) continue;
    visitados.add(actual);
    cola.push(...(conexiones.get(actual)?.keys() ?? []));
  }
  visitados.delete(origen);
  return visitados.size;
}

function ordenarRaicesLayout(
  raicesBase: string[],
  padrePrimario: Map<string, string>,
  conexiones: Map<string, Map<string, ConexionGruposLayout>>,
) {
  if (raicesBase.length < 2) return raicesBase;
  const raizDe = (idInicial: string) => {
    let id = idInicial;
    const visitados = new Set<string>();
    while (padrePrimario.has(id) && !visitados.has(id)) {
      visitados.add(id);
      id = padrePrimario.get(id)!;
    }
    return id;
  };
  const pesos = new Map<string, Map<string, number>>();
  const sumar = (a: string, b: string, peso: number) => {
    const destinos = pesos.get(a) ?? new Map<string, number>();
    destinos.set(b, (destinos.get(b) ?? 0) + peso);
    pesos.set(a, destinos);
  };
  conexiones.forEach((hijos, padre) => hijos.forEach((conexion, hijo) => {
    if (padrePrimario.get(hijo) === padre) return;
    const raizPadre = raizDe(padre);
    const raizHijo = raizDe(hijo);
    if (raizPadre === raizHijo) return;
    sumar(raizPadre, raizHijo, conexion.peso);
    sumar(raizHijo, raizPadre, conexion.peso);
  }));

  const indiceBase = new Map(raicesBase.map((id, indice) => [id, indice]));
  const ordenadas = [raicesBase[0]];
  const pendientes = new Set(raicesBase.slice(1));
  while (pendientes.size > 0) {
    const siguiente = [...pendientes].sort((a, b) => {
      const pesoA = ordenadas.reduce((total, colocada) => total + (pesos.get(a)?.get(colocada) ?? 0), 0);
      const pesoB = ordenadas.reduce((total, colocada) => total + (pesos.get(b)?.get(colocada) ?? 0), 0);
      return pesoB - pesoA || (indiceBase.get(a) ?? 0) - (indiceBase.get(b) ?? 0);
    })[0];
    ordenadas.push(siguiente);
    pendientes.delete(siguiente);
  }
  return ordenadas;
}

/**
 * Posicionador propio del mapa. La unidad geométrica es el grupo conyugal y
 * sus ramas familiares; family-chart ya no participa de estas coordenadas.
 * El cálculo es puro: post-orden para anchos y pre-orden para posiciones.
 */
export function calcularLayoutArbol(modelo: ModeloArbol): LayoutArbol {
  if (modelo.personas.size === 0) {
    const limites = { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    return { posiciones: new Map(), nodos: [], ancho: 0, alto: 0, limites };
  }

  const { grupoPorPersona, personasPorGrupo } = crearGruposConyugales(modelo);
  const conexiones = construirConexionesGrupos(modelo, grupoPorPersona);
  const generaciones = calcularGeneracionesGrupos(modelo, personasPorGrupo, grupoPorPersona, conexiones);
  const componentePorPersona = new Map<string, number>();
  modelo.componentes.forEach((componente, indice) => componente.ids.forEach((id) => componentePorPersona.set(id, indice)));
  const claveGrupo = (grupoId: string) => {
    const ids = personasPorGrupo.get(grupoId) ?? [];
    return ids.map((id) => claveOrden(modelo.personas.get(id)!)).sort()[0] ?? grupoId;
  };

  const grupos = new Map<string, GrupoLayoutInterno>();
  personasPorGrupo.forEach((personas, id) => {
    const ordenPersonas = ordenarPersonasGrupo(personas, modelo);
    grupos.set(id, {
      id,
      personas,
      ordenPersonas,
      componenteIndice: componentePorPersona.get(personas[0]) ?? 0,
      generacion: generaciones.get(id) ?? 0,
      anchoPropio: ordenPersonas.length * GEOMETRIA_ARBOL.anchoNodo
        + Math.max(0, ordenPersonas.length - 1) * GEOMETRIA_ARBOL.separacionPareja,
      anchoSubarbol: 0,
    });
  });

  const alcanceDescendientes = new Map<string, number>();
  grupos.forEach((_grupo, id) => alcanceDescendientes.set(id, contarDescendientesGrupo(id, conexiones)));
  const padrePrimario = new Map<string, string>();
  const familiaPrimaria = new Map<string, string>();
  const candidatosPorHijo = new Map<string, Array<{ padre: string; conexion: ConexionGruposLayout }>>();
  conexiones.forEach((hijos, padre) => hijos.forEach((conexion, hijo) => {
    const candidatos = candidatosPorHijo.get(hijo) ?? [];
    candidatos.push({ padre, conexion });
    candidatosPorHijo.set(hijo, candidatos);
  }));

  [...grupos.values()]
    .sort((a, b) => a.generacion - b.generacion || claveGrupo(a.id).localeCompare(claveGrupo(b.id), "es"))
    .forEach((grupo) => {
      const candidatos = (candidatosPorHijo.get(grupo.id) ?? [])
        .filter(({ padre }) => (grupos.get(padre)?.generacion ?? grupo.generacion) < grupo.generacion)
        .sort((a, b) =>
          b.conexion.peso - a.conexion.peso
          || (alcanceDescendientes.get(b.padre) ?? 0) - (alcanceDescendientes.get(a.padre) ?? 0)
          || claveGrupo(a.padre).localeCompare(claveGrupo(b.padre), "es"));
      const elegido = candidatos[0];
      if (!elegido) return;
      padrePrimario.set(grupo.id, elegido.padre);
      familiaPrimaria.set(grupo.id, [...elegido.conexion.familias].sort()[0] ?? `${elegido.padre}>${grupo.id}`);
    });

  const hijosPorPadre = new Map<string, string[]>();
  padrePrimario.forEach((padre, hijo) => {
    const hijos = hijosPorPadre.get(padre) ?? [];
    hijos.push(hijo);
    hijosPorPadre.set(padre, hijos);
  });
  hijosPorPadre.forEach((hijos, padre) => {
    const porFamilia = new Map<string, string[]>();
    hijos.forEach((hijo) => {
      const familia = familiaPrimaria.get(hijo) ?? `${padre}>${hijo}`;
      const integrantes = porFamilia.get(familia) ?? [];
      integrantes.push(hijo);
      porFamilia.set(familia, integrantes);
    });
    const familias = [...porFamilia.entries()].sort(([, hijosA], [, hijosB]) =>
      claveGrupo(hijosA[0]).localeCompare(claveGrupo(hijosB[0]), "es"));
    hijosPorPadre.set(padre, familias.flatMap(([, integrantes]) =>
      integrantes.sort((a, b) => claveGrupo(a).localeCompare(claveGrupo(b), "es"))));
  });

  const separacionHijos = (anterior: string, actual: string) =>
    familiaPrimaria.get(anterior) === familiaPrimaria.get(actual)
      ? GEOMETRIA_ARBOL.separacionEntreHermanos
      : GEOMETRIA_ARBOL.separacionUnidadesFamiliares;
  const anchoCalculado = new Set<string>();
  const calcularAncho = (grupoId: string): number => {
    const grupo = grupos.get(grupoId)!;
    if (anchoCalculado.has(grupoId)) return grupo.anchoSubarbol;
    const hijos = hijosPorPadre.get(grupoId) ?? [];
    const anchoHijos = hijos.reduce((total, hijo, indice) =>
      total + calcularAncho(hijo) + (indice === 0 ? 0 : separacionHijos(hijos[indice - 1], hijo)), 0);
    grupo.anchoSubarbol = Math.max(grupo.anchoPropio, anchoHijos);
    anchoCalculado.add(grupoId);
    return grupo.anchoSubarbol;
  };

  const posicionesSinNormalizar = new Map<string, PosicionPersonaArbol>();
  const colocar = (grupoId: string, inicioX: number) => {
    const grupo = grupos.get(grupoId)!;
    const centroX = inicioX + grupo.anchoSubarbol / 2;
    const pasoPareja = GEOMETRIA_ARBOL.anchoNodo + GEOMETRIA_ARBOL.separacionPareja;
    const inicioPareja = centroX - grupo.anchoPropio / 2 + GEOMETRIA_ARBOL.anchoNodo / 2;
    grupo.ordenPersonas.forEach((id, indice) => posicionesSinNormalizar.set(id, {
      id,
      x: inicioPareja + indice * pasoPareja,
      y: grupo.generacion * GEOMETRIA_ARBOL.separacionVertical,
      generacion: grupo.generacion,
      grupoFamiliarId: grupo.id,
      componenteIndice: grupo.componenteIndice,
    }));

    const hijos = hijosPorPadre.get(grupoId) ?? [];
    const anchoHijos = hijos.reduce((total, hijo, indice) =>
      total + grupos.get(hijo)!.anchoSubarbol + (indice === 0 ? 0 : separacionHijos(hijos[indice - 1], hijo)), 0);
    let cursorHijo = centroX - anchoHijos / 2;
    hijos.forEach((hijo, indice) => {
      colocar(hijo, cursorHijo);
      cursorHijo += grupos.get(hijo)!.anchoSubarbol;
      if (indice < hijos.length - 1) cursorHijo += separacionHijos(hijo, hijos[indice + 1]);
    });
  };

  let cursorComponente = 0;
  modelo.componentes.forEach((_componente, componenteIndice) => {
    const gruposComponente = [...grupos.values()].filter((grupo) => grupo.componenteIndice === componenteIndice);
    const raicesBase = gruposComponente
      .filter((grupo) => !padrePrimario.has(grupo.id))
      .sort((a, b) => a.generacion - b.generacion || claveGrupo(a.id).localeCompare(claveGrupo(b.id), "es"))
      .map(({ id }) => id);
    const raices = ordenarRaicesLayout(raicesBase, padrePrimario, conexiones);
    raices.forEach(calcularAncho);
    let cursorRaiz = cursorComponente;
    raices.forEach((raiz, indice) => {
      colocar(raiz, cursorRaiz);
      cursorRaiz += grupos.get(raiz)!.anchoSubarbol;
      if (indice < raices.length - 1) cursorRaiz += GEOMETRIA_ARBOL.separacionUnidadesFamiliares;
    });
    cursorComponente = cursorRaiz + GEOMETRIA_ARBOL.separacionComponentes;
  });

  const posicionesBase = [...posicionesSinNormalizar.values()];
  const minX = Math.min(...posicionesBase.map(({ x }) => x - GEOMETRIA_ARBOL.anchoNodo / 2));
  const maxX = Math.max(...posicionesBase.map(({ x }) => x + GEOMETRIA_ARBOL.anchoNodo / 2));
  const minY = Math.min(...posicionesBase.map(({ y }) => y - GEOMETRIA_ARBOL.altoNodo / 2));
  const maxY = Math.max(...posicionesBase.map(({ y }) => y + GEOMETRIA_ARBOL.altoNodo / 2));
  const desplazamientoX = GEOMETRIA_ARBOL.margenMapa - minX;
  const desplazamientoY = GEOMETRIA_ARBOL.margenMapa - minY;
  const nodos = posicionesBase
    .map((posicion) => ({ ...posicion, x: posicion.x + desplazamientoX, y: posicion.y + desplazamientoY }))
    .sort((a, b) => a.componenteIndice - b.componenteIndice || a.generacion - b.generacion || a.x - b.x || a.id.localeCompare(b.id, "es"));
  const posiciones = new Map(nodos.map((posicion) => [posicion.id, posicion]));
  const ancho = maxX - minX + GEOMETRIA_ARBOL.margenMapa * 2;
  const alto = maxY - minY + GEOMETRIA_ARBOL.margenMapa * 2;
  return {
    posiciones,
    nodos,
    ancho,
    alto,
    limites: { minX: 0, minY: 0, maxX: ancho, maxY: alto },
  };
}

export function diagnosticarLayoutArbol(modelo: ModeloArbol, layout: LayoutArbol) {
  const faltantes = [...modelo.personas.keys()].filter((id) => !layout.posiciones.has(id));
  const desconocidos = layout.nodos.filter(({ id }) => !modelo.personas.has(id)).map(({ id }) => id);
  const solapamientos: Array<[string, string]> = [];
  for (let indice = 0; indice < layout.nodos.length; indice += 1) {
    for (let otro = indice + 1; otro < layout.nodos.length; otro += 1) {
      const a = layout.nodos[indice];
      const b = layout.nodos[otro];
      if (Math.abs(a.x - b.x) < GEOMETRIA_ARBOL.anchoNodo && Math.abs(a.y - b.y) < GEOMETRIA_ARBOL.altoNodo) {
        solapamientos.push([a.id, b.id]);
      }
    }
  }
  return {
    cantidadPersonas: modelo.personas.size,
    cantidadPosicionadas: layout.posiciones.size,
    faltantes,
    desconocidos,
    solapamientos,
  };
}

export function crearDatosFamilyChart(entrada: PersonaArbol[]): DatoFamilyChart[] {
  const modelo = crearModeloArbol(entrada);
  const bosque = crearBosqueLayoutArbol(modelo);
  const idsUsados = new Set([RAIZ_MAPA_ID, ...modelo.personas.keys()]);
  const padreVirtualPorRaiz = new Map<string, string>();
  const entradasRaizTecnica: string[] = [];
  const nodosVirtuales: DatoFamilyChart[] = [];

  const crearIdVirtual = (raiz: string, nivel: number) => {
    const base = `__arbol_espaciador__:${raiz}:${nivel}`;
    let id = base;
    let sufijo = 1;
    while (idsUsados.has(id)) {
      id = `${base}:${sufijo}`;
      sufijo += 1;
    }
    idsUsados.add(id);
    return id;
  };

  bosque.raices.forEach((raiz, indiceRaiz) => {
    const cantidadEspaciadores = Math.max(0, (bosque.profundidadObjetivoPorRaiz.get(raiz) ?? 1) - 1);
    const idsEspaciadores = Array.from(
      { length: cantidadEspaciadores },
      (_, indice) => crearIdVirtual(raiz, indice + 1),
    );
    entradasRaizTecnica.push(idsEspaciadores[0] ?? raiz);
    idsEspaciadores.forEach((id, indice) => {
      const padre = indice === 0 ? RAIZ_MAPA_ID : idsEspaciadores[indice - 1];
      const hijo = idsEspaciadores[indice + 1] ?? raiz;
      nodosVirtuales.push({
        id,
        data: {
          gender: "M",
          virtual: true,
          orden: `virtual|${String(indiceRaiz).padStart(6, "0")}|${String(indice).padStart(6, "0")}`,
          ordenLayout: bosque.ordenLayoutPorPersona.get(raiz),
          raizLayoutId: raiz,
        },
        rels: { parents: [padre], children: [hijo], spouses: [] },
      });
    });
    const ultimoEspaciador = idsEspaciadores.at(-1);
    if (ultimoEspaciador) padreVirtualPorRaiz.set(raiz, ultimoEspaciador);
  });

  const datos = [...modelo.personas.values()]
    .sort((a, b) => claveOrden(a).localeCompare(claveOrden(b), "es"))
    .map<DatoFamilyChart>((persona) => ({
      id: persona.id,
      data: {
        gender: persona.genero === "femenino" ? "F" : "M",
        nombre: persona.nombre,
        apellido: persona.apellido,
        anios: anios(persona),
        iniciales: iniciales(persona),
        orden: claveOrden(persona),
        sinLineaSangre: (modelo.padresPorHijo.get(persona.id)?.size ?? 0) === 0
          && (modelo.hijosPorPadre.get(persona.id)?.size ?? 0) === 0
          && (modelo.conyugesPorPersona.get(persona.id)?.size ?? 0) > 0,
        sinGeneroDefinido: persona.genero === "no_definido",
        tieneConyuge: (modelo.conyugesPorPersona.get(persona.id)?.size ?? 0) > 0,
        ordenLayout: bosque.ordenLayoutPorPersona.get(persona.id),
      },
      rels: {
        parents: bosque.padrePrincipalPorHijo.has(persona.id)
          ? [bosque.padrePrincipalPorHijo.get(persona.id)!]
          : padreVirtualPorRaiz.has(persona.id) ? [padreVirtualPorRaiz.get(persona.id)!] : [],
        children: [...(bosque.hijosPorPadrePrincipal.get(persona.id) ?? [])],
        // Solo se entrega la orientacion tecnica que mantiene juntas las
        // tarjetas sin duplicarlas. La reciprocidad y todas las lineas reales
        // siguen saliendo del modelo canonico.
        spouses: ordenarIds(bosque.conyugesAdjuntosPorPersona.get(persona.id) ?? [], modelo.personas),
      },
    }));

  return [{
    id: RAIZ_MAPA_ID,
    data: { gender: "M", virtual: true, orden: "" },
    rels: { parents: [], children: entradasRaizTecnica, spouses: [] },
  }, ...nodosVirtuales, ...datos];
}

export function diagnosticarModeloArbol(entrada: PersonaArbol[]) {
  const modelo = crearModeloArbol(entrada);
  const bosque = crearBosqueLayoutArbol(modelo);
  const vinculos = crearVinculosVisualesArbol(modelo);
  return {
    errores: modelo.problemas,
    cantidadPersonas: modelo.personas.size,
    cantidadComponentes: modelo.componentes.length,
    cantidadFiliaciones: [...modelo.hijosPorPadre.values()].reduce((total, hijos) => total + hijos.size, 0),
    cantidadUnionesFamiliares: vinculos.filter((vinculo) => vinculo.tipo === "union-familiar").length,
    cantidadVinculosConyugales: vinculos.filter((vinculo) => vinculo.tipo === "conyugal").length,
    raicesLayout: bosque.raices,
    componentes: modelo.componentes,
    familias: modelo.familias,
  };
}

export function diagnosticarDatosFamilyChart(datos: DatoFamilyChart[]) {
  const porId = new Map(datos.map((dato) => [dato.id, dato]));
  const reales = datos.filter((dato) => !dato.data.virtual);
  const virtuales = datos.filter((dato) => dato.data.virtual);
  const errores: string[] = [];
  const alcanzables = new Set<string>();
  const cola = [RAIZ_MAPA_ID];
  while (cola.length) {
    const id = cola.shift()!;
    if (alcanzables.has(id)) continue;
    alcanzables.add(id);
    const dato = porId.get(id);
    if (dato) [...dato.rels.children, ...dato.rels.spouses].forEach((relacionado) => {
      if (!alcanzables.has(relacionado)) cola.push(relacionado);
    });
  }
  for (const dato of datos) {
    if (dato.id === RAIZ_MAPA_ID) continue;
    for (const padre of dato.rels.parents) {
      if (!porId.get(padre)?.rels.children.includes(dato.id)) errores.push(`${dato.id}: layout sin reciprocidad con ${padre}`);
    }
    for (const hijo of dato.rels.children) {
      if (!porId.get(hijo)?.rels.parents.includes(dato.id)) errores.push(`${dato.id}: layout sin reciprocidad con ${hijo}`);
    }
  }
  const faltantes = reales
    .filter((dato) => !alcanzables.has(dato.id))
    .map((dato) => ({ id: dato.id, motivo: "persona sin camino unico desde la raiz tecnica" }));
  faltantes.forEach(({ id, motivo }) => errores.push(`${id}: ${motivo}`));
  const resolverRaizReal = (idInicial: string) => {
    let id = idInicial;
    const visitados = new Set<string>();
    while (porId.get(id)?.data.virtual && !visitados.has(id)) {
      visitados.add(id);
      const hijos = porId.get(id)?.rels.children ?? [];
      if (hijos.length !== 1) return null;
      id = hijos[0];
    }
    return porId.get(id)?.data.virtual ? null : id;
  };
  const raicesLayout = (porId.get(RAIZ_MAPA_ID)?.rels.children ?? [])
    .map(resolverRaizReal)
    .filter((id): id is string => !!id);
  return {
    errores,
    cantidadPersonas: reales.length,
    cantidadAlcanzables: reales.length - faltantes.length,
    cantidadNodosVirtuales: virtuales.length,
    faltantes,
    raicesLayout,
  };
}
