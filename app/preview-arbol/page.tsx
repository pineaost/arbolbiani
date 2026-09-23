import { ArbolClient } from "@/components/arbol/arbol-client";
import personas from "@/Referencias/revision-layout/personas-revision-final.json";
import type { PersonaArbol } from "@/lib/supabase/types";
export default function PreviewArbol() {
  return <ArbolClient personas={personas as PersonaArbol[]} />;
}
