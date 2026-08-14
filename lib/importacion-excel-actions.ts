"use server";

import { revalidatePath } from "next/cache";
import revisionFuente from "@/Referencias/importacion-arbol-genealogico-revision.json";
import { createClient } from "@/lib/supabase/server";
import type { Genero } from "@/lib/supabase/types";

interface PersonaImportable {
  nombre: string;
  apellido: string;
  genero: Genero;
  fecha_nacimiento: string | null;
  lugar_nacimiento: string | null;
  fecha_fallecimiento: string | null;
  lugar_fallecimiento: string | null;
  notas: string | null;
}

interface PropuestaRevision {
  id_propuesta: string;
  estado: "existente_reconocido" | "propuesta_importar";
  persona: PersonaImportable;
}

interface RevisionImportacion {
  personas: PropuestaRevision[];
}

interface PersonaExistente {
  id: string;
  nombre: string;
  apellido: string;
  fecha_nacimiento: string | null;
}

const revision = revisionFuente as RevisionImportacion;

function claveNombre(persona: Pick<PersonaImportable, "nombre" | "apellido">) {
  return `${persona.nombre} ${persona.apellido}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("es");
}

function coincideConCerteza(propuesta: PersonaImportable, existente: PersonaExistente) {
  return claveNombre(propuesta) === claveNombre(existente)
    && !!propuesta.fecha_nacimiento
    && propuesta.fecha_nacimiento === existente.fecha_nacimiento;
}

export interface ResultadoImportacionExcel {
  error: string | null;
  importadas?: number;
  existentes?: number;
  conflictos?: string[];
}

// Es deliberadamente una operación de personas solamente. El JSON de revisión
// no contiene IDs ni significado relacional de las columnas del Excel, por lo
// que esta acción no puede crear filiaciones, cónyuges, documentos ni bitácora.
export async function importarPersonasDesdeExcel(): Promise<ResultadoImportacionExcel> {
  const supabase = await createClient();
  const { data: existentesData, error: errorLectura } = await supabase
    .from("personas")
    .select("id, nombre, apellido, fecha_nacimiento");

  if (errorLectura) {
    console.error("Error al leer personas antes de importar el Excel:", errorLectura.message);
    return { error: "No se pudo verificar las personas existentes antes de importar." };
  }

  const existentes = (existentesData ?? []) as PersonaExistente[];
  const propuestas = revision.personas.filter((registro) => registro.estado === "propuesta_importar");
  const yaReconocidas = revision.personas.length - propuestas.length;
  const paraInsertar: PersonaImportable[] = [];
  const conflictos: string[] = [];
  let existentesReconocidos = yaReconocidas;

  for (const propuesta of propuestas) {
    const coincidenciasPorNombre = existentes.filter((existente) => claveNombre(existente) === claveNombre(propuesta.persona));
    if (coincidenciasPorNombre.length === 0) {
      paraInsertar.push(propuesta.persona);
      continue;
    }

    if (coincidenciasPorNombre.some((existente) => coincideConCerteza(propuesta.persona, existente))) {
      existentesReconocidos += 1;
      continue;
    }

    // Mismo nombre sin una fecha de nacimiento idéntica no es evidencia
    // suficiente para fusionar ni para insertar un posible duplicado.
    conflictos.push(`${propuesta.persona.nombre} ${propuesta.persona.apellido}`);
  }

  if (paraInsertar.length > 0) {
    const { data: insertadas, error: errorInsercion } = await supabase
      .from("personas")
      .insert(paraInsertar)
      .select("id");

    if (errorInsercion) {
      console.error("Error al importar personas del Excel:", errorInsercion.message);
      return { error: "No se pudieron importar las personas propuestas. No se modificaron relaciones ni documentos." };
    }

    revalidatePath("/archivo");
    revalidatePath("/archivo/[id]", "page");
    revalidatePath("/arbol");
    return {
      error: null,
      importadas: insertadas?.length ?? paraInsertar.length,
      existentes: existentesReconocidos,
      conflictos,
    };
  }

  return { error: null, importadas: 0, existentes: existentesReconocidos, conflictos };
}

