import type { PersonaArbol } from "@/lib/supabase/types";

export const RAIZ_MAPA_ID = "__arbol_mapa_raiz__";

// Única fuente de dimensiones para el DOM de las fichas y el cálculo de
// posiciones de family-chart. Las separaciones conservan aire suficiente
// alrededor de tarjetas con nombres de hasta dos líneas.
export const GEOMETRIA_ARBOL = {
  anchoNodo: 176,
  altoNodo: 92,
  separacionHorizontal: 216,
  separacionVertical: 148,
} as const;

export interface DatoFamilyChart {
  id: string;
  data: { gender: "M" | "F"; nombre?: string; apellido?: string; anios?: string; iniciales?: string; orden: string; virtual?: boolean; sinLineaSangre?: boolean; sinGeneroDefinido?: boolean };
  rels: { parents: string[]; children: string[]; spouses: string[] };
}

export interface FamiliaArbol {
  id: string;
  progenitores: string[];
  hijos: string[];
}

export type CriterioAnclaArbol = "raiz-con-descendencia" | "relacion-de-sangre" | "solo-conyugal";

export interface ComponenteArbol {
  ids: string[];
  ancla: string;
  criterioAncla: CriterioAnclaArbol;
}

export interface ModeloArbol {
  personas: Map<string, PersonaArbol>;
  padresPorHijo: Map<string, Set<string>>;
  hijosPorPadre: Map<string, Set<string>>;
  conyugesPorPersona: Map<string, Set<string>>;
  familias: FamiliaArbol[];
  componentes: ComponenteArbol[];
}

// Superconjunto mínimo compatible tanto con DatoFamilyChart como con Datum
// de family-chart, que permite pasar estas funciones directo a su API.
interface DatoOrdenableParaLayout {
  id: string;
  data: { gender: "M" | "F"; orden?: string };
  rels: { spouses: string[] };
}

function claveOrden(persona: PersonaArbol) { return `${persona.fecha_nacimiento ?? "9999-99-99"}|${persona.apellido}|${persona.nombre}|${persona.id}`.toLocaleLowerCase("es"); }
function anios(persona: PersonaArbol) { return [persona.fecha_nacimiento?.slice(0, 4), persona.fecha_fallecimiento?.slice(0, 4)].filter(Boolean).join(" — "); }
function iniciales(persona: PersonaArbol) { return `${persona.nombre.charAt(0)}${persona.apellido.charAt(0)}`.toLocaleUpperCase("es"); }
function asegurar(mapa: Map<string, Set<string>>, id: string) { if (!mapa.has(id)) mapa.set(id, new Set()); return mapa.get(id)!; }
function ordenarIds(ids: Iterable<string>, personas: Map<string, PersonaArbol>) {
  const prioridadGenero = (id: string) => personas.get(id)?.genero === "masculino" ? 0 : personas.get(id)?.genero === "femenino" ? 1 : 2;
  return [...new Set(ids)].filter((id) => personas.has(id)).sort((a, b) => prioridadGenero(a) - prioridadGenero(b) || claveOrden(personas.get(a)!).localeCompare(claveOrden(personas.get(b)!), "es"));
}

function descendenciaAlcanzable(id: string, hijosPorPadre: Map<string, Set<string>>) {
  const alcanzados = new Set<string>();
  const cola = [id];
  while (cola.length) {
    const actual = cola.shift()!;
    if (alcanzados.has(actual)) continue;
    alcanzados.add(actual);
    (hijosPorPadre.get(actual) ?? []).forEach((hijo) => { if (!alcanzados.has(hijo)) cola.push(hijo); });
  }
  return alcanzados.size;
}

function seleccionarAnclaComponente(
  ids: string[],
  personas: Map<string, PersonaArbol>,
  padresPorHijo: Map<string, Set<string>>,
  hijosPorPadre: Map<string, Set<string>>,
): Pick<ComponenteArbol, "ancla" | "criterioAncla"> {
  const tienePadres = (id: string) => (padresPorHijo.get(id)?.size ?? 0) > 0;
  const tieneHijos = (id: string) => (hijosPorPadre.get(id)?.size ?? 0) > 0;
  const ordenarCandidatas = (candidatas: string[]) => [...candidatas].sort((a, b) => {
    // Dentro de la misma preferencia se usa la rama de descendencia más
    // extensa. family-chart sólo recorre children desde el ancla, por lo que
    // esto evita que una raíz lateral deje fuera a ancestros de su cónyuge.
    const diferenciaCobertura = descendenciaAlcanzable(b, hijosPorPadre) - descendenciaAlcanzable(a, hijosPorPadre);
    return diferenciaCobertura || ordenarIds([a, b], personas).indexOf(a) - ordenarIds([a, b], personas).indexOf(b);
  });

  const raicesConDescendencia = ids.filter((id) => !tienePadres(id) && tieneHijos(id));
  if (raicesConDescendencia.length) return { ancla: ordenarCandidatas(raicesConDescendencia)[0], criterioAncla: "raiz-con-descendencia" };

  const conRelacionDeSangre = ids.filter((id) => tienePadres(id) || tieneHijos(id));
  if (conRelacionDeSangre.length) return { ancla: ordenarCandidatas(conRelacionDeSangre)[0], criterioAncla: "relacion-de-sangre" };

  // Si no hay filiaciones en absoluto, una pareja o una persona aislada es
  // el único punto de entrada posible. Se mantiene el orden estable.
  return { ancla: ordenarIds(ids, personas)[0], criterioAncla: "solo-conyugal" };
}

// family-chart inserta la pareja a la izquierda de una mujer y a la derecha
// de un varón. Llevar esos hermanos a los extremos mantiene consecutivo el
// bloque de hermanos y deja la pareja junto a la persona correspondiente.
export function compararHijosParaLayout(a: DatoOrdenableParaLayout, b: DatoOrdenableParaLayout) {
  const prioridad = (dato: DatoOrdenableParaLayout) => {
    if (dato.rels.spouses.length === 0) return 1;
    return dato.data.gender === "F" ? 0 : 2;
  };
  const orden = (dato: DatoOrdenableParaLayout) => typeof dato.data.orden === "string" ? dato.data.orden : "";
  return prioridad(a) - prioridad(b) || orden(a).localeCompare(orden(b), "es");
}

export function ordenarConyugesParaLayout(persona: DatoOrdenableParaLayout, datos: DatoOrdenableParaLayout[]) {
  const orden = (id: string) => {
    const valor = datos.find((dato) => dato.id === id)?.data.orden;
    return typeof valor === "string" ? valor : "";
  };
  persona.rels.spouses.sort((a, b) => orden(a).localeCompare(orden(b), "es"));
}

/*
 * Modelo canónico: una familia no se infiere desde el primer cónyuge de
 * alguien. Es una unidad formada por la combinación concreta de progenitores
 * declarados por cada hijo (también admite un único progenitor). De él se
 * derivan, una sola vez, los rels que consume family-chart.
 */
export function crearModeloArbol(entrada: PersonaArbol[]): ModeloArbol {
  const personas = new Map<string, PersonaArbol>();
  entrada.forEach((persona) => { if (!personas.has(persona.id)) personas.set(persona.id, persona); });
  const padresPorHijo = new Map<string, Set<string>>();
  const hijosPorPadre = new Map<string, Set<string>>();
  const conyugesPorPersona = new Map<string, Set<string>>();
  const filiacion = (padre: string, hijo: string) => {
    if (padre === hijo || !personas.has(padre) || !personas.has(hijo)) return;
    asegurar(padresPorHijo, hijo).add(padre);
    asegurar(hijosPorPadre, padre).add(hijo);
  };
  const conyuge = (a: string, b: string) => {
    if (a === b || !personas.has(a) || !personas.has(b)) return;
    asegurar(conyugesPorPersona, a).add(b);
    asegurar(conyugesPorPersona, b).add(a);
  };
  for (const persona of personas.values()) {
    persona.padres_ids.forEach((padre) => filiacion(padre, persona.id));
    persona.hijos_ids.forEach((hijo) => filiacion(persona.id, hijo));
    persona.conyuges_ids.forEach((pareja) => conyuge(persona.id, pareja));
  }

  const familiasPorId = new Map<string, FamiliaArbol>();
  for (const persona of personas.values()) {
    const progenitores = ordenarIds(padresPorHijo.get(persona.id) ?? [], personas);
    if (progenitores.length === 0) continue;
    const id = progenitores.join(":");
    const familia = familiasPorId.get(id) ?? { id, progenitores, hijos: [] };
    familia.hijos.push(persona.id);
    familiasPorId.set(id, familia);
  }
  const familias = [...familiasPorId.values()].map((familia) => ({ ...familia, hijos: ordenarIds(familia.hijos, personas) }));

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
      const vecinos = [...(padresPorHijo.get(id) ?? []), ...(hijosPorPadre.get(id) ?? []), ...(conyugesPorPersona.get(id) ?? [])];
      vecinos.forEach((vecino) => { if (!visitados.has(vecino)) { visitados.add(vecino); cola.push(vecino); } });
    }
    const ancla = seleccionarAnclaComponente(ids, personas, padresPorHijo, hijosPorPadre);
    componentes.push({ ids, ...ancla });
  }
  return { personas, padresPorHijo, hijosPorPadre, conyugesPorPersona, familias, componentes };
}

export function crearDatosFamilyChart(entrada: PersonaArbol[]): DatoFamilyChart[] {
  const modelo = crearModeloArbol(entrada);
  const datos = [...modelo.personas.values()].sort((a, b) => claveOrden(a).localeCompare(claveOrden(b), "es")).map<DatoFamilyChart>((persona) => ({
    id: persona.id,
    data: {
      gender: persona.genero === "femenino" ? "F" : "M",
      nombre: persona.nombre,
      apellido: persona.apellido,
      anios: anios(persona),
      iniciales: iniciales(persona),
      orden: claveOrden(persona),
      // No es una etiqueta de sangre ni se persiste: sólo distingue a quien
      // aparece en este componente exclusivamente por ser pareja de alguien.
      sinLineaSangre: (modelo.padresPorHijo.get(persona.id)?.size ?? 0) === 0
        && (modelo.hijosPorPadre.get(persona.id)?.size ?? 0) === 0
        && (modelo.conyugesPorPersona.get(persona.id)?.size ?? 0) > 0,
      // Puramente visual: pinta la ficha en tono neutro cuando no hay género
      // cargado, sin tocar `gender` (M/F), que sigue usando family-chart para
      // el layout y el orden de cónyuges dentro de cada generación.
      sinGeneroDefinido: persona.genero === "no_definido",
    },
    rels: {
      parents: ordenarIds(modelo.padresPorHijo.get(persona.id) ?? [], modelo.personas),
      children: ordenarIds(modelo.hijosPorPadre.get(persona.id) ?? [], modelo.personas),
      spouses: ordenarIds(modelo.conyugesPorPersona.get(persona.id) ?? [], modelo.personas),
    },
  }));
  // Root es una ancla de layout, no un padre técnico: sólo sale hacia una
  // persona por componente. Así no altera la familia real de esa persona.
  return [{ id: RAIZ_MAPA_ID, data: { gender: "M", virtual: true, orden: "" }, rels: { parents: [], children: modelo.componentes.map((componente) => componente.ancla), spouses: [] } }, ...datos];
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
    if (dato) [...dato.rels.parents, ...dato.rels.children, ...dato.rels.spouses].forEach((relacionado) => { if (!alcanzables.has(relacionado)) cola.push(relacionado); });
  }
  for (const dato of reales) {
    for (const padre of dato.rels.parents) if (!porId.get(padre)?.rels.children.includes(dato.id)) errores.push(`${dato.id}: filiación sin reciprocidad con ${padre}`);
    for (const hijo of dato.rels.children) if (!porId.get(hijo)?.rels.parents.includes(dato.id)) errores.push(`${dato.id}: hijo sin reciprocidad con ${hijo}`);
    for (const pareja of dato.rels.spouses) if (!porId.get(pareja)?.rels.spouses.includes(dato.id)) errores.push(`${dato.id}: pareja sin reciprocidad con ${pareja}`);
  }
  const faltantes = reales.filter((dato) => !alcanzables.has(dato.id)).map((dato) => ({ id: dato.id, motivo: "componente sin ancla alcanzable" }));
  faltantes.forEach(({ id, motivo }) => errores.push(`${id}: ${motivo}`));
  const modelo = crearModeloArbol(reales.map((dato) => ({ id: dato.id, nombre: dato.data.nombre ?? "", apellido: dato.data.apellido ?? "", genero: dato.data.gender === "F" ? "femenino" : "masculino", fecha_nacimiento: null, lugar_nacimiento: null, fecha_fallecimiento: null, lugar_fallecimiento: null, notas: null, created_at: "", updated_at: "", padres_ids: dato.rels.parents, hijos_ids: dato.rels.children, conyuges_ids: dato.rels.spouses, hermanos_ids: [] })));
  return {
    errores,
    cantidadPersonas: reales.length,
    cantidadAlcanzables: reales.length - faltantes.length,
    faltantes,
    anclas: modelo.componentes.map((componente) => componente.ancla),
    componentes: modelo.componentes.map((componente) => ({ ancla: componente.ancla, criterioAncla: componente.criterioAncla, personas: componente.ids })),
    familias: modelo.familias,
  };
}
