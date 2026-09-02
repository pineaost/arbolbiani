import type { PersonaArbol } from "@/lib/supabase/types";

export const RAIZ_MAPA_ID = "__arbol_mapa_raiz__";

// Unica fuente de dimensiones para el DOM de las fichas, el calculo de
// posiciones de family-chart y los vinculos normalizados superpuestos.
export const GEOMETRIA_ARBOL = {
  anchoNodo: 176,
  altoNodo: 92,
  separacionHorizontal: 216,
  separacionVertical: 148,
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
  raices: string[];
}

export interface VinculoVisualArbol {
  id: string;
  tipo: "filiacion" | "conyugal";
  origenId: string;
  destinoId: string;
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
    raices.push(...raicesComponente);
  }
  raices.forEach((id, indice) => ordenLayoutPorPersona.set(id, indice));
  return {
    padrePrincipalPorHijo,
    hijosPorPadrePrincipal,
    personaAdjuntaAConyuge,
    conyugesAdjuntosPorPersona,
    ordenLayoutPorPersona,
    raices,
  };
}

export function crearVinculosVisualesArbol(modelo: ModeloArbol): VinculoVisualArbol[] {
  const vinculos: VinculoVisualArbol[] = [];
  for (const padre of ordenarIds(modelo.personas.keys(), modelo.personas)) {
    for (const hijo of ordenarIds(modelo.hijosPorPadre.get(padre) ?? [], modelo.personas)) {
      vinculos.push({ id: `filiacion:${padre}:${hijo}`, tipo: "filiacion", origenId: padre, destinoId: hijo });
    }
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

export function crearDatosFamilyChart(entrada: PersonaArbol[]): DatoFamilyChart[] {
  const modelo = crearModeloArbol(entrada);
  const bosque = crearBosqueLayoutArbol(modelo);
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
        parents: bosque.padrePrincipalPorHijo.has(persona.id) ? [bosque.padrePrincipalPorHijo.get(persona.id)!] : [],
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
    rels: { parents: [], children: bosque.raices, spouses: [] },
  }, ...datos];
}

export function diagnosticarModeloArbol(entrada: PersonaArbol[]) {
  const modelo = crearModeloArbol(entrada);
  const bosque = crearBosqueLayoutArbol(modelo);
  const vinculos = crearVinculosVisualesArbol(modelo);
  return {
    errores: modelo.problemas,
    cantidadPersonas: modelo.personas.size,
    cantidadComponentes: modelo.componentes.length,
    cantidadFiliaciones: vinculos.filter((vinculo) => vinculo.tipo === "filiacion").length,
    cantidadVinculosConyugales: vinculos.filter((vinculo) => vinculo.tipo === "conyugal").length,
    raicesLayout: bosque.raices,
    componentes: modelo.componentes,
    familias: modelo.familias,
  };
}

export function diagnosticarDatosFamilyChart(datos: DatoFamilyChart[]) {
  const porId = new Map(datos.map((dato) => [dato.id, dato]));
  const reales = datos.filter((dato) => dato.id !== RAIZ_MAPA_ID);
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
  for (const dato of reales) {
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
  return {
    errores,
    cantidadPersonas: reales.length,
    cantidadAlcanzables: reales.length - faltantes.length,
    faltantes,
    raicesLayout: porId.get(RAIZ_MAPA_ID)?.rels.children ?? [],
  };
}
