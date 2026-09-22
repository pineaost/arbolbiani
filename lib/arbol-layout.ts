import type { ModeloArbol, LayoutArbol, PosicionPersonaArbol } from "./arbol-tipos";
import { GEOMETRIA_ARBOL } from "./arbol-tipos";
import { claveOrden, crearVinculosVisualesArbol } from "./arbol-modelo";
import { espacioEntreFilasArbol, crearTrazosVinculosArbol, diagnosticarGeometriaArbol } from "./arbol-vinculos";

class Grupos {
  private representantes = new Map<string, string>();
  constructor(ids: Iterable<string>) { for (const id of ids) this.representantes.set(id, id); }
  raiz(id: string): string {
    const padre = this.representantes.get(id)!;
    if (padre === id) return id;
    const raiz = this.raiz(padre);
    this.representantes.set(id, raiz);
    return raiz;
  }
  unir(a: string, b: string) {
    const [primero, segundo] = [this.raiz(a), this.raiz(b)].sort();
    this.representantes.set(segundo, primero);
  }
}

function ordenarGeneraciones(modelo: ModeloArbol) {
  const ids = [...modelo.personas.keys()];
  const cohortes = new Grupos(ids);
  const advertencias: string[] = [];
  const aristas = [...modelo.hijosPorPadre].flatMap(([p, hs]) => [...hs].map(h => [p, h] as const));
  // La filiación es una restricción dura. Igualar parejas o hermanos es una
  // preferencia: se acepta sólo si la contracción conserva un DAG estricto.
  const grafo = (fusion?: [string, string]) => {
    const raiz = (id: string) => {
      const r = cohortes.raiz(id);
      return fusion && r === fusion[1] ? fusion[0] : r;
    };
    const salidas = new Map([...new Set(ids.map(raiz))].map(id => [id, new Set<string>()]));
    const entradas = new Map([...salidas.keys()].map(id => [id, new Set<string>()]));
    for (const [p, h] of aristas) {
      const a = raiz(p), b = raiz(h);
      if (a === b) return null;
      salidas.get(a)!.add(b); entradas.get(b)!.add(a);
    }
    const grados = new Map([...entradas].map(([id, ps]) => [id, ps.size]));
    const orden = [...grados].filter(([, g]) => g === 0).map(([id]) => id).sort();
    for (let i = 0; i < orden.length; i++) for (const hijo of [...salidas.get(orden[i])!].sort()) {
      grados.set(hijo, grados.get(hijo)! - 1);
      if (grados.get(hijo) === 0) orden.push(hijo);
    }
    return orden.length === salidas.size ? { orden, salidas, entradas } : null;
  };
  const intentar = (a: string, b: string, motivo: string) => {
    const ra = cohortes.raiz(a), rb = cohortes.raiz(b);
    if (ra === rb) return;
    if (grafo([ra, rb])) cohortes.unir(a, b);
    else advertencias.push(`${motivo}: ${a} / ${b}. Se conserva la filiación y se conectan niveles distintos.`);
  };
  for (const id of ids) for (const pareja of [...modelo.conyugesPorPersona.get(id) ?? []].sort()) {
    if (id < pareja) intentar(id, pareja, "Unión entre generaciones");
  }
  for (const f of modelo.familias) for (const p of f.progenitores.slice(1)) intentar(f.progenitores[0], p, "Progenitores en generaciones distintas");
  for (const f of modelo.familias) for (const h of f.hijos.slice(1)) intentar(f.hijos[0], h, "Hermanos con restricciones generacionales distintas");
  // Un progenitor omitido no convierte a sus hijos en generaciones distintas.
  // También se alinean medios hermanos cuando la filiación lo permite.
  for (const hijos of modelo.hijosPorPadre.values()) {
    const orden = [...hijos].sort();
    for (const h of orden.slice(1)) intentar(orden[0], h, "Hermanos por un progenitor en generaciones distintas");
  }
  const dag = grafo();
  if (!dag) throw new Error("La filiación contiene un ciclo; no es posible calcular un árbol coherente.");
  const niveles = new Map<string, number>();
  for (const id of dag.orden) niveles.set(id, Math.max(0, ...[...dag.entradas.get(id)!].map(p => niveles.get(p)! + 1)));
  // Alineación hacia la descendencia: una rama corta puede comenzar más abajo
  // para encontrarse con otra larga, sin inventar niveles por fechas faltantes.
  for (const id of [...dag.orden].reverse()) {
    const hijos = [...dag.salidas.get(id)!];
    if (hijos.length) niveles.set(id, Math.min(...hijos.map(h => niveles.get(h)! - 1)));
  }
  const anio = (id: string) => {
    const valor = Number(modelo.personas.get(id)!.fecha_nacimiento?.slice(0, 4));
    return Number.isInteger(valor) && valor > 0 ? valor : null;
  };
  const conocidos = ids.map(anio).filter((a): a is number => a !== null);
  const base = conocidos.length ? Math.min(...conocidos) : 0;
  const generaciones = new Map<string, number>();
  for (const componente of modelo.componentes) {
    const minimo = Math.min(...componente.ids.map(id => niveles.get(cohortes.raiz(id))!));
    const estimaciones = componente.ids.filter(id => anio(id) !== null)
      .map(id => (anio(id)! - base) / 28 - (niveles.get(cohortes.raiz(id))! - minimo)).sort((a, b) => a - b);
    const offset = estimaciones.length ? Math.max(0, Math.round(estimaciones[Math.floor(estimaciones.length / 2)])) : 0;
    for (const id of componente.ids) generaciones.set(id, niveles.get(cohortes.raiz(id))! - minimo + offset);
  }
  return { generaciones, advertencias };
}

interface Bloque {
  id: string;
  personas: string[];
  generacion: number;
  ancho: number;
  x: number;
  familia: string;
  familiaOrden: string;
  referente: string;
}
const pasoPareja = GEOMETRIA_ARBOL.anchoNodo + GEOMETRIA_ARBOL.separacionPareja;
const media = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const mediana = (xs: number[]) => {
  const orden = [...xs].sort((a, b) => a - b), medio = Math.floor(orden.length / 2);
  return orden.length % 2 ? orden[medio] : (orden[medio - 1] + orden[medio]) / 2;
};

// Proyección isotónica: el mínimo desplazamiento cuadrático que respeta todas
// las separaciones de una fila. No hay empujes tardíos de tarjetas individuales.
function proyectarFila(fila: Bloque[], objetivos: number[], pesos: number[], gap: (a: Bloque, b: Bloque) => number) {
  const offsets = [0];
  for (let i = 1; i < fila.length; i++) offsets[i] = offsets[i - 1] + (fila[i - 1].ancho + fila[i].ancho) / 2 + gap(fila[i - 1], fila[i]);
  const pools: Array<{ inicio: number; fin: number; suma: number; peso: number }> = [];
  for (let i = 0; i < fila.length; i++) {
    pools.push({ inicio: i, fin: i, suma: (objetivos[i] - offsets[i]) * pesos[i], peso: pesos[i] });
    while (pools.length > 1) {
      const a = pools[pools.length - 2], b = pools[pools.length - 1];
      if (a.suma / a.peso <= b.suma / b.peso) break;
      pools.splice(-2, 2, { inicio: a.inicio, fin: b.fin, suma: a.suma + b.suma, peso: a.peso + b.peso });
    }
  }
  for (const pool of pools) for (let i = pool.inicio; i <= pool.fin; i++) fila[i].x = pool.suma / pool.peso + offsets[i];
}

/** Layout por generaciones con bloques de parejas y restricciones familiares.
 * Todas las ascendencias participan en orden y alineación; no hay padre dueño,
 * raíz técnica, subárbol descartado ni coordenadas obtenidas del DOM.
 */
function calcularLayoutCandidato(modelo: ModeloArbol, inicio: number): LayoutArbol {
  const ordenarPorConexiones = inicio >= 4;
  if (modelo.problemas.length) throw new Error(`No se puede representar un árbol con relaciones inconsistentes: ${modelo.problemas.map(p => p.detalle).join(" ")}`);
  if (!modelo.personas.size) return { posiciones: new Map(), nodos: [], ancho: 0, alto: 0, limites: { minX: 0, minY: 0, maxX: 0, maxY: 0 }, advertencias: [], trazos: [] };
  const { generaciones, advertencias } = ordenarGeneraciones(modelo);
  const uniones = new Grupos(modelo.personas.keys());
  const parejas: Array<[string, string]> = [];
  modelo.conyugesPorPersona.forEach((ps, id) => ps.forEach(p => { if (id < p) parejas.push([id, p]); }));
  modelo.familias.forEach(f => { if (f.progenitores.length === 2) parejas.push([f.progenitores[0], f.progenitores[1]]); });
  for (const [a, b] of parejas) if (generaciones.get(a) === generaciones.get(b)) uniones.unir(a, b);
  const porGrupo = new Map<string, string[]>();
  for (const id of modelo.personas.keys()) {
    const grupo = uniones.raiz(id); const ids = porGrupo.get(grupo) ?? [];
    ids.push(id); porGrupo.set(grupo, ids);
  }
  const comparar = (a: string, b: string) => claveOrden(modelo.personas.get(a)!).localeCompare(claveOrden(modelo.personas.get(b)!), "es");
  const origen = new Map<string, string>();
  modelo.familias.forEach(f => f.hijos.forEach(h => origen.set(h, f.id)));
  const bloques: Bloque[] = [...porGrupo].map(([id, personas]) => {
    personas.sort(comparar);
    const costo = (orden: string[]) => parejas.reduce((s, [a, b]) => {
      const i = orden.indexOf(a), j = orden.indexOf(b);
      return s + (i < 0 || j < 0 ? 0 : Math.abs(i - j));
    }, 0);
    // Inserción y mejora local acotadas; nunca búsqueda factorial.
    let orden: string[] = [];
    for (const persona of personas) {
      let mejor = [...orden, persona];
      for (let i = 0; i < orden.length; i++) {
        const prueba = [...orden.slice(0, i), persona, ...orden.slice(i)];
        if (costo(prueba) < costo(mejor)) mejor = prueba;
      }
      orden = mejor;
    }
    const parentescoOrden = (p: string) => [...modelo.padresPorHijo.get(p) ?? []].sort((a,b) => (modelo.hijosPorPadre.get(b)?.size ?? 0) - (modelo.hijosPorPadre.get(a)?.size ?? 0) || comparar(a,b))[0];
    const referencia = [...personas].sort((a,b) => (modelo.hijosPorPadre.get(parentescoOrden(b))?.size ?? 0) - (modelo.hijosPorPadre.get(parentescoOrden(a))?.size ?? 0) || comparar(a,b))[0];
    return { id, personas: orden, generacion: generaciones.get(id)!, ancho: personas.length * pasoPareja - GEOMETRIA_ARBOL.separacionPareja, x: 0, familia: origen.get(referencia) ?? `raiz:${id}`, familiaOrden: parentescoOrden(referencia) ?? `raiz:${id}`, referente: referencia };
  });
  const bloquePorPersona = new Map<string, Bloque>();
  bloques.forEach(b => b.personas.forEach(id => bloquePorPersona.set(id, b)));
  const dx = (b: Bloque, id: string) => (b.personas.indexOf(id) - (b.personas.length - 1) / 2) * pasoPareja;
  const x = (id: string) => { const b = bloquePorPersona.get(id)!; return b.x + dx(b, id); };
  const gap = (a: Bloque, b: Bloque) => a.familia === b.familia ? GEOMETRIA_ARBOL.separacionEntreHermanos : GEOMETRIA_ARBOL.separacionUnidadesFamiliares;
  let cursor = 0;
  const posicionesBase: PosicionPersonaArbol[] = [];
  modelo.componentes.forEach((componente, componenteIndice) => {
    const ids = new Set(componente.ids);
    const locales = bloques.filter(b => ids.has(b.personas[0]));
    const familias = modelo.familias.filter(f => ids.has(f.progenitores[0]));
    const filas = new Map<number, Bloque[]>();
    locales.forEach(b => { const fila = filas.get(b.generacion) ?? []; fila.push(b); filas.set(b.generacion, fila); });
    const niveles = [...filas.keys()].sort((a, b) => a - b);
    const claveBloque = (b: Bloque) => [...b.personas].sort(comparar)[0];
    for (const fila of filas.values()) {
      fila.sort((a, b) => inicio === 1 || inicio === 4 ? comparar(a.referente,b.referente)
        : inicio === 2 || inicio === 5 ? comparar(b.referente,a.referente)
        : (inicio === 3 ? -1 : 1) * a.familia.localeCompare(b.familia) || comparar(claveBloque(a), claveBloque(b)));
      proyectarFila(fila, fila.map(() => 0), fila.map(() => 1), gap);
    }
    const objetivos = (b: Bloque, direccion: "padres" | "hijos" | "todos") => {
      const xs: number[] = [];
      for (const f of familias) {
        const centro = media(f.progenitores.map(x));
        if (direccion !== "hijos") for (const h of f.hijos) if (b.personas.includes(h)) xs.push(centro - dx(b, h));
        if (direccion !== "padres") {
          const propios = f.progenitores.filter(p => b.personas.includes(p));
          if (propios.length) {
            const centroHijos = (Math.min(...f.hijos.map(x)) + Math.max(...f.hijos.map(x))) / 2;
            const ajenos = f.progenitores.filter(p => !b.personas.includes(p));
            xs.push((centroHijos * f.progenitores.length - ajenos.reduce((s, p) => s + x(p), 0) - propios.reduce((s, p) => s + dx(b, p), 0)) / propios.length);
          }
        }
      }
      // También las parejas que no pueden compartir nivel intervienen.
      for (const [a, c] of parejas) if (ids.has(a)) {
        if (b.personas.includes(a) && !b.personas.includes(c)) xs.push(x(c) - dx(b, a));
        if (b.personas.includes(c) && !b.personas.includes(a)) xs.push(x(a) - dx(b, c));
      }
      return xs;
    };
    const costo = () => {
      const edges = familias.flatMap(f => f.hijos.map(h => ({ f: f.id, a: media(f.progenitores.map(x)), b: x(h), desde: Math.max(...f.progenitores.map(p => generaciones.get(p)!)), hasta: generaciones.get(h)! })));
      let valor = edges.reduce((s, e) => s + (e.a - e.b) ** 2, 0);
      if (ordenarPorConexiones) for (const [a, b] of parejas) {
        if (ids.has(a)) valor += (x(a) - x(b)) ** 2;
      }
      for (let i = 0; i < edges.length; i++) for (let j = i + 1; j < edges.length; j++) {
        const a = edges[i], b = edges[j];
        if (a.f !== b.f && a.desde === b.desde && a.hasta === b.hasta && (a.a - b.a) * (a.b - b.b) < 0) valor += pasoPareja ** 2 * 16;
      }
      return valor;
    };
    const guardar = () => locales.map(b => ({ b, x: b.x, personas: [...b.personas] }));
    let mejor = guardar(), mejorCosto = costo();
    for (let pasada = 0; pasada < 32; pasada++) {
      const direccion = pasada % 2 ? "hijos" : "padres";
      for (const nivel of pasada % 2 ? [...niveles].reverse() : niveles) {
        const fila = filas.get(nivel)!;
        // Las tandas familiares permanecen contiguas. Sólo se permutan bloques
        // completos: nunca separar cónyuges para acercar una ascendencia.
        const tandas = new Map<string, Bloque[]>();
        fila.forEach(b => { const bs = tandas.get(b.familiaOrden) ?? []; bs.push(b); tandas.set(b.familiaOrden, bs); });
        const orden = [...tandas.values()].sort((a, b) => {
          const as = a.flatMap(n => objetivos(n, direccion)), bs = b.flatMap(n => objetivos(n, direccion));
          return (as.length ? media(as) : media(a.map(n => n.x))) - (bs.length ? media(bs) : media(b.map(n => n.x))) || a[0].familia.localeCompare(b[0].familia);
        }).flatMap(tanda => {
          tanda.sort((a, b) => comparar(a.referente, b.referente));
          // La cronología se mantiene monotónica, pero una rama puede leerse
          // en sentido inverso para acercar un matrimonio a la rama vecina.
          const costoOrden = (bs: Bloque[]) => {
            let cursor = 0;
            const preferencias = bs.flatMap((b,i) => {
              if(i) cursor += (bs[i-1].ancho+b.ancho)/2+gap(bs[i-1],b);
              return objetivos(b,"todos").map(x=>x-cursor);
            });
            if (!preferencias.length) return 0;
            const centro = media(preferencias);
            return preferencias.reduce((s,x)=>s+(x-centro)**2,0);
          };
          const inversa = [...tanda].reverse();
          let elegida = costoOrden(inversa) < costoOrden(tanda) - 0.001 ? inversa : tanda;
          if (ordenarPorConexiones && tanda.length > 2) {
            const centro = media(tanda.map(b => b.x));
            const externos = (b: Bloque) => b.personas.flatMap(p => {
              // Ascendencia del otro integrante de una pareja: orienta al
              // hermano hacia el borde que mira a esa rama, sin mezclar tandas.
              const padres = [...modelo.padresPorHijo.get(p) ?? []];
              return padres.includes(b.familiaOrden) ? [] : padres.map(x);
            });
            const preferencias = new Map(tanda.map(b => {
              const xs = externos(b);
              return [b.id, xs.length ? mediana(xs) : centro];
            }));
            const conectada = [...tanda].sort((a, b) => preferencias.get(a.id)! - preferencias.get(b.id)!
              || comparar(a.referente, b.referente) || a.id.localeCompare(b.id));
            if (costoOrden(conectada) < costoOrden(elegida) - 0.001) elegida = conectada;
            // Intercambios vecinos acotados permiten sacar un hermano del
            // medio sin imponer que toda la tanda invierta su cronología.
            for (let vuelta = 0; vuelta < 3; vuelta++) {
              let cambio = false;
              for (let i = 0; i < elegida.length - 1; i++) {
                const prueba = [...elegida];
                [prueba[i], prueba[i + 1]] = [prueba[i + 1], prueba[i]];
                if (costoOrden(prueba) < costoOrden(elegida) - 0.001) { elegida = prueba; cambio = true; }
              }
              if (!cambio) break;
            }
          }
          return elegida;
        });
        filas.set(nivel, orden);
        for (const b of orden) if (b.personas.length > 1) {
          const valor = costo(); b.personas.reverse();
          if (costo() >= valor) b.personas.reverse();
        }
        const valores = orden.map(b => objetivos(b, direccion));
        proyectarFila(orden, valores.map((xs, i) => xs.length ? media(xs) : orden[i].x), valores.map(xs => Math.max(1, xs.length)), gap);
      }
      const valor = costo();
      if (valor < mejorCosto) { mejorCosto = valor; mejor = guardar(); }
    }
    mejor.forEach(({ b, x: bx, personas }) => { b.x = bx; b.personas = personas; });
    // Alineación final con el orden ya elegido; vuelve a proyectar bloques
    // completos para que no puedan colisionar al acercar ascendencias.
    for (const fila of filas.values()) fila.sort((a, b) => a.x - b.x);
    for (let i = 0; i < 40; i++) for (const nivel of i % 2 ? niveles : [...niveles].reverse()) {
      const fila = filas.get(nivel)!;
      const valores = fila.map(b => objetivos(b, "todos"));
      proyectarFila(fila, valores.map((xs, j) => xs.length ? media(xs) : fila[j].x), valores.map(xs => Math.max(1, xs.length)), gap);
    }
    const minimo = Math.min(...locales.map(b => b.x - b.ancho / 2));
    const maximo = Math.max(...locales.map(b => b.x + b.ancho / 2));
    for (const b of locales) for (const id of b.personas) posicionesBase.push({ id, x: x(id) - minimo + cursor, y: b.generacion * GEOMETRIA_ARBOL.separacionVertical, generacion: b.generacion, grupoFamiliarId: b.id, componenteIndice });
    cursor += maximo - minimo + GEOMETRIA_ARBOL.separacionComponentes;
  });
  const espacios = espacioEntreFilasArbol(crearVinculosVisualesArbol(modelo), posicionesBase.map(n => ({ data: { id: n.id }, x: n.x, y: n.y })));
  const maxGeneracion = Math.max(...posicionesBase.map(n => n.generacion));
  const alturas = [0];
  for (let g = 0; g <= maxGeneracion; g++) alturas[g + 1] = alturas[g] + (espacios.get(g * GEOMETRIA_ARBOL.separacionVertical) ?? GEOMETRIA_ARBOL.separacionVertical);
  posicionesBase.forEach(n => { n.y = alturas[n.generacion]; });
  const minY = Math.min(...posicionesBase.map(n => n.y)) - GEOMETRIA_ARBOL.altoNodo / 2;
  const nodos = posicionesBase.map(n => ({ ...n, x: n.x + GEOMETRIA_ARBOL.margenMapa, y: n.y - minY + GEOMETRIA_ARBOL.margenMapa }))
    .sort((a, b) => a.componenteIndice - b.componenteIndice || a.y - b.y || a.x - b.x || a.id.localeCompare(b.id));
  const ancho = Math.max(...nodos.map(n => n.x)) + GEOMETRIA_ARBOL.anchoNodo / 2 + GEOMETRIA_ARBOL.margenMapa;
  const trazos = crearTrazosVinculosArbol(crearVinculosVisualesArbol(modelo), nodos.map(n => ({ data: { id: n.id }, x: n.x, y: n.y })));
  const puntos = trazos.flatMap(({ trazo }) => trazo?.segmentos.flatMap(s => [s.inicio, s.fin]) ?? []);
  const alto = Math.max(...nodos.map(n => n.y + GEOMETRIA_ARBOL.altoNodo / 2), ...puntos.map(p => p.y)) + GEOMETRIA_ARBOL.margenMapa;
  return { nodos, posiciones: new Map(nodos.map(n => [n.id, n])), ancho, alto, limites: { minX: 0, minY: 0, maxX: ancho, maxY: alto }, advertencias, trazos };
}

export function calcularLayoutArbol(modelo: ModeloArbol): LayoutArbol {
  // Distintos órdenes iniciales deterministas evitan que un matrimonio quede
  // atrapado entre ramas por el orden casual de sus ids. Se comparan relaciones
  // completas; no se elige una ascendencia que las demás deban seguir.
  const puntuar = (l: LayoutArbol) => {
    const g = diagnosticarGeometriaArbol(l.trazos, l.nodos.map(n => ({ data: { id: n.id }, x: n.x, y: n.y })));
    // Comparación lexicográfica: una reducción de ancho nunca compra cruces
    // adicionales. Se evalúa el routing final, no sólo aristas imaginarias.
    return [g.tarjetasAtravesadas.length + g.desconectados.length + g.puertosInvalidos.length,
      g.cruces, g.longitud, l.ancho];
  };
  const menor = (a: number[], b: number[]) => {
    for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > 0.001) return a[i] < b[i];
    return false;
  };
  const candidatos = Array.from({ length: 6 }, (_, inicio) => calcularLayoutCandidato(modelo, inicio));
  const distanciaMaxima = (l: LayoutArbol) => Math.max(0,
    ...modelo.familias.flatMap(f => {
      const centro = media(f.progenitores.map(p => l.posiciones.get(p)!.x));
      return f.hijos.map(h => Math.abs(centro - l.posiciones.get(h)!.x));
    }),
    ...[...modelo.conyugesPorPersona].flatMap(([p, parejas]) => [...parejas].map(q =>
      Math.abs(l.posiciones.get(p)!.x - l.posiciones.get(q)!.x))),
  );
  const distancias = candidatos.map(distanciaMaxima);
  // No eliminar un cruce a costa de estirar una filiación mucho más que en
  // las otras soluciones. El límite es relativo a los datos, no a apellidos.
  const limite = Math.max(pasoPareja * 2, Math.min(...distancias) * 1.25);
  const admisibles = candidatos.filter((_, i) => distancias[i] <= limite + 0.001);
  let mejor = admisibles[0], costo = puntuar(mejor);
  for (const candidato of admisibles.slice(1)) {
    const valor = puntuar(candidato);
    if(menor(valor, costo)) { mejor=candidato; costo=valor; }
  }
  return mejor;
}
export function diagnosticarLayoutArbol(modelo: ModeloArbol, layout: LayoutArbol) {
  const faltantes = [...modelo.personas.keys()].filter((id) => !layout.posiciones.has(id));
  const desconocidos = layout.nodos.filter(({ id }) => !modelo.personas.has(id)).map(({ id }) => id);
  const solapamientos: Array<[string, string]> = [];
  const filiacionesNoDescendentes: Array<[string, string]> = [];
  const conyugesEnFilasDistintas: Array<[string, string]> = [];
  for (let indice = 0; indice < layout.nodos.length; indice += 1) {
    for (let otro = indice + 1; otro < layout.nodos.length; otro += 1) {
      const a = layout.nodos[indice];
      const b = layout.nodos[otro];
      if (Math.abs(a.x - b.x) < GEOMETRIA_ARBOL.anchoNodo && Math.abs(a.y - b.y) < GEOMETRIA_ARBOL.altoNodo) {
        solapamientos.push([a.id, b.id]);
      }
    }
  }
  modelo.hijosPorPadre.forEach((hijos, padre) => hijos.forEach((hijo) => {
    const posicionPadre = layout.posiciones.get(padre);
    const posicionHijo = layout.posiciones.get(hijo);
    if (posicionPadre && posicionHijo && posicionPadre.generacion >= posicionHijo.generacion) {
      filiacionesNoDescendentes.push([padre, hijo]);
    }
  }));
  const parejasVistas = new Set<string>();
  modelo.conyugesPorPersona.forEach((parejas, persona) => parejas.forEach((pareja) => {
    const [a, b] = [persona, pareja].sort();
    const clave = `${a}:${b}`;
    if (parejasVistas.has(clave)) return;
    parejasVistas.add(clave);
    const posicionA = layout.posiciones.get(a);
    const posicionB = layout.posiciones.get(b);
    if (posicionA && posicionB && posicionA.generacion !== posicionB.generacion) conyugesEnFilasDistintas.push([a, b]);
  }));
  const familiasConHijosEnFilasDistintas = modelo.familias
    .filter(({ hijos }) => new Set(hijos.map((id) => layout.posiciones.get(id)?.generacion).filter((valor) => valor !== undefined)).size > 1)
    .map(({ id }) => id);
  return {
    cantidadPersonas: modelo.personas.size,
    cantidadPosicionadas: layout.posiciones.size,
    faltantes,
    desconocidos,
    solapamientos,
    filiacionesNoDescendentes,
    conyugesEnFilasDistintas,
    familiasConHijosEnFilasDistintas,
  };
}
