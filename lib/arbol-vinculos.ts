import { GEOMETRIA_ARBOL } from "./arbol-tipos";
import type { NodoPosicionadoArbol, PuntoArbol, PuertoArbol, SegmentoArbol, TrazoVinculoArbol, VinculoVisualArbol, TrazoCalculadoArbol, PapelSegmentoArbol } from "./arbol-tipos";

const W = GEOMETRIA_ARBOL.anchoNodo / 2, H = GEOMETRIA_ARBOL.altoNodo / 2;
const EPS = 0.001;
const igual = (a: PuntoArbol, b: PuntoArbol) => Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS;
const numero = (n: number) => String(Math.round(n * 1000) / 1000);
/** Redondea sólo codos de grado dos. Bifurcaciones, anclas y puertos quedan
 * exactos para no cortar la continuidad de un bus ni despegarlo de una ficha.
 * Los segmentos ortogonales siguen siendo la geometría canónica del routing.
 */
function pathSegmentos(ss: SegmentoArbol[], red: SegmentoArbol[], protegidos: PuntoArbol[], nodos: NodoPosicionadoArbol[]) {
  const clave = (p: PuntoArbol) => `${numero(p.x)},${numero(p.y)}`;
  const vecinos = new Map<string, number[]>();
  ss.forEach((s, i) => [s.inicio, s.fin].forEach(p => {
    const indices = vecinos.get(clave(p)) ?? []; indices.push(i); vecinos.set(clave(p), indices);
  }));
  const unir = (p: PuntoArbol) => vecinos.get(clave(p))?.length === 2
    && !protegidos.some(q => igual(p, q)) && red.filter(s => contiene(s, p)).length === 2;
  const vistos = new Set<number>(), paths: Array<{ d: string; tramos: SegmentoArbol[] }> = [];
  const par = (p: PuntoArbol) => `${numero(p.x)},${numero(p.y)}`;
  for (let i = 0; i < ss.length; i++) {
    if (vistos.has(i)) continue;
    const puntos = [ss[i].inicio, ss[i].fin], tramos = [ss[i]]; vistos.add(i);
    const extender = () => {
      while (unir(puntos[puntos.length - 1])) {
        const ultimo = puntos[puntos.length - 1];
        const siguiente = vecinos.get(clave(ultimo))!.find(j => !vistos.has(j));
        if (siguiente === undefined) break;
        vistos.add(siguiente);
        const s = ss[siguiente]; tramos.push(s); puntos.push(igual(s.inicio, ultimo) ? s.fin : s.inicio);
      }
    };
    extender(); puntos.reverse(); extender();
    let d = `M${par(puntos[0])}`;
    for (let j = 1; j < puntos.length - 1; j++) {
      const a = puntos[j - 1], b = puntos[j], c = puntos[j + 1];
      const ab = Math.abs(a.x - b.x) + Math.abs(a.y - b.y), bc = Math.abs(c.x - b.x) + Math.abs(c.y - b.y);
      const radio = Math.min(26, ab * 0.4, bc * 0.4);
      const entrada = { x: b.x + (a.x - b.x) / ab * radio, y: b.y + (a.y - b.y) / ab * radio };
      const salida = { x: b.x + (c.x - b.x) / bc * radio, y: b.y + (c.y - b.y) / bc * radio };
      const codo = (Math.abs(a.x - b.x) < EPS) !== (Math.abs(b.x - c.x) < EPS);
      // La curva queda dentro de este rectángulo: si toca una tarjeta se deja
      // el codo original, incluso en corredores de sólo unos pocos píxeles.
      const libre = !nodos.some(n => Math.max(entrada.x, salida.x) > n.x - W + EPS
        && Math.min(entrada.x, salida.x) < n.x + W - EPS && Math.max(entrada.y, salida.y) > n.y - H + EPS
        && Math.min(entrada.y, salida.y) < n.y + H - EPS);
      d += codo && libre ? ` L${par(entrada)} Q${par(b)} ${par(salida)}` : ` L${par(b)}`;
    }
    const fin = puntos[puntos.length - 1];
    paths.push({ d: puntos.length === 2
      ? `${d} ${Math.abs(puntos[0].x - fin.x) < EPS ? `V${numero(fin.y)}` : `H${numero(fin.x)}`}`
      : `${d} L${par(fin)}`, tramos });
  }
  return paths;
}

export function segmentoAtraviesaTarjeta(s: SegmentoArbol, n: NodoPosicionadoArbol) {
  if (Math.abs(s.inicio.x - s.fin.x) < EPS) return s.inicio.x > n.x - W + EPS && s.inicio.x < n.x + W - EPS
    && Math.max(s.inicio.y, s.fin.y) > n.y - H + EPS && Math.min(s.inicio.y, s.fin.y) < n.y + H - EPS;
  return s.inicio.y > n.y - H + EPS && s.inicio.y < n.y + H - EPS
    && Math.max(s.inicio.x, s.fin.x) > n.x - W + EPS && Math.min(s.inicio.x, s.fin.x) < n.x + W - EPS;
}

function segmentos(puntos: PuntoArbol[]): SegmentoArbol[] {
  return puntos.slice(1).map((fin, i) => ({ inicio: puntos[i], fin })).filter(s => !igual(s.inicio, s.fin));
}

// Sólo los vínculos que saltan filas necesitan buscar un corredor. El resto
// tiene trazos ortogonales directos dentro del espacio reservado entre filas.
function ruta(inicio: PuntoArbol, fin: PuntoArbol, nodos: NodoPosicionadoArbol[]): SegmentoArbol[] {
  if (igual(inicio, fin)) return [];
  const libre = (ss: SegmentoArbol[]) => ss.every(s => !nodos.some(n => segmentoAtraviesaTarjeta(s, n)));
  const simples = [
    [inicio, { x: inicio.x, y: fin.y }, fin],
    [inicio, { x: fin.x, y: inicio.y }, fin],
  ];
  for (const puntos of simples) { const ss = segmentos(puntos); if (libre(ss)) return ss; }
  const cercanos = nodos.filter(n => n.y + H >= Math.min(inicio.y, fin.y) && n.y - H <= Math.max(inicio.y, fin.y)
    && n.x + W >= Math.min(inicio.x, fin.x) - W * 2 && n.x - W <= Math.max(inicio.x, fin.x) + W * 2);
  const xs = [...new Set([inicio.x, fin.x, ...cercanos.flatMap(n => [n.x - W - 8, n.x + W + 8])])].sort((a, b) => a - b);
  const ys = [...new Set([inicio.y, fin.y, ...cercanos.flatMap(n => [n.y - H - 8, n.y + H + 8])])].sort((a, b) => a - b);
  const indice = (ix: number, iy: number) => iy * xs.length + ix;
  const punto = (i: number) => ({ x: xs[i % xs.length], y: ys[Math.floor(i / xs.length)] });
  const primero = indice(xs.indexOf(inicio.x), ys.indexOf(inicio.y));
  const ultimo = indice(xs.indexOf(fin.x), ys.indexOf(fin.y));
  const distancias = new Map<number, number>([[primero * 3, 0]]), anterior = new Map<number, number>();
  // Heap mínimo para A*: se incluye la dirección en el estado para minimizar codos.
  const heap: Array<{ estado: number; costo: number; prioridad: number }> = [];
  const push = (item: typeof heap[number]) => {
    heap.push(item); let i = heap.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (heap[p].prioridad <= item.prioridad) break; heap[i] = heap[p]; i = p; }
    heap[i] = item;
  };
  const pop = () => {
    const item = heap[0], finHeap = heap.pop()!;
    if (heap.length) {
      let i = 0;
      while (i * 2 + 1 < heap.length) {
        let h = i * 2 + 1; if (h + 1 < heap.length && heap[h + 1].prioridad < heap[h].prioridad) h++;
        if (heap[h].prioridad >= finHeap.prioridad) break;
        heap[i] = heap[h]; i = h;
      }
      heap[i] = finHeap;
    }
    return item;
  };
  push({ estado: primero * 3, costo: 0, prioridad: 0 });
  while (heap.length) {
    const actual = pop();
    if (actual.costo !== distancias.get(actual.estado)) continue;
    const i = Math.floor(actual.estado / 3), direccion = actual.estado % 3;
    if (i === ultimo) {
      const puntos = [punto(i)]; let e = actual.estado;
      while (anterior.has(e)) { e = anterior.get(e)!; puntos.push(punto(Math.floor(e / 3))); }
      return segmentos(puntos.reverse());
    }
    const ix = i % xs.length, iy = Math.floor(i / xs.length), a = punto(i);
    for (const [nx, ny, dir] of [[ix - 1, iy, 1], [ix + 1, iy, 1], [ix, iy - 1, 2], [ix, iy + 1, 2]]) {
      if (nx < 0 || nx >= xs.length || ny < 0 || ny >= ys.length) continue;
      const ni = indice(nx, ny), b = punto(ni), estado = ni * 3 + dir;
      if (!libre([{ inicio: a, fin: b }])) continue;
      const costo = actual.costo + Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + (direccion && direccion !== dir ? 24 : 0);
      if (costo >= (distancias.get(estado) ?? Infinity)) continue;
      distancias.set(estado, costo); anterior.set(estado, actual.estado);
      push({ estado, costo, prioridad: costo + Math.abs(b.x - fin.x) + Math.abs(b.y - fin.y) });
    }
  }
  throw new Error("No se encontró un corredor libre para una relación familiar.");
}

interface PlanUnion {
  vinculo: VinculoVisualArbol;
  padres: NodoPosicionadoArbol[];
  hijos: NodoPosicionadoArbol[];
  directa: boolean;
  nivel: number;
  minX: number;
  maxX: number;
  carril: number;
}

function planificar(vinculos: VinculoVisualArbol[], nodos: NodoPosicionadoArbol[]) {
  const porId = new Map(nodos.map(n => [n.data.id, n]));
  // Los subniveles de una banda comparten la misma reserva de carriles. Así
  // mover una pareja 20 px no crea buses casi coincidentes de familias distintas.
  const bandas: number[][] = [];
  for (const y of [...new Set(nodos.map(n => n.y))].sort((a, b) => a - b)) {
    const ultima = bandas[bandas.length - 1];
    if (ultima && y - ultima[0] <= GEOMETRIA_ARBOL.subnivelNumeroso) ultima.push(y);
    else bandas.push([y]);
  }
  const nivelBanda = new Map(bandas.flatMap(ys => ys.map(y => [y, ys[ys.length - 1]] as const)));
  const planes: PlanUnion[] = [];
  for (const vinculo of [...vinculos].sort((a, b) => a.id.localeCompare(b.id))) {
    const padresIds = vinculo.tipo === "conyugal" ? [vinculo.origenId, vinculo.destinoId] : vinculo.progenitoresIds;
    const hijosIds = vinculo.tipo === "conyugal" ? [] : vinculo.hijosIds;
    const padres = padresIds.map(id => porId.get(id)), hijos = hijosIds.map(id => porId.get(id));
    if (!padres.length || padres.some(n => !n) || hijos.some(n => !n) || (vinculo.tipo !== "conyugal" && !hijos.length)) continue;
    const ps = (padres as NodoPosicionadoArbol[]).sort((a, b) => a.x - b.x), hs = hijos as NodoPosicionadoArbol[];
    if ([...ps, ...hs].some(n => !Number.isFinite(n.x) || !Number.isFinite(n.y))) continue;
    const directa = ps.length === 2 && Math.abs(ps[0].y - ps[1].y) < EPS && !nodos.some(n => !padresIds.includes(n.data.id)
      && segmentoAtraviesaTarjeta({ inicio: { x: ps[0].x + W, y: ps[0].y }, fin: { x: ps[1].x - W, y: ps[1].y } }, n));
    planes.push({ vinculo, padres: ps, hijos: hs, directa, nivel: Math.max(...ps.map(p => nivelBanda.get(p.y)!)), minX: Math.min(...[...ps, ...hs].map(p => p.x)), maxX: Math.max(...[...ps, ...hs].map(p => p.x)), carril: 0 });
  }
  // Coloración de intervalos: familias cuyo recorrido horizontal coincide
  // reciben carriles diferentes. El mismo plan determina el espacio vertical.
  const ocupados = new Map<number, PlanUnion[][]>();
  for (const plan of planes.sort((a, b) => a.nivel - b.nivel || a.minX - b.minX || a.maxX - b.maxX || a.vinculo.id.localeCompare(b.vinculo.id))) {
    const carriles = ocupados.get(plan.nivel) ?? [];
    let c = carriles.findIndex(ps => ps.every(p => plan.minX > p.maxX + 8 || plan.maxX < p.minX - 8));
    if (c < 0) { c = carriles.length; carriles.push([]); }
    carriles[c].push(plan); plan.carril = c; ocupados.set(plan.nivel, carriles);
  }
  return { planes, ocupados };
}

/** Espacio que el layout reserva antes de cerrar las coordenadas verticales. */
export function espacioEntreFilasArbol(vinculos: VinculoVisualArbol[], nodos: NodoPosicionadoArbol[]) {
  const { ocupados } = planificar(vinculos, nodos);
  return new Map([...ocupados].map(([y, carriles]) => [y, Math.max(GEOMETRIA_ARBOL.separacionVertical, H * 2 + 40 + carriles.length * GEOMETRIA_ARBOL.separacionCarriles * 2)]));
}

export function crearTrazosVinculosArbol(vinculos: VinculoVisualArbol[], nodosEntrada: NodoPosicionadoArbol[]): TrazoCalculadoArbol[] {
  const nodos = nodosEntrada.filter(n => !n.data.data?.virtual);
  const { planes, ocupados } = planificar(vinculos, nodos);
  const resultados = new Map<string, TrazoVinculoArbol>();
  const membresias = new Map<string, string[]>();
  planes.forEach(p => p.padres.forEach(n => { const ids = membresias.get(n.data.id) ?? []; ids.push(p.vinculo.id); membresias.set(n.data.id, ids); }));
  const puertoInferior = (n: NodoPosicionadoArbol, id: string): PuertoArbol => {
    const ids = membresias.get(n.data.id)!.sort();
    return { personaId: n.data.id, x: n.x + (ids.indexOf(id) - (ids.length - 1) / 2) * Math.min(12, GEOMETRIA_ARBOL.anchoNodo / (ids.length + 1)), y: n.y + H };
  };
  for (const plan of planes) {
    const { vinculo, padres, hijos } = plan;
    const ss: SegmentoArbol[] = [], puertos: PuertoArbol[] = [];
    const agregar = (papel: PapelSegmentoArbol, tramos: SegmentoArbol[]) => ss.push(...tramos.map(s => ({ ...s, papel })));
    const cantidad = ocupados.get(plan.nivel)!.length;
    const puenteY = plan.nivel + H + 12 + plan.carril * GEOMETRIA_ARBOL.separacionCarriles;
    let ancla: PuntoArbol;
    if (plan.directa) {
      const a = { personaId: padres[0].data.id, x: padres[0].x + W, y: padres[0].y };
      const b = { personaId: padres[1].data.id, x: padres[1].x - W, y: padres[1].y };
      puertos.push(a, b); agregar("union", ruta(a, b, nodos));
      ancla = { x: (a.x + b.x) / 2, y: a.y };
    } else if (padres.length === 1) {
      const p = puertoInferior(padres[0], vinculo.id); puertos.push(p); ancla = p;
    } else {
      const ps = padres.map(n => puertoInferior(n, vinculo.id)); puertos.push(...ps);
      ancla = { x: (Math.min(...ps.map(p => p.x)) + Math.max(...ps.map(p => p.x))) / 2, y: puenteY };
      for (const p of ps) agregar("union", ruta(p, { x: p.x, y: puenteY }, nodos));
      agregar("union", ruta({ x: Math.min(...ps.map(p => p.x)), y: puenteY }, { x: Math.max(...ps.map(p => p.x)), y: puenteY }, nodos));
    }
    if (hijos.length) {
      const minimoBus = plan.nivel + H + 24 + cantidad * GEOMETRIA_ARBOL.separacionCarriles + plan.carril * GEOMETRIA_ARBOL.separacionCarriles;
      // El aire adicional se reparte antes y después del distribuidor.
      const siguienteBanda = Math.min(...hijos.map(n => n.y - H), ...nodos
        .filter(n => n.y > plan.nivel + GEOMETRIA_ARBOL.desnivelMaximo * 2).map(n => n.y - H));
      const disponible = siguienteBanda - (plan.nivel + H + 24 + cantidad * GEOMETRIA_ARBOL.separacionCarriles * 2);
      const yBus = minimoBus + Math.max(0, disponible) * 0.35;
      const destino = hijos.map(n => ({ personaId: n.data.id, x: n.x, y: n.y - H }));
      puertos.push(...destino);
      // El ancla SIEMPRE forma parte del intervalo del bus, aun si todos los
      // hijos están a un lado o hay un solo hijo. No quedan cabos en el vacío.
      const minX = Math.min(ancla.x, ...destino.map(p => p.x));
      const maxX = Math.max(ancla.x, ...destino.map(p => p.x));
      agregar("descendencia", ruta(ancla, { x: ancla.x, y: yBus }, nodos));
      agregar(hijos.length > 1 ? "hermanos" : "descendencia", ruta({ x: minX, y: yBus }, { x: maxX, y: yBus }, nodos));
      for (const p of destino) agregar("descendencia", ruta({ x: p.x, y: yBus }, p, nodos));
    }
    const unicos = new Map<string, SegmentoArbol>();
    ss.forEach(s => {
      const clave = [s.inicio, s.fin].map(p => `${numero(p.x)},${numero(p.y)}`).sort().join("|");
      unicos.set(clave, s);
    });
    const finales = [...unicos.values()];
    const dibujar = (tramos: SegmentoArbol[]) => pathSegmentos(tramos, finales, [...puertos, ancla], nodos);
    // Se encadenan los codos también entre el bus y sus bajadas: separarlos
    // por papel impedía redondear precisamente los extremos más visibles.
    const destinos = puertos.filter(p => hijos.some(h => h.data.id === p.personaId));
    const partes: TrazoVinculoArbol["partes"] = [
      ...dibujar(finales.filter(s => s.papel !== "union")).map(({ d, tramos }) => {
        const terminal = destinos.some(p => tramos.some(s => igual(s.inicio, p) || igual(s.fin, p)));
        const bus = tramos.some(s => s.papel === "hermanos");
        // En las bifurcaciones interiores, la bajada nace tangente al bus.
        // El punto de unión sigue sobre la misma rama; el puerto no se mueve.
        if (terminal && !bus && tramos.length === 1) {
          const s = tramos[0], fin = destinos.find(p => igual(s.inicio, p) || igual(s.fin, p));
          const inicio = fin && (igual(s.inicio, fin) ? s.fin : s.inicio);
          const horizontal = inicio && finales.find(r => r.papel === "hermanos" && contiene(r, inicio)
            && Math.abs(r.inicio.y - r.fin.y) < EPS);
          if (fin && inicio && horizontal && Math.abs(inicio.x - fin.x) < EPS && fin.y > inicio.y) {
            const signo = inicio.x < ancla.x ? 1 : -1;
            const disponible = signo > 0 ? Math.max(horizontal.inicio.x, horizontal.fin.x) - inicio.x
              : inicio.x - Math.min(horizontal.inicio.x, horizontal.fin.x);
            const r = Math.min(24, disponible * 0.4, (fin.y - inicio.y) * 0.4);
            const x = inicio.x + signo * r;
            const libre = !nodos.some(n => Math.max(x, inicio.x) > n.x - W && Math.min(x, inicio.x) < n.x + W
              && inicio.y + r > n.y - H && inicio.y < n.y + H);
            if (r > EPS && libre) d = `M${numero(x)},${numero(inicio.y)} Q${numero(inicio.x)},${numero(inicio.y)} ${numero(inicio.x)},${numero(inicio.y + r)} V${numero(fin.y)}`;
          }
        }
        return { d, papel: bus ? "hermanos" as const : "descendencia" as const,
          jerarquia: bus ? "rama" as const : terminal ? "terminal" as const : "tronco" as const };
      }),
      ...dibujar(finales.filter(s => s.papel === "union")).map(({ d }) => ({ d, papel: "union" as const })),
    ];
    resultados.set(vinculo.id, {
      d: partes.map(p => p.d).join(" "),
      modo: vinculo.tipo === "union-familiar" ? "bus" : "curva", degradado: false,
      segmentos: finales, puertos, ancla,
      partes,
    });
  }
  return vinculos.map(vinculo => ({ vinculo, trazo: resultados.get(vinculo.id) ?? null }));
}

export function crearTrazoVinculoArbol(vinculo: VinculoVisualArbol, nodos: NodoPosicionadoArbol[]) {
  return crearTrazosVinculosArbol([vinculo], nodos)[0].trazo;
}

function contiene(s: SegmentoArbol, p: PuntoArbol) {
  return p.x >= Math.min(s.inicio.x, s.fin.x) - EPS && p.x <= Math.max(s.inicio.x, s.fin.x) + EPS
    && p.y >= Math.min(s.inicio.y, s.fin.y) - EPS && p.y <= Math.max(s.inicio.y, s.fin.y) + EPS;
}
function seTocan(a: SegmentoArbol, b: SegmentoArbol) {
  if ([a.inicio, a.fin].some(p => contiene(b, p)) || [b.inicio, b.fin].some(p => contiene(a, p))) return true;
  const aV = Math.abs(a.inicio.x - a.fin.x) < EPS, bV = Math.abs(b.inicio.x - b.fin.x) < EPS;
  if (aV === bV) return false;
  const v = aV ? a : b, h = aV ? b : a;
  const p = { x: v.inicio.x, y: h.inicio.y };
  return contiene(v, p) && contiene(h, p);
}

/** Comprueba geometría real, además de la cobertura lógica de ids. */
export function diagnosticarGeometriaArbol(trazos: TrazoCalculadoArbol[], nodos: NodoPosicionadoArbol[]) {
  const sinTrazo: string[] = [], desconectados: string[] = [], extremosLibres: string[] = [], puertosInvalidos: string[] = [], tarjetasAtravesadas: string[] = [], noFinitos: string[] = [];
  let cruces = 0, longitud = 0;
  for (const { vinculo, trazo } of trazos) {
    if (!trazo || !trazo.segmentos.length) { sinTrazo.push(vinculo.id); continue; }
    const ss = trazo.segmentos;
    const visitados = new Set([0]), cola = [0];
    for (let i = 0; i < cola.length; i++) for (let j = 0; j < ss.length; j++) if (!visitados.has(j) && seTocan(ss[cola[i]], ss[j])) { visitados.add(j); cola.push(j); }
    if (visitados.size !== ss.length) desconectados.push(vinculo.id);
    const esperados = vinculo.tipo === "conyugal" ? [vinculo.origenId, vinculo.destinoId] : [...vinculo.progenitoresIds, ...vinculo.hijosIds];
    for (const id of esperados) {
      const n = nodos.find(n => n.data.id === id), p = trazo.puertos.find(p => p.personaId === id);
      if (!n || !p || !ss.some(s => contiene(s, p)) || !(Math.abs(Math.abs(p.x - n.x) - W) < EPS && Math.abs(p.y - n.y) <= H + EPS || Math.abs(Math.abs(p.y - n.y) - H) < EPS && Math.abs(p.x - n.x) <= W + EPS)) puertosInvalidos.push(`${vinculo.id}:${id}`);
    }
    ss.forEach((s, i) => {
      longitud += Math.abs(s.inicio.x - s.fin.x) + Math.abs(s.inicio.y - s.fin.y);
      if (![s.inicio.x, s.inicio.y, s.fin.x, s.fin.y].every(Number.isFinite)) noFinitos.push(vinculo.id);
      for (const p of [s.inicio, s.fin]) if (!trazo.puertos.some(q => igual(p, q)) && !ss.some((otro, j) => j !== i && contiene(otro, p))) extremosLibres.push(`${vinculo.id}:${numero(p.x)},${numero(p.y)}`);
      for (const n of nodos) if (segmentoAtraviesaTarjeta(s, n)) tarjetasAtravesadas.push(`${vinculo.id}:${n.data.id}`);
    });
  }
  for (let i = 0; i < trazos.length; i++) for (let j = i + 1; j < trazos.length; j++) {
    for (const a of trazos[i].trazo?.segmentos ?? []) for (const b of trazos[j].trazo?.segmentos ?? []) if (seTocan(a, b)) cruces++;
  }
  return { sinTrazo, desconectados, extremosLibres: [...new Set(extremosLibres)], puertosInvalidos, tarjetasAtravesadas: [...new Set(tarjetasAtravesadas)], noFinitos, cruces, longitud: Math.round(longitud) };
}
