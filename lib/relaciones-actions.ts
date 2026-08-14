"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getPersonaFicha } from "@/lib/relaciones";
import type { ConyugeInput, FiliacionInput } from "@/lib/supabase/types";

// Reglas de negocio de filiación (Etapa 1).
//
// Deliberadamente NO se implementan como triggers/constraints en SQL:
// el propio proyecto define en types.ts que "esa lógica vive en /lib",
// así que la detección de ciclos y el máximo de padres se validan acá,
// en un solo lugar, en vez de duplicarlas entre la app y la base.
// La base sigue aportando su propia red de seguridad con los constraints
// que ya existían (filiacion_no_auto_referencia, filiacion_unica) y,
// desde la migración 0003, con el índice único que impide dos vínculos
// de cónyuge activos entre el mismo par de personas.

const MAX_PADRES_POR_HIJO = 2;

export async function obtenerFichaPersona(personaId: string) {
  return getPersonaFicha(personaId);
}

function revalidarVistas() {
  revalidatePath("/archivo");
  revalidatePath("/archivo/[id]", "page");
  revalidatePath("/arbol");
}

// Recorre hacia arriba el árbol de ancestros de `personaId` y devuelve
// true si `posibleAncestroId` aparece en esa línea. Se usa para evitar
// ciclos: si el futuro hijo ya es ancestro del futuro padre, vincularlos
// cerraría un loop.
async function esAncestro(
  supabase: SupabaseClient,
  posibleAncestroId: string,
  personaId: string
): Promise<boolean> {
  const visitados = new Set<string>([personaId]);
  let nivelActual = [personaId];

  while (nivelActual.length > 0) {
    const { data, error } = await supabase
      .from("relaciones_filiacion")
      .select("padre_id")
      .in("hijo_id", nivelActual);

    if (error) throw error;

    const padres = Array.from(
      new Set(
        ((data ?? []) as { padre_id: string }[]).map((fila) => fila.padre_id)
      )
    );

    if (padres.includes(posibleAncestroId)) return true;

    nivelActual = padres.filter((p) => !visitados.has(p));
    nivelActual.forEach((p) => visitados.add(p));
  }

  return false;
}

export async function agregarFiliacion(input: FiliacionInput) {
  const { padre_id, hijo_id } = input;

  if (padre_id === hijo_id) {
    return { error: "Una persona no puede ser su propio padre o madre." };
  }

  const supabase = await createClient();

  const { count, error: errorConteo } = await supabase
    .from("relaciones_filiacion")
    .select("id", { count: "exact", head: true })
    .eq("hijo_id", hijo_id);

  if (errorConteo) {
    console.error("Error al contar padres:", errorConteo.message);
    return { error: "No se pudo verificar los padres existentes." };
  }

  if ((count ?? 0) >= MAX_PADRES_POR_HIJO) {
    return {
      error: `Esta persona ya tiene ${MAX_PADRES_POR_HIJO} padres/madres registrados.`,
    };
  }

  let generaCiclo: boolean;
  try {
    generaCiclo = await esAncestro(supabase, hijo_id, padre_id);
  } catch (error) {
    console.error("Error al validar ciclo de filiación:", error);
    return { error: "No se pudo validar el vínculo." };
  }

  if (generaCiclo) {
    return {
      error:
        "Este vínculo crearía un ciclo: la persona elegida como hijo/a ya es ancestro del padre/madre en esta línea.",
    };
  }

  const { error } = await supabase
    .from("relaciones_filiacion")
    .insert({ padre_id, hijo_id });

  if (error) {
    if (error.code === "23505") {
      return { error: "Ese vínculo de filiación ya existe." };
    }
    console.error("Error al crear filiación:", error.message);
    return { error: "No se pudo crear el vínculo." };
  }

  revalidarVistas();
  return { error: null };
}

export async function eliminarFiliacion(id: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("relaciones_filiacion")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error al eliminar filiación:", error.message);
    return { error: "No se pudo eliminar el vínculo." };
  }

  revalidarVistas();
  return { error: null };
}

export async function agregarConyuge(input: ConyugeInput) {
  const { persona1_id, persona2_id, fecha_inicio, fecha_fin, notas } = input;

  if (persona1_id === persona2_id) {
    return { error: "Una persona no puede ser su propio cónyuge." };
  }

  const supabase = await createClient();

  const { error } = await supabase.from("relaciones_conyuge").insert({
    persona1_id,
    persona2_id,
    fecha_inicio,
    fecha_fin,
    notas,
  });

  if (error) {
    if (error.code === "23505") {
      return {
        error:
          "Ya existe un vínculo de cónyuge activo entre estas personas. Cargá una fecha de fin en el vínculo anterior antes de crear uno nuevo.",
      };
    }
    console.error("Error al crear vínculo de cónyuge:", error.message);
    return { error: "No se pudo crear el vínculo." };
  }

  revalidarVistas();
  return { error: null };
}

export async function actualizarConyuge(
  id: string,
  input: Pick<ConyugeInput, "fecha_inicio" | "fecha_fin" | "notas">
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("relaciones_conyuge")
    .update({
      fecha_inicio: input.fecha_inicio,
      fecha_fin: input.fecha_fin,
      notas: input.notas,
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return {
        error:
          "Ya existe otro vínculo activo entre estas personas; no se puede reabrir este sin cerrar el otro primero.",
      };
    }
    console.error("Error al actualizar vínculo de cónyuge:", error.message);
    return { error: "No se pudo actualizar el vínculo." };
  }

  revalidarVistas();
  return { error: null };
}

export async function eliminarConyuge(id: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("relaciones_conyuge")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error al eliminar vínculo de cónyuge:", error.message);
    return { error: "No se pudo eliminar el vínculo." };
  }

  revalidarVistas();
  return { error: null };
}
