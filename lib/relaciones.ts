import { requerirUsuarioAutenticado } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { adjuntarNivelInformacion } from "@/lib/personas";
import type {
  Documento,
  Persona,
  PersonaArbol,
  PersonaConVinculos,
  PersonaFicha,
  VinculoConyugeFicha,
  VinculoFiliacionFicha,
} from "@/lib/supabase/types";

export interface FilaFiliacionArbol {
  id?: string;
  padre_id: string;
  hijo_id: string;
}

export interface FilaConyugeArbol {
  id?: string;
  persona1_id: string;
  persona2_id: string;
}

interface PaginaSupabase<T> {
  data: T[] | null;
  error: { message: string } | null;
}

const TAMANIO_PAGINA_ARBOL = 1000;

export type CodigoProblemaFilasArbol =
  | "persona-duplicada"
  | "referencia-ausente-filiacion"
  | "referencia-ausente-conyuge"
  | "auto-referencia-filiacion"
  | "auto-referencia-conyuge"
  | "filiacion-duplicada";

export interface ProblemaFilasArbol {
  codigo: CodigoProblemaFilasArbol;
  filaId?: string;
  ids: string[];
  detalle: string;
}

/** Audita las filas crudas antes de que Set normalice o deduplique nada. */
export function diagnosticarFilasArbol(
  personas: Persona[],
  filiaciones: FilaFiliacionArbol[],
  conyuges: FilaConyugeArbol[],
): ProblemaFilasArbol[] {
  const problemas: ProblemaFilasArbol[] = [];
  const ids = new Set<string>();
  personas.forEach((persona) => {
    if (ids.has(persona.id)) {
      problemas.push({ codigo: "persona-duplicada", ids: [persona.id], detalle: `La persona ${persona.id} aparece mas de una vez.` });
    }
    ids.add(persona.id);
  });
  const filiacionesVistas = new Set<string>();
  filiaciones.forEach((fila) => {
    const filaId = fila.id;
    if (fila.padre_id === fila.hijo_id) {
      problemas.push({ codigo: "auto-referencia-filiacion", filaId, ids: [fila.padre_id], detalle: "Una filiacion vincula a una persona consigo misma." });
    }
    const ausentes = [fila.padre_id, fila.hijo_id].filter((id) => !ids.has(id));
    if (ausentes.length > 0) {
      problemas.push({ codigo: "referencia-ausente-filiacion", filaId, ids: ausentes, detalle: "Una filiacion referencia personas que no fueron recuperadas." });
    }
    const clave = `${fila.padre_id}->${fila.hijo_id}`;
    if (filiacionesVistas.has(clave)) {
      problemas.push({ codigo: "filiacion-duplicada", filaId, ids: [fila.padre_id, fila.hijo_id], detalle: "La misma filiacion aparece mas de una vez." });
    }
    filiacionesVistas.add(clave);
  });
  conyuges.forEach((fila) => {
    const filaId = fila.id;
    if (fila.persona1_id === fila.persona2_id) {
      problemas.push({ codigo: "auto-referencia-conyuge", filaId, ids: [fila.persona1_id], detalle: "Un vinculo conyugal relaciona a una persona consigo misma." });
    }
    const ausentes = [fila.persona1_id, fila.persona2_id].filter((id) => !ids.has(id));
    if (ausentes.length > 0) {
      problemas.push({ codigo: "referencia-ausente-conyuge", filaId, ids: ausentes, detalle: "Un vinculo conyugal referencia personas que no fueron recuperadas." });
    }
  });
  return problemas;
}

export async function obtenerTodasLasFilas<T>(
  obtenerPagina: (desde: number, hasta: number) => PromiseLike<PaginaSupabase<T>>,
): Promise<{ data: T[]; error: { message: string } | null }> {
  const data: T[] = [];
  for (let desde = 0; ; desde += TAMANIO_PAGINA_ARBOL) {
    const pagina = await obtenerPagina(desde, desde + TAMANIO_PAGINA_ARBOL - 1);
    if (pagina.error) return { data, error: pagina.error };
    const filas = pagina.data ?? [];
    data.push(...filas);
    if (filas.length < TAMANIO_PAGINA_ARBOL) return { data, error: null };
  }
}

export async function getPersonasArbol(): Promise<PersonaArbol[]> {
  // La página y su layout se renderizan de forma concurrente. Esta validación
  // evita iniciar consultas protegidas suponiendo que el layout terminó antes.
  const { supabase } = await requerirUsuarioAutenticado();
  const [personasData, filiacionesData, conyugesData] = await Promise.all([
    obtenerTodasLasFilas<Persona>((desde, hasta) => supabase
      .from("personas")
      .select("*")
      .order("apellido", { ascending: true })
      .order("nombre", { ascending: true })
      .order("id", { ascending: true })
      .range(desde, hasta)),
    obtenerTodasLasFilas<FilaFiliacionArbol>((desde, hasta) => supabase
      .from("relaciones_filiacion")
      .select("id, padre_id, hijo_id")
      .order("padre_id", { ascending: true })
      .order("hijo_id", { ascending: true })
      .order("id", { ascending: true })
      .range(desde, hasta)),
    obtenerTodasLasFilas<FilaConyugeArbol>((desde, hasta) => supabase
      .from("relaciones_conyuge")
      .select("id, persona1_id, persona2_id")
      .order("persona1_id", { ascending: true })
      .order("persona2_id", { ascending: true })
      .order("id", { ascending: true })
      .range(desde, hasta)),
  ]);

  const error = personasData.error || filiacionesData.error || conyugesData.error;
  if (error) {
    console.error("Error al obtener datos del árbol:", error.message);
    throw new Error("No se pudo cargar el árbol familiar.");
  }

  const problemas = diagnosticarFilasArbol(personasData.data, filiacionesData.data, conyugesData.data);
  if (problemas.length > 0) {
    console.error("[Árbol Biani] Se rechazaron datos relacionales inconsistentes:", problemas);
    throw new Error(`El árbol contiene ${problemas.length} relaciones o personas inconsistentes. No se modificaron los datos.`);
  }
  return normalizarPersonasArbol(personasData.data, filiacionesData.data, conyugesData.data);
}

export function normalizarPersonasArbol(
  personas: Persona[],
  filiaciones: FilaFiliacionArbol[],
  conyuges: FilaConyugeArbol[],
): PersonaArbol[] {
  const problemas = diagnosticarFilasArbol(personas, filiaciones, conyuges);
  if (problemas.length > 0) {
    throw new Error(`No se pueden normalizar ${problemas.length} filas inconsistentes del árbol.`);
  }
  const padresPorHijo = new Map<string, Set<string>>();
  const hijosPorPadre = new Map<string, Set<string>>();
  const conyugesPorPersona = new Map<string, Set<string>>();

  for (const fila of filiaciones) {
    if (!padresPorHijo.has(fila.hijo_id)) padresPorHijo.set(fila.hijo_id, new Set());
    if (!hijosPorPadre.has(fila.padre_id)) hijosPorPadre.set(fila.padre_id, new Set());
    padresPorHijo.get(fila.hijo_id)?.add(fila.padre_id);
    hijosPorPadre.get(fila.padre_id)?.add(fila.hijo_id);
  }

  for (const fila of conyuges) {
    if (!conyugesPorPersona.has(fila.persona1_id)) conyugesPorPersona.set(fila.persona1_id, new Set());
    if (!conyugesPorPersona.has(fila.persona2_id)) conyugesPorPersona.set(fila.persona2_id, new Set());
    conyugesPorPersona.get(fila.persona1_id)?.add(fila.persona2_id);
    conyugesPorPersona.get(fila.persona2_id)?.add(fila.persona1_id);
  }

  const orden = new Map(personas.map((persona, indice) => [persona.id, indice]));
  const ordenarIds = (valores: Iterable<string>) =>
    Array.from(valores).sort((a, b) => (orden.get(a) ?? 0) - (orden.get(b) ?? 0));

  return personas.map((persona) => {
    const padres = padresPorHijo.get(persona.id) ?? new Set<string>();
    const hermanos = new Set<string>();
    for (const padreId of padres) {
      for (const hijoId of hijosPorPadre.get(padreId) ?? []) {
        if (hijoId !== persona.id) hermanos.add(hijoId);
      }
    }

    return {
      ...persona,
      padres_ids: ordenarIds(padres),
      hijos_ids: ordenarIds(hijosPorPadre.get(persona.id) ?? []),
      conyuges_ids: ordenarIds(conyugesPorPersona.get(persona.id) ?? []),
      hermanos_ids: ordenarIds(hermanos),
    };
  });
}

// Nota sobre el patrón de embeds: usamos el embed automático de
// PostgREST (`padre:padre_id(*)`) en vez de traer los ids y hacer un
// segundo select, para no duplicar consultas. Como el proyecto no usa
// tipos generados de Supabase, el resultado se castea explícitamente
// contra los tipos manuales de /lib/supabase/types, igual que en el
// resto del proyecto.

export async function getPadres(personaId: string): Promise<Persona[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("relaciones_filiacion")
    .select("padre:padre_id(*)")
    .eq("hijo_id", personaId);

  if (error) {
    console.error("Error al obtener padres:", error.message);
    throw new Error("No se pudieron cargar los padres.");
  }

  return ((data ?? []) as unknown as { padre: Persona | null }[])
    .map((fila) => fila.padre)
    .filter((padre): padre is Persona => !!padre);
}

export async function getHijos(personaId: string): Promise<Persona[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("relaciones_filiacion")
    .select("hijo:hijo_id(*)")
    .eq("padre_id", personaId);

  if (error) {
    console.error("Error al obtener hijos:", error.message);
    throw new Error("No se pudieron cargar los hijos.");
  }

  return ((data ?? []) as unknown as { hijo: Persona | null }[])
    .map((fila) => fila.hijo)
    .filter((hijo): hijo is Persona => !!hijo);
}

export async function getConyuges(personaId: string): Promise<Persona[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("relaciones_conyuge")
    .select("persona1:persona1_id(*), persona2:persona2_id(*)")
    .or(`persona1_id.eq.${personaId},persona2_id.eq.${personaId}`);

  if (error) {
    console.error("Error al obtener cónyuges:", error.message);
    throw new Error("No se pudieron cargar los cónyuges.");
  }

  return ((data ?? []) as unknown as {
    persona1: Persona | null;
    persona2: Persona | null;
  }[])
    .map((fila) => {
      if (fila.persona1?.id === personaId) return fila.persona2;
      if (fila.persona2?.id === personaId) return fila.persona1;
      return null;
    })
    .filter((conyuge): conyuge is Persona => !!conyuge);
}

export async function getPersonaConVinculos(
  personaId: string
): Promise<PersonaConVinculos | null> {
  const supabase = await createClient();

  const { data: persona, error } = await supabase
    .from("personas")
    .select("*")
    .eq("id", personaId)
    .single();

  if (error || !persona) {
    if (error) console.error("Error al obtener persona:", error.message);
    return null;
  }

  const [padres, hijos, conyuges, personasConNivel] = await Promise.all([
    getPadres(personaId),
    getHijos(personaId),
    getConyuges(personaId),
    adjuntarNivelInformacion(supabase, [persona as Persona]),
  ]);

  const personaConNivel = personasConNivel[0];
  if (!personaConNivel) return null;

  return { ...personaConNivel, padres, hijos, conyuges };
}

export async function getPersonaFicha(
  personaId: string
): Promise<PersonaFicha | null> {
  const supabase = await createClient();

  const { data: persona, error: errorPersona } = await supabase
    .from("personas")
    .select("*")
    .eq("id", personaId)
    .single();

  if (errorPersona || !persona) {
    if (errorPersona) console.error("Error al obtener persona:", errorPersona.message);
    return null;
  }

  const [padresData, hijosData, conyugesData, documentosData, bitacoraData, personasConNivel] =
    await Promise.all([
      supabase
        .from("relaciones_filiacion")
        .select("id, padre_id, hijo_id, created_at, persona:padre_id(*)")
        .eq("hijo_id", personaId),
      supabase
        .from("relaciones_filiacion")
        .select("id, padre_id, hijo_id, created_at, persona:hijo_id(*)")
        .eq("padre_id", personaId),
      supabase
        .from("relaciones_conyuge")
        .select("id, persona1_id, persona2_id, fecha_inicio, fecha_fin, notas, created_at, persona1:persona1_id(*), persona2:persona2_id(*)")
        .or(`persona1_id.eq.${personaId},persona2_id.eq.${personaId}`),
      supabase
        .from("documento_persona")
        .select("documento:documento_id(*)")
        .eq("persona_id", personaId),
      supabase
        .from("bitacora")
        .select("id, tipo, contenido, persona_id, estado, created_at, updated_at")
        .eq("persona_id", personaId)
        .order("updated_at", { ascending: false }),
      adjuntarNivelInformacion(supabase, [persona as Persona]),
    ]);

  const errorRelacion = padresData.error || hijosData.error || conyugesData.error || documentosData.error || bitacoraData.error;
  if (errorRelacion) {
    console.error("Error al obtener vínculos de la ficha:", errorRelacion.message);
    throw new Error("No se pudieron cargar los vínculos de la persona.");
  }

  const padres = ((padresData.data ?? []) as unknown as VinculoFiliacionFicha[])
    .filter((vinculo) => vinculo.persona);
  const hijos = ((hijosData.data ?? []) as unknown as VinculoFiliacionFicha[])
    .filter((vinculo) => vinculo.persona);
  const conyuges = ((conyugesData.data ?? []) as unknown as Array<
    Omit<VinculoConyugeFicha, "conyuge"> & {
      persona1: Persona | null;
      persona2: Persona | null;
    }
  >)
    .map(({ persona1, persona2, ...vinculo }) => {
      const conyuge = persona1?.id === personaId
        ? persona2
        : persona2?.id === personaId
          ? persona1
          : null;

      return conyuge ? { ...vinculo, conyuge } : null;
    })
    .filter((vinculo): vinculo is VinculoConyugeFicha => !!vinculo);

  const documentos = ((documentosData.data ?? []) as unknown as {
    documento: Documento | null;
  }[])
    .map((vinculo) => vinculo.documento)
    .filter((documento): documento is Documento => !!documento);

  const personaConNivel = personasConNivel[0];
  if (!personaConNivel) return null;

  return { ...personaConNivel, padres, hijos, conyuges, documentos, entradas_bitacora: (bitacoraData.data ?? []) as unknown as import("@/lib/supabase/types").EntradaBitacora[] };
}
