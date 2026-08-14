"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { TipoDocumento } from "@/lib/supabase/types";

type Resultado = { error: string | null };

function revalidarVistas(personaId: string) {
  revalidatePath("/archivo");
  revalidatePath(`/archivo/${personaId}`);
  revalidatePath("/archivo/[id]", "page");
}

function esPdf(archivo: File) {
  return (
    archivo.type === "application/pdf" ||
    archivo.name.toLocaleLowerCase().endsWith(".pdf")
  );
}

function tituloDesdeArchivo(nombre: string) {
  return nombre.replace(/\.pdf$/i, "").trim() || "Documento sin título";
}

export async function subirDocumentosPersona(
  personaId: string,
  formData: FormData
): Promise<Resultado> {
  const tipo = formData.get("tipo") as TipoDocumento | null;
  const archivos = formData
    .getAll("archivos")
    .filter((entrada): entrada is File => entrada instanceof File && entrada.size > 0);

  if (!tipo || !["nacimiento", "matrimonio", "defuncion", "otro"].includes(tipo)) {
    return { error: "Elegí un tipo de documento válido." };
  }

  if (archivos.length === 0) {
    return { error: "Elegí al menos un archivo PDF." };
  }

  const archivoNoPdf = archivos.find((archivo) => !esPdf(archivo));
  if (archivoNoPdf) {
    return { error: `“${archivoNoPdf.name}” no es un archivo PDF.` };
  }

  const supabase = await createClient();

  for (const archivo of archivos) {
    const nombreSeguro = archivo.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const ruta = `${personaId}/${crypto.randomUUID()}-${nombreSeguro}`;
    const { error: errorStorage } = await supabase.storage
      .from("documentos")
      .upload(ruta, archivo, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (errorStorage) {
      console.error("Error al subir documento:", errorStorage.message);
      return { error: `No se pudo subir “${archivo.name}”.` };
    }

    const { data: documento, error: errorDocumento } = await supabase
      .from("documentos")
      .insert({
        tipo,
        titulo: tituloDesdeArchivo(archivo.name),
        archivo_url: ruta,
      })
      .select("id")
      .single();

    if (errorDocumento || !documento) {
      await supabase.storage.from("documentos").remove([ruta]);
      console.error("Error al registrar documento:", errorDocumento?.message);
      return { error: `Se subió “${archivo.name}”, pero no se pudo registrar.` };
    }

    const { error: errorVinculo } = await supabase
      .from("documento_persona")
      .insert({ documento_id: documento.id, persona_id: personaId });

    if (errorVinculo) {
      await Promise.all([
        supabase.from("documentos").delete().eq("id", documento.id),
        supabase.storage.from("documentos").remove([ruta]),
      ]);
      console.error("Error al vincular documento:", errorVinculo.message);
      return { error: `No se pudo asociar “${archivo.name}” a la persona.` };
    }
  }

  revalidarVistas(personaId);
  return { error: null };
}

export async function obtenerEnlaceDocumento(
  documentoId: string,
  descargar = false
): Promise<{
  error: string | null;
  url: string | null;
}> {
  const supabase = await createClient();
  const { data: documento, error } = await supabase
    .from("documentos")
    .select("archivo_url")
    .eq("id", documentoId)
    .single();

  if (error || !documento?.archivo_url) {
    return { error: "No se encontró el archivo del documento.", url: null };
  }

  const { data, error: errorUrl } = await supabase.storage
    .from("documentos")
    .createSignedUrl(documento.archivo_url, 60 * 15, {
      download: descargar,
    });

  if (errorUrl || !data?.signedUrl) {
    console.error("Error al generar enlace del documento:", errorUrl?.message);
    return { error: "No se pudo abrir el documento.", url: null };
  }

  return { error: null, url: data.signedUrl };
}

export async function eliminarDocumentoDePersona(
  documentoId: string,
  personaId: string
): Promise<Resultado> {
  const supabase = await createClient();
  const { data: documento, error: errorDocumento } = await supabase
    .from("documentos")
    .select("archivo_url")
    .eq("id", documentoId)
    .single();

  if (errorDocumento || !documento) {
    return { error: "No se encontró el documento." };
  }

  const { error: errorDesvincular } = await supabase
    .from("documento_persona")
    .delete()
    .eq("documento_id", documentoId)
    .eq("persona_id", personaId);

  if (errorDesvincular) {
    console.error("Error al desvincular documento:", errorDesvincular.message);
    return { error: "No se pudo eliminar el documento de esta ficha." };
  }

  const { count, error: errorConteo } = await supabase
    .from("documento_persona")
    .select("documento_id", { count: "exact", head: true })
    .eq("documento_id", documentoId);

  if (errorConteo) {
    console.error("Error al contar vínculos de documento:", errorConteo.message);
    return { error: "El documento se desvinculó, pero no se pudo finalizar su eliminación." };
  }

  if ((count ?? 0) === 0) {
    if (documento.archivo_url) {
      const { error: errorStorage } = await supabase.storage
        .from("documentos")
        .remove([documento.archivo_url]);
      if (errorStorage) {
        console.error("Error al eliminar archivo:", errorStorage.message);
        return { error: "El documento se desvinculó, pero no se pudo eliminar su archivo." };
      }
    }

    const { error: errorEliminar } = await supabase
      .from("documentos")
      .delete()
      .eq("id", documentoId);
    if (errorEliminar) {
      console.error("Error al eliminar documento:", errorEliminar.message);
      return { error: "El documento se desvinculó, pero no se pudo eliminar su registro." };
    }
  }

  revalidarVistas(personaId);
  return { error: null };
}
