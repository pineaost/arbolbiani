import { createClient } from "@/lib/supabase/server";
import { adjuntarNivelInformacion } from "@/lib/personas";
import type {
  Persona,
  PersonaConVinculos,
  PersonaFicha,
  VinculoConyugeFicha,
  VinculoFiliacionFicha,
} from "@/lib/supabase/types";

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

  const [padresData, hijosData, conyugesData, personasConNivel] =
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
      adjuntarNivelInformacion(supabase, [persona as Persona]),
    ]);

  const errorRelacion = padresData.error || hijosData.error || conyugesData.error;
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

  return { ...personasConNivel[0], padres, hijos, conyuges };
}
