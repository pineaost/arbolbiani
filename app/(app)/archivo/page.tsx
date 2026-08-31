import { getPersonas } from "@/lib/personas";
import { ArchivoClient } from "@/components/archivo/archivo-client";

export default async function ArchivoPage() {
  const personas = await getPersonas();

  return <ArchivoClient personas={personas} />;
}
