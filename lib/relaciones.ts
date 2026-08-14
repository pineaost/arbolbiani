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

export async function getPersonasArbol(): Promise<PersonaArbol[]> {
  const supabase = await createClient();
  const [personasData, filiacionesData, conyugesData] = await Promise.all([
    supabase
      .from("personas")
      .select("*")
      .order("apellido", { ascending: true })
      .order("nombre", { ascending: true })
      .order("id", { ascending: true }),
    supabase
      .from("relaciones_filiacion")
      .select("padre_id, hijo_id"),
    supabase
      .from("relaciones_conyuge")
      .select("persona1_id, persona2_id"),
  ]);

  const error = personasData.error || filiacionesData.error || conyugesData.error;
  if (error) {
    console.error("Error al obtener datos del árbol:", error.message);
    throw new Error("No se pudo cargar el árbol familiar.");
  }

  const personas = (personasData.data ?? []) as Persona[];
  const ids = new Set(personas.map((persona) => persona.id));
  const padresPorHijo = new Map<string, Set<string>>();
  const hijosPorPadre = new Map<string, Set<string>>();
  const conyugesPorPersona = new Map<string, Set<string>>();

  for (const fila of (filiacionesData.data ?? []) as {
    padre_id: string;
    hijo_id: string;
  }[]) {
    if (!ids.has(fila.padre_id) || !ids.has(fila.hijo_id)) continue;
    if (!padresPorHijo.has(fila.hijo_id)) padresPorHijo.set(fila.hijo_id, new Set());
    if (!hijosPorPadre.has(fila.padre_id)) hijosPorPadre.set(fila.padre_id, new Set());
    padresPorHijo.get(fila.hijo_id)?.add(fila.padre_id);
    hijosPorPadre.get(fila.padre_id)?.add(fila.hijo_id);
  }

  for (const fila of (conyugesData.data ?? []) as {
    persona1_id: string;
    persona2_id: string;
  }[]) {
    if (!ids.has(fila.persona1_id) || !ids.has(fila.persona2_id)) continue;
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

  return ((data ?? []) as unknown as { padre: Persona }[]).map(
    (fila) => fila.padre
  );
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

  return ((data ?? []) as unknown as { hijo: Persona }[]).map(
    (fila) => fila.hijo
  );
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

  return (
    (data ?? []) as unknown as { persona1: Persona; persona2: Persona }[]
  ).map((fila) =>
    fila.persona1.id === personaId ? fila.persona2 : fila.persona1
  );
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

  return { ...personasConNivel[0], padres, hijos, conyuges };
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
    Omit<VinculoConyugeFicha, "conyuge"> & { persona1: Persona; persona2: Persona }
  >)
    .map(({ persona1, persona2, ...vinculo }) => ({
      ...vinculo,
      conyuge: persona1.id === personaId ? persona2 : persona1,
    }))
    .filter((vinculo) => vinculo.conyuge);

  const documentos = ((documentosData.data ?? []) as unknown as {
    documento: Documento | null;
  }[])
    .map((vinculo) => vinculo.documento)
    .filter((documento): documento is Documento => !!documento);

  return { ...personasConNivel[0], padres, hijos, conyuges, documentos, entradas_bitacora: (bitacoraData.data ?? []) as unknown as import("@/lib/supabase/types").EntradaBitacora[] };
}
