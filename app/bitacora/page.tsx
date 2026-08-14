import { BitacoraClient } from "@/components/bitacora/bitacora-client";
import { getEntradasBitacora } from "@/lib/bitacora";
import { getPersonas } from "@/lib/personas";
export const dynamic = "force-dynamic";
export default async function BitacoraPage() { const [entradas, personas] = await Promise.all([getEntradasBitacora(), getPersonas()]); return <BitacoraClient entradas={entradas} personas={personas} />; }
