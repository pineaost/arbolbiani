import type { ModeloArbol } from "./arbol-tipos";
import { crearModeloArbol } from "./arbol-modelo";

export interface FamiliaFiltroArbol {
  id: string;
  nombre: string;
  raices: string[];
  personasIds: Set<string>;
}

/** Las opciones se calculan sobre el modelo completo, nunca sobre el filtrado.
 * Un apellido agrupa raíces del mismo componente, no personas sin parentesco.
 */
export function obtenerFamiliasArbol(modelo: ModeloArbol): FamiliaFiltroArbol[] {
  const familias: FamiliaFiltroArbol[] = [];
  for (const componente of modelo.componentes) {
    const porApellido = new Map<string, FamiliaFiltroArbol>();
    for (const id of componente.raicesAncestrales) {
      const persona = modelo.personas.get(id)!;
      const nombre = persona.apellido.trim() || persona.nombre.trim() || "Sin apellido";
      const clave = nombre.normalize("NFC").toLocaleLowerCase("es");
      const familia = porApellido.get(clave) ?? { id: `raiz:${id}`, nombre, raices: [], personasIds: new Set<string>() };
      familia.raices.push(id);
      porApellido.set(clave, familia);
    }
    for (const familia of porApellido.values()) {
      const cola = [...familia.raices];
      for (let i = 0; i < cola.length; i += 1) {
        const id = cola[i];
        if (familia.personasIds.has(id)) continue;
        familia.personasIds.add(id);
        cola.push(...modelo.hijosPorPadre.get(id) ?? []);
      }
      // Parejas sin ascendencia ni descendencia propia acompañan la rama.
      // No recorrer matrimonios hacia otras raíces: reintroduciría familias ocultas.
      for (const id of [...familia.personasIds]) {
        for (const pareja of modelo.conyugesPorPersona.get(id) ?? []) {
          if (!(modelo.padresPorHijo.get(pareja)?.size) && !(modelo.hijosPorPadre.get(pareja)?.size)
            && !componente.raicesAncestrales.includes(pareja)) familia.personasIds.add(pareja);
        }
      }
      familias.push(familia);
    }
  }
  return familias;
}

export function filtrarModeloArbol(modelo: ModeloArbol, familias: FamiliaFiltroArbol[], activas: ReadonlySet<string>): ModeloArbol {
  // Con todas activas, se conserva exactamente el modelo y layout originales.
  if (familias.every(familia => activas.has(familia.id))) return modelo;
  const visibles = new Set<string>();
  for (const familia of familias) {
    if (activas.has(familia.id)) familia.personasIds.forEach(id => visibles.add(id));
  }
  const conservar = (ids: Iterable<string>) => [...ids].filter(id => visibles.has(id));
  return crearModeloArbol([...modelo.personas.values()].filter(p => visibles.has(p.id)).map(p => ({
    ...p,
    padres_ids: conservar(modelo.padresPorHijo.get(p.id) ?? []),
    hijos_ids: conservar(modelo.hijosPorPadre.get(p.id) ?? []),
    conyuges_ids: conservar(modelo.conyugesPorPersona.get(p.id) ?? []),
    hermanos_ids: conservar(p.hermanos_ids),
  })));
}
