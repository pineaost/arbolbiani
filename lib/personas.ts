import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { calcularNivelInformacion } from "@/lib/estado-informacion";
import type { Persona, PersonaConNivel } from "@/lib/supabase/types";

export async function getPersonas(): Promise<PersonaConNivel[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("personas")
    .select("*")
    .order("apellido", { ascending: true })
    .order("nombre", { ascending: true });

  if (error) {
    console.error("Error al obtener personas:", error.message);
    throw new Error("No se pudieron cargar las personas.");
  }

  return adjuntarNivelInformacion(supabase, (data ?? []) as Persona[]);
}

// Junta cada persona con su nivel de información calculado (bajo/medio/alto).
// Vive acá (y no en estado-informacion.ts) porque necesita consultar
// documento_persona, y esa función está pensada para quedar pura y sin
// I/O. La reutilizan tanto getPersonas() como getPersonaConVinculos()
// en relaciones.ts, para no duplicar el conteo de documentos.
//
// Nunca lanza si falla el conteo de documentos: en el peor caso el nivel
// se calcula sin contar documentos, pero la persona igual se muestra.
// El indicador es informativo, no debe romper el listado de personas.
export async function adjuntarNivelInformacion(
  supabase: SupabaseClient,
  personas: Persona[]
): Promise<PersonaConNivel[]> {
  if (personas.length === 0) return [];

  const ids = personas.map((p) => p.id);

  const { data: documentosData, error } = await supabase
    .from("documento_persona")
    .select("persona_id")
    .in("persona_id", ids);

  if (error) {
    console.error(
      "Error al contar documentos por persona (no bloquea el listado):",
      error.message
    );
  }

  const conteoPorPersona = new Map<string, number>();
  for (const fila of (documentosData ?? []) as { persona_id: string }[]) {
    conteoPorPersona.set(
      fila.persona_id,
      (conteoPorPersona.get(fila.persona_id) ?? 0) + 1
    );
  }

  return personas.map((persona) => ({
    ...persona,
    nivel_informacion: calcularNivelInformacion({
      fecha_nacimiento: persona.fecha_nacimiento,
      lugar_nacimiento: persona.lugar_nacimiento,
      fecha_fallecimiento: persona.fecha_fallecimiento,
      lugar_fallecimiento: persona.lugar_fallecimiento,
      notas: persona.notas,
      cantidad_documentos: conteoPorPersona.get(persona.id) ?? 0,
    }),
  }));
}
