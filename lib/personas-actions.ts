"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { personaTieneVinculos } from "@/lib/integridad-referencial";
import type { Genero } from "@/lib/supabase/types";

export interface PersonaFormInput {
  nombre: string;
  apellido: string;
  genero: Genero;
  fecha_nacimiento: string | null;
  lugar_nacimiento: string | null;
  fecha_fallecimiento: string | null;
  lugar_fallecimiento: string | null;
  notas: string | null;
}

// Esta es la ÚNICA validación que bloquea la creación/edición de una
// persona. No hay (ni debe haber) ninguna regla acá, ni en ningún otro
// lado, que impida guardar una persona por falta de fechas, lugares,
// notas o documentación asociada. El nivel de información (ver
// /lib/estado-informacion.ts) es puramente un indicador informativo,
// calculado aparte, y nunca interviene en esta validación.
function validar(input: PersonaFormInput) {
  if (!input.nombre.trim() || !input.apellido.trim()) {
    return "Nombre y apellido son obligatorios.";
  }
  return null;
}

function revalidarVistas() {
  revalidatePath("/archivo");
  revalidatePath("/archivo/[id]", "page");
  revalidatePath("/arbol");
}

export async function crearPersona(input: PersonaFormInput) {
  const errorValidacion = validar(input);
  if (errorValidacion) return { error: errorValidacion };

  const supabase = await createClient();
  const { error } = await supabase.from("personas").insert({
    nombre: input.nombre.trim(),
    apellido: input.apellido.trim(),
    genero: input.genero,
    fecha_nacimiento: input.fecha_nacimiento,
    lugar_nacimiento: input.lugar_nacimiento,
    fecha_fallecimiento: input.fecha_fallecimiento,
    lugar_fallecimiento: input.lugar_fallecimiento,
    notas: input.notas,
  });

  if (error) {
    console.error("Error al crear persona:", error.message);
    return { error: error.message };
  }

  revalidarVistas();
  return { error: null };
}

export async function actualizarPersona(id: string, input: PersonaFormInput) {
  const errorValidacion = validar(input);
  if (errorValidacion) return { error: errorValidacion };

  const supabase = await createClient();
  const { error } = await supabase
    .from("personas")
    .update({
      nombre: input.nombre.trim(),
      apellido: input.apellido.trim(),
      genero: input.genero,
      fecha_nacimiento: input.fecha_nacimiento,
      lugar_nacimiento: input.lugar_nacimiento,
      fecha_fallecimiento: input.fecha_fallecimiento,
      lugar_fallecimiento: input.lugar_fallecimiento,
      notas: input.notas,
    })
    .eq("id", id);

  if (error) {
    console.error("Error al actualizar persona:", error.message);
    return { error: "No se pudo actualizar la persona." };
  }

  revalidarVistas();
  return { error: null };
}

export async function eliminarPersona(id: string) {
  const supabase = await createClient();

  // Integridad referencial (distinto concepto del nivel de información):
  // no se borra en cascada. Si la persona tiene vínculos familiares
  // (y a futuro documentos o entradas de bitácora), se bloquea el
  // borrado para no perder esos vínculos por accidente. Esto no
  // depende del nivel de información de la persona: una persona con
  // nivel "bajo" se puede borrar igual que una con nivel "alto", lo
  // único que importa acá son los vínculos reales que tenga.
  let tieneVinculos = false;
  let detalle: string[] = [];
  try {
    ({ tieneVinculos, detalle } = await personaTieneVinculos(supabase, id));
  } catch (error) {
    console.error("Error al verificar vínculos antes de borrar:", error);
    return { error: "No se pudo verificar los vínculos de la persona." };
  }

  if (tieneVinculos) {
    return {
      error: `No se puede eliminar: esta persona todavía tiene ${detalle.join(
        ", "
      )} registrados. Eliminá esos vínculos primero.`,
    };
  }

  const { error } = await supabase.from("personas").delete().eq("id", id);

  if (error) {
    console.error("Error al eliminar persona:", error.message);
    return { error: "No se pudo eliminar la persona." };
  }

  revalidarVistas();
  return { error: null };
}
