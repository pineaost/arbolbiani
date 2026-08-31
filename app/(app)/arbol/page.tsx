import { ArbolClient } from "@/components/arbol/arbol-client";
import { getPersonasArbol } from "@/lib/relaciones";

// El mapa depende de relaciones que se crean y eliminan desde Archivo
// Familiar. Siempre se vuelve a leer la foto actual de Supabase al navegar.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ArbolPage() {
  const personas = await getPersonasArbol();
  return <ArbolClient personas={personas} />;
}
