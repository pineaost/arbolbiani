/** Orden consecutivo de grupos que pueden compartir un bloque conyugal.
 * Una pareja entre dos hermandades ocupa su frontera común. La búsqueda tiene
 * un ancho acotado; si los parentescos no admiten todos los grupos consecutivos,
 * minimiza las interrupciones sin descartar personas ni relaciones.
 */
export function ordenarGruposConsecutivos<T>(fila: T[], grupos: T[][], inversion = (_a: T, _b: T) => 0): T[] {
  const rango = new Map(fila.map((b, i) => [b, i]));
  const conjuntos = grupos.map(g => new Set(g.filter(b => rango.has(b)))).filter(g => g.size > 1);
  const pendientes = new Set(fila);
  const regiones: T[][] = [];
  while (pendientes.size) {
    const region = new Set([pendientes.values().next().value as T]);
    for (const b of region) for (const g of conjuntos) if (g.has(b)) for (const otro of g) region.add(otro);
    region.forEach(b => pendientes.delete(b));
    const miembros = [...region].sort((a, b) => rango.get(a)! - rango.get(b)!);
    const gs = conjuntos.filter(g => g.has(miembros[0]) || miembros.some(b => g.has(b)));
    // Los hermanos con las mismas conexiones son intercambiables para las
    // restricciones: conservar su orden evita explorar sus permutaciones.
    const equivalentes = new Map<string, T[]>();
    for (const b of miembros) {
      const firma = JSON.stringify([gs.map(g => g.has(b)), miembros.map(p => [inversion(b, p), inversion(p, b)])]);
      equivalentes.set(firma, [...equivalentes.get(firma) ?? [], b]);
    }
    type Estado = { orden: T[]; usados: Set<T>; cortes: number; cruces: number; costo: number };
    const comparar = (a: Estado, b: Estado) => a.cortes - b.cortes || a.cruces - b.cruces || a.costo - b.costo;
    let estados: Estado[] = [{ orden: [], usados: new Set(), cortes: 0, cruces: 0, costo: 0 }];
    for (let i = 0; i < miembros.length; i++) {
      const siguientes: Estado[] = [];
      for (const e of estados) for (const clase of equivalentes.values()) {
        const b = clase.find(p => !e.usados.has(p));
        if (b === undefined) continue;
        const j = miembros.indexOf(b);
        const cortes = gs.filter(g => !g.has(b) && g.has(e.orden[e.orden.length - 1])
          && [...g].some(p => !e.usados.has(p))).length;
        siguientes.push({ orden: [...e.orden, b], usados: new Set([...e.usados, b]),
          cortes: e.cortes + cortes, cruces: e.cruces + e.orden.reduce((s, p) => s + inversion(p, b), 0), costo: e.costo + (i - j) ** 2 });
      }
      siguientes.sort(comparar);
      // Conservar alternativas desde ambos extremos. Si sólo se retienen los
      // prefijos baratos, el hermano puente se elimina de la búsqueda antes
      // de poder completar la segunda hermandad.
      const porInicio = new Map<T, number>();
      estados = siguientes.filter(e => {
        const inicio = e.orden[0], cantidad = porInicio.get(inicio) ?? 0;
        porInicio.set(inicio, cantidad + 1);
        return cantidad < 8;
      });
    }
    estados.sort(comparar);
    regiones.push(estados[0].orden);
  }
  return regiones.sort((a, b) => a.reduce((s, p) => s + rango.get(p)!, 0) / a.length
    - b.reduce((s, p) => s + rango.get(p)!, 0) / b.length).flat();
}
