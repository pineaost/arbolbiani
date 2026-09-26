import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { cargarTypescript } from "../scripts/cargar-typescript.mjs";
import { persona, cuatroRamas } from "./casos-arbol.mjs";
import { datosReales } from "./datos-reales.mjs";
const require = createRequire(import.meta.url);
const raiz = fileURLToPath(new URL("..", import.meta.url));
const cargarModulo = (p, deps) => cargarTypescript(resolve(raiz, p), deps);
const { calcularLayoutArbol, crearModeloArbol, crearTrazoVinculoArbol, crearTrazosVinculosArbol, crearVinculosVisualesArbol, crearMarcosParejaArbol, diagnosticarGeometriaArbol, diagnosticarLayoutArbol, diagnosticarModeloArbol, diagnosticarVinculosVisualesArbol, GEOMETRIA_ARBOL } = cargarModulo("lib/arbol-chart.ts");
const { diagnosticarFilasArbol, normalizarPersonasArbol, obtenerTodasLasFilas } = cargarModulo("lib/relaciones.ts", { "@/lib/supabase/auth": {}, "@/lib/supabase/server": {}, "@/lib/personas": {} });
const idsRenderizados = ps => calcularLayoutArbol(crearModeloArbol(ps)).nodos.map(n => n.id);
const { obtenerFamiliasArbol, filtrarModeloArbol } = cargarModulo("lib/arbol-filtro.ts");
function componente(modelo, id) { const c = modelo.componentes.find(c => c.ids.includes(id)); assert.ok(c); return c; }
function personaPersistida(id, nacimiento) { const { padres_ids, hijos_ids, conyuges_ids, hermanos_ids, ...p } = persona(id, { nacimiento }); return p; }
function unionesFamiliares(ps) { return crearVinculosVisualesArbol(crearModeloArbol(ps)).filter(v => v.tipo === "union-familiar"); }

function comprobarGeometria(trazos, nodos) {
  const d = diagnosticarGeometriaArbol(trazos, nodos);
  for (const campo of ["sinTrazo", "desconectados", "extremosLibres", "puertosInvalidos", "tarjetasAtravesadas", "noFinitos"]) assert.deepEqual(d[campo], [], campo);
  return d;
}
function comprobarArbol(personas) {
  const modelo = crearModeloArbol(personas), layout = calcularLayoutArbol(modelo);
  const nodos = layout.nodos.map(n => ({ data: { id: n.id }, x: n.x, y: n.y }));
  const vinculos = crearVinculosVisualesArbol(modelo), trazos = crearTrazosVinculosArbol(vinculos, nodos);
  const d = diagnosticarLayoutArbol(modelo, layout), v = diagnosticarVinculosVisualesArbol(modelo, vinculos, nodos);
  for (const campo of ["faltantes", "desconocidos", "solapamientos", "filiacionesNoDescendentes"]) assert.deepEqual(d[campo], [], campo);
  for (const campo of ["filiacionesFaltantes", "filiacionesDuplicadas", "vinculosConyugalesFaltantes", "vinculosConyugalesDuplicados", "personasVinculadasSinRepresentacion", "idsVisualesDuplicados", "vinculosSinTrazo"]) assert.deepEqual(v[campo], [], campo);
  assert.equal(new Set(layout.nodos.map(n => n.id)).size, personas.length);
  const geometria = comprobarGeometria(trazos, nodos);
  for (const { trazo } of trazos) for (const s of trazo.segmentos) for (const p of [s.inicio, s.fin]) {
    assert.ok(p.x >= 0 && p.x <= layout.ancho && p.y >= 0 && p.y <= layout.alto, "el SVG debe contener todos sus segmentos");
  }
  return { modelo, layout, nodos, vinculos, trazos, geometria };
}

const { FAMILIAS_PRINCIPALES, getFamiliaPrincipal, obtenerFamiliasDePersonas } = cargarModulo("lib/familias.ts");
const { filtrarEntradasBitacora } = cargarModulo("lib/bitacora-filtro.ts");
const miembro = (id, apellido, relaciones = {}) => ({ ...persona(id, relaciones), apellido });
const seleccionar = (modelo, ...ids) => filtrarModeloArbol(modelo, obtenerFamiliasArbol(modelo), new Set(ids));

test("las cuatro familias normalizan variantes históricas sin modificar los datos", () => {
  assert.deepEqual(FAMILIAS_PRINCIPALES.map(f => f.nombre), ["Biani", "Della Paolera", "Acevey", "Podrecca"]);
  for (const [apellido, esperado] of [
    ["Acevey", "acevey"], ["Acebey", "acevey"], ["Asebey", "acevey"], ["  ÁCEBEY  ", "acevey"],
    ["Della Paolera", "della-paolera"], ["Della Paoelra", "della-paolera"],
    [" DELLA   PAOELRA ", "della-paolera"], ["Della-Paolera", "della-paolera"],
    ["biáni", "biani"], ["PODRECCA", "podrecca"], ["González", null], ["", null],
    ["Bianchini", null], ["Biani González", null],
  ]) {
    const p = { apellido };
    assert.equal(getFamiliaPrincipal(p), esperado, apellido);
    assert.equal(p.apellido, apellido);
  }
  assert.deepEqual(obtenerFamiliasDePersonas([{ apellido: "Biani" }, { apellido: "Podrecca" }, { apellido: "Biani" }]), new Set(["biani", "podrecca"]));
});

test("todas conserva el modelo completo, ninguna vacía el árbol y dos ramas independientes se compactan", () => {
  const ps = FAMILIAS_PRINCIPALES.flatMap(f => [
    miembro(f.id, f.nombre, { hijos: [`${f.id}-hijo`] }),
    miembro(`${f.id}-hijo`, f.nombre, { padres: [f.id] }),
  ]);
  ps.push(miembro("aislado", "González"));
  const modelo = crearModeloArbol(ps);
  const familias = obtenerFamiliasArbol(modelo);
  assert.equal(familias.length, 4, "un apellido externo no crea otra opción");
  assert.equal(seleccionar(modelo, ...familias.map(f => f.id)), modelo, "incluye también aislados externos con todas activas");
  assert.equal(seleccionar(modelo).personas.size, 0);
  assert.deepEqual(calcularLayoutArbol(seleccionar(modelo)).trazos, []);
  const filtrado = seleccionar(modelo, "biani", "podrecca");
  assert.equal(filtrado.componentes.length, 2);
  assert.deepEqual(new Set(filtrado.personas.keys()), new Set(["biani", "biani-hijo", "podrecca", "podrecca-hijo"]));
  const { layout } = comprobarArbol([...filtrado.personas.values()]);
  assert.ok(layout.ancho < calcularLayoutArbol(modelo).ancho);
  assert.equal(modelo.personas.size, 9);
});

test("la rama conserva parejas externas con ascendencia propia, coprogenitores e hijos de distinto apellido", () => {
  const ps = [
    miembro("a", "Biani", { conyuges: ["pareja"], hijos: ["hijo", "hija"] }),
    miembro("pareja", "González", { padres: ["abuelo-externo"], hijos: ["hijo", "medio-hermano"] }),
    miembro("abuelo-externo", "González"),
    miembro("hijo", "González", { padres: ["a", "pareja"], hijos: ["nieto"] }),
    miembro("nieto", "Otro"),
    miembro("hija", "Biani", { padres: ["a", "coprogenitor"] }),
    miembro("coprogenitor", "Otro"),
    miembro("medio-hermano", "González"),
    miembro("aislado", "Otro"),
  ];
  const modelo = crearModeloArbol(ps), antes = structuredClone(ps);
  const filtrado = seleccionar(modelo, "biani");
  assert.deepEqual(new Set(filtrado.personas.keys()), new Set(["a", "pareja", "hijo", "hija", "nieto", "coprogenitor"]));
  assert.ok(filtrado.conyugesPorPersona.get("a").has("pareja"));
  assert.deepEqual(new Set(filtrado.padresPorHijo.get("hijo")), new Set(["a", "pareja"]));
  assert.deepEqual(new Set(filtrado.padresPorHijo.get("hija")), new Set(["a", "coprogenitor"]));
  comprobarArbol([...filtrado.personas.values()]);
  assert.deepEqual(ps, antes, "no modificar apellidos ni relaciones originales");
});

test("ramas conectadas comparten hijos y parejas sin duplicarlos ni expandir la otra ascendencia", () => {
  const modelo = crearModeloArbol([
    miembro("a", "Biani", { hijos: ["a-hijo"] }),
    miembro("a-hijo", "Biani", { conyuges: ["b-hija"], hijos: ["compartido"] }),
    miembro("b", "Podrecca", { hijos: ["b-hija"] }),
    miembro("b-hija", "Podrecca", { hijos: ["compartido"] }),
    miembro("compartido", "Otro", { padres: ["a-hijo", "b-hija"] }),
  ]);
  const soloA = seleccionar(modelo, "biani");
  assert.equal(soloA.personas.has("b-hija"), true, "la pareja sigue visible como contexto");
  assert.equal(soloA.personas.has("b"), false, "no arrastrar la rama de la pareja");
  comprobarArbol([...soloA.personas.values()]);
  const ambas = seleccionar(modelo, "biani", "podrecca");
  const { layout } = comprobarArbol([...ambas.personas.values()]);
  assert.equal(layout.nodos.filter(n => n.id === "compartido").length, 1);
  assert.equal(ambas.personas.size, 5);
});

test("familias unidas indirectamente pueden mostrarse como componentes independientes", () => {
  const modelo = crearModeloArbol([
    miembro("a", "Biani", { conyuges: ["b-hijo"] }),
    miembro("b", "Acevey", { hijos: ["b-hijo", "b-hija"] }),
    miembro("b-hijo", "Acebey"), miembro("b-hija", "Asebey", { conyuges: ["c"] }),
    miembro("c", "Podrecca"),
  ]);
  assert.equal(modelo.componentes.length, 1);
  const filtrado = seleccionar(modelo, "biani", "podrecca");
  assert.equal(filtrado.componentes.length, 2);
  assert.equal(filtrado.personas.has("b"), false);
  comprobarArbol([...filtrado.personas.values()]);
});

test("las cuatro familias de la muestra actual se renderizan solas con sus variantes y vínculos completos", () => {
  const ps = JSON.parse(readFileSync(resolve(raiz, "Referencias/revision-layout/personas-actuales.json"), "utf8"));
  const modelo = crearModeloArbol(ps), familias = obtenerFamiliasArbol(modelo);
  assert.equal(familias.length, 4);
  for (const familia of familias) {
    const filtrado = seleccionar(modelo, familia.id);
    for (const p of ps.filter(p => getFamiliaPrincipal(p) === familia.id)) assert.ok(filtrado.personas.has(p.id));
    assert.deepEqual(filtrado.problemas, []);
    comprobarArbol([...filtrado.personas.values()]);
  }
});

test("Bitácora combina familias normalizadas con tipo y persona sin buscar apellidos en el texto", () => {
  const apellidos = ["Biani", "Podrecca", "Acevey", "Acebey", "Asebey", "Della Paolera", "Della Paoelra", "González"];
  const entradas = apellidos.map((apellido, i) => ({
    id: `e${i}`, tipo: i === 3 ? "documento_pendiente" : "nota", persona_id: `p${i}`,
    persona: { id: `p${i}`, nombre: "Persona", apellido }, contenido: "Biani Podrecca Acevey Della Paolera",
  }));
  entradas.push({ id: "general", tipo: "nota", persona_id: null, persona: null, contenido: "Biani" });
  const filtrar = (familias, opciones = {}) => filtrarEntradasBitacora(entradas, { tipo: "todas", personaId: "", familias: new Set(familias), ...opciones }).map(e => e.id);
  assert.deepEqual(filtrar([]), entradas.map(e => e.id));
  assert.deepEqual(filtrar(["biani"]), ["e0"]);
  assert.deepEqual(filtrar(["podrecca"]), ["e1"]);
  assert.deepEqual(filtrar(["acevey"]), ["e2", "e3", "e4"]);
  assert.deepEqual(filtrar(["della-paolera"]), ["e5", "e6"]);
  assert.deepEqual(filtrar(["biani", "podrecca"]), ["e0", "e1"]);
  assert.deepEqual(filtrar(FAMILIAS_PRINCIPALES.map(f => f.id)), entradas.slice(0, 7).map(e => e.id));
  assert.deepEqual(filtrar(["acevey"], { tipo: "documento_pendiente", personaId: "p3" }), ["e3"]);
  assert.deepEqual(filtrar(["biani"], { tipo: "documento_pendiente", personaId: "p3" }), []);
  assert.deepEqual(filtrar(["acevey"], { tipo: "nota", personaId: "p3" }), []);
  assert.deepEqual(filtrar([], { personaId: "p7" }), ["e7"]);
  assert.equal(new Set(filtrar(["acevey", "della-paolera"])).size, 5);
});

test("la muestra histórica real conserva cada puerto, familia y tarjeta sin cruces", () => {
  const r = comprobarArbol(datosReales());
  assert.equal(r.geometria.cruces, 0);
});

test("base actual: 121 personas y todas sus filiaciones permanecen conectadas", () => {
  const ps = JSON.parse(readFileSync(resolve(raiz, "Referencias/revision-layout/personas-actuales.json"), "utf8"));
  const { modelo, layout, geometria } = comprobarArbol(ps);
  assert.equal(ps.length, 121);
  assert.ok(layout.ancho < 12000, "el ancho anterior era de 21944 px; ahora también se alinean medios hermanos");
  // La proximidad padre-hijo tiene prioridad sobre eliminar cada cruce.
  assert.ok(geometria.cruces <= 14, `no superar los 14 contactos históricos; ahora: ${geometria.cruces}`);
  for (const f of modelo.familias) {
    if (f.progenitores.length === 2) {
      const [a,b] = f.progenitores.map(id => layout.posiciones.get(id));
      if (a.y === b.y) assert.ok(Math.abs(a.x - b.x) <= 2 * (GEOMETRIA_ARBOL.anchoNodo + GEOMETRIA_ARBOL.separacionPareja) + 0.001);
    }
    const centro = f.progenitores.reduce((s,id)=>s+layout.posiciones.get(id).x,0)/f.progenitores.length;
    assert.ok(f.hijos.every(id => Math.abs(layout.posiciones.get(id).x-centro)<2000), "ninguna filiación debe volver a tener los 14510 px anteriores");
  }
  assert.ok(layout.advertencias.some(s => s.includes(ps.find(p => p.nombre === "Giovanni" && p.apellido === "Biani").id)), "la filiación de Antonia reúne generaciones distintas y debe informarse");
});

test("permutar filas y vínculos de la base real conserva exactamente posiciones y trazos", () => {
  const ps = JSON.parse(readFileSync(resolve(raiz, "Referencias/revision-layout/personas-actuales.json"), "utf8"));
  const a = comprobarArbol(ps);
  const b = comprobarArbol([...ps].reverse().map(p => ({...p,padres_ids:[...p.padres_ids].reverse(),hijos_ids:[...p.hijos_ids].reverse(),conyuges_ids:[...p.conyuges_ids].reverse()})));
  assert.deepEqual(a.layout, b.layout);
  assert.deepEqual(a.trazos, b.trazos);
});

for (const hijos of [["h"], ["h", "h2"]]) test(`regresión: el bus incluye el ancla aunque ${hijos.length} hijos queden a un costado`, () => {
  const vinculo = { id:"f",tipo:"union-familiar",familiaId:"f",progenitoresIds:["a","b"],hijosIds:hijos };
  const nodos = [{data:{id:"a"},x:0,y:0},{data:{id:"b"},x:196,y:0},...hijos.map((id,i)=>({data:{id},x:600+i*216,y:200}))];
  comprobarGeometria(crearTrazosVinculosArbol([vinculo], nodos), nodos);
});

test("las líneas que saltan generaciones rodean todas las tarjetas interpuestas", () => {
  const vinculo = { id:"f",tipo:"union-familiar",familiaId:"f",progenitoresIds:["p"],hijosIds:["h"] };
  const nodos = [{data:{id:"p"},x:0,y:0},{data:{id:"bloqueo"},x:0,y:172},{data:{id:"h"},x:0,y:516}];
  comprobarGeometria(crearTrazosVinculosArbol([vinculo],nodos),nodos);
});

test("los coprogenitores forman una unidad geométrica aunque no estén casados", () => {
  const r = comprobarArbol([persona("a"), persona("b"), persona("h",{padres:["a","b"]})]);
  assert.equal(r.layout.posiciones.get("a").y,r.layout.posiciones.get("b").y);
  assert.equal(Math.abs(r.layout.posiciones.get("a").x-r.layout.posiciones.get("b").x),196);
  assert.equal(r.modelo.conyugesPorPersona.size,0,"agrupar para el layout no crea matrimonios en los datos");
});

test("cuatro ramas con matrimonios sucesivos tienen puertos válidos y espacio propio", () => {
  comprobarArbol(cuatroRamas());
});

test("matrimonios que reúnen ramas conservan cerca ambas ascendencias", () => {
  const ps = [persona("abuelo-a"),persona("padre-a",{padres:["abuelo-a"]}),persona("a",{padres:["padre-a"],conyuges:["b"]}),persona("abuelo-b"),persona("padre-b",{padres:["abuelo-b"]}),persona("b",{padres:["padre-b"]})];
  const r = comprobarArbol(ps);
  for (const [p,h] of [["abuelo-a","padre-a"],["padre-a","a"],["abuelo-b","padre-b"],["padre-b","b"]]) assert.ok(Math.abs(r.layout.posiciones.get(p).x-r.layout.posiciones.get(h).x)<300);
  assert.equal(r.geometria.cruces,0);
});

test("una unión entre generaciones no contrae un progenitor con su descendencia", () => {
  const r = comprobarArbol([persona("a",{conyuges:["c"]}),persona("b",{padres:["a"]}),persona("c",{padres:["b"]}),persona("h",{padres:["a","c"]})]);
  assert.ok(r.layout.advertencias.length>0);
  assert.ok(r.layout.posiciones.get("a").y<r.layout.posiciones.get("b").y);
  assert.ok(r.layout.posiciones.get("b").y<r.layout.posiciones.get("c").y);
});

test("hermanos casados con generaciones diferentes conservan toda la filiación", () => {
  comprobarArbol([persona("p"),persona("a",{padres:["p"],conyuges:["c"]}),persona("b",{padres:["p"]}),persona("c",{padres:["b"]})]);
});

test("cinco uniones reservan carriles sin extremos sueltos ni hijos de otra pareja", () => {
  const ps = [persona("p")];
  for(let i=0;i<5;i++) ps.push(persona(`pareja-${i}`,{conyuges:["p"]}),persona(`hijo-${i}`,{padres:["p",`pareja-${i}`]}));
  const r = comprobarArbol(ps);
  assert.equal(r.vinculos.length,5);
  for (const v of r.vinculos) assert.equal(v.hijosIds.length,1);
});

test("la cronología de hermanos no depende del género ni de la edad de su pareja", () => {
  const ps = [persona("p"),{...persona("mayor",{padres:["p"],nacimiento:"1970-01-01"}),genero:"femenino"},persona("mediano",{padres:["p"],nacimiento:"1972-01-01"}),persona("menor",{padres:["p"],nacimiento:"1975-01-01",conyuges:["pareja"]}),persona("pareja",{nacimiento:"1960-01-01"})];
  const r = comprobarArbol(ps), ids = ["mayor","mediano","menor"].sort((a,b)=>r.layout.posiciones.get(a).x-r.layout.posiciones.get(b).x);
  assert.ok(["mayor,mediano,menor","menor,mediano,mayor"].includes(ids.join(",")), "la rama puede orientarse hacia otra familia, conservando su orden cronológico");
  const otra = calcularLayoutArbol(crearModeloArbol(ps.map(p=>({...p,genero:"no_definido"}))));
  assert.deepEqual(otra.nodos,r.layout.nodos);
});

for (const cantidad of [8, 10, 11]) test(`${cantidad} hermanos sin fechas equilibran ambas ascendencias manteniendo parejas y generación`, () => {
  const ps = [persona("padre"), persona("madre"), ...Array.from({ length: cantidad }, (_, i) =>
    persona(`h${String(i).padStart(2, "0")}`, { padres: ["padre", "madre"], nacimiento: null,
      conyuges: i === 3 ? ["pareja-a"] : i === 7 ? ["pareja-b"] : [] })),
    persona("raiz-a"), persona("raiz-b"), persona("pareja-a", { padres: ["raiz-a"] }), persona("pareja-b", { padres: ["raiz-b"] })];
  const { layout, geometria } = comprobarArbol(ps);
  const hermanos = layout.nodos.filter(n => n.id.startsWith("h")).sort((a, b) => a.x - b.x);
  assert.equal(new Set(hermanos.map(n => n.generacion)).size, 1);
  assert.ok(Math.max(...hermanos.map(n => n.y)) - Math.min(...hermanos.map(n => n.y)) <= GEOMETRIA_ARBOL.desnivelMaximo * 2);
  // Cada matrimonio puede mirar a un extremo distinto. Exigir que ambos estén
  // a la derecha descartaba una solución sin cruces con ascendencias a ambos lados.
  for (const [h, raiz] of [["h03", "raiz-a"], ["h07", "raiz-b"]]) {
    const indice = hermanos.findIndex(n => n.id === h);
    const centro = (hermanos[0].x + hermanos[hermanos.length - 1].x) / 2;
    assert.ok(layout.posiciones.get(raiz).x < centro ? indice <= 2 : indice >= cantidad - 3);
  }
  for (const [h, p] of [["h03", "pareja-a"], ["h07", "pareja-b"]]) {
    assert.ok(Math.abs(Math.abs(layout.posiciones.get(h).x - layout.posiciones.get(p).x) - 196) < 0.001);
  }
  assert.ok(geometria.cruces <= 1);
  assert.deepEqual(calcularLayoutArbol(crearModeloArbol([...ps].reverse())).nodos, layout.nodos);
});

test("los codos suaves conservan puertos y bifurcaciones exactos y no entran en tarjetas", () => {
  const vinculo = { id: "salto", tipo: "union-familiar", familiaId: "salto", progenitoresIds: ["p"], hijosIds: ["h"] };
  const nodos = [{ data: { id: "p" }, x: 0, y: 0 }, { data: { id: "obstaculo" }, x: 0, y: 172 }, { data: { id: "h" }, x: 0, y: 516 }];
  const trazos = crearTrazosVinculosArbol([vinculo], nodos);
  comprobarGeometria(trazos, nodos);
  assert.match(trazos[0].trazo.d, / Q/, "los desvíos deben tener esquinas suavizadas");
  assert.doesNotMatch(trazos[0].trazo.d, /NaN|Infinity/);
  // Verifica la curva dibujada, además de los segmentos usados por el router.
  for (const match of trazos[0].trazo.d.matchAll(/L(-?[\d.]+),(-?[\d.]+) Q(-?[\d.]+),(-?[\d.]+) (-?[\d.]+),(-?[\d.]+)/g)) {
    const [ax, ay, bx, by, cx, cy] = match.slice(1).map(Number);
    for (let i = 0; i <= 20; i++) {
      const t = i / 20, x = (1-t)**2*ax+2*(1-t)*t*bx+t*t*cx, y = (1-t)**2*ay+2*(1-t)*t*by+t*t*cy;
      assert.ok(nodos.every(n => Math.abs(n.x-x) >= 88-0.001 || Math.abs(n.y-y) >= 46-0.001));
    }
  }
});

test("familias en subniveles próximos comparten carriles separados y conservan el tronco común", () => {
  const nodos = [
    { data: { id: "p" }, x: 0, y: 0 }, { data: { id: "q" }, x: 600, y: 20 },
    { data: { id: "a" }, x: 1000, y: 240 }, { data: { id: "b" }, x: 1200, y: 240 },
    { data: { id: "c" }, x: -600, y: 240 }, { data: { id: "d" }, x: -400, y: 240 },
  ];
  const vinculos = [["p", "a", "b"], ["q", "c", "d"]].map(([p, ...hijos]) => ({
    id: p, familiaId: p, tipo: "union-familiar", progenitoresIds: [p], hijosIds: hijos,
  }));
  const trazos = crearTrazosVinculosArbol(vinculos, nodos);
  comprobarGeometria(trazos, nodos);
  const buses = trazos.map(({ trazo }) => trazo.segmentos.filter(s => s.papel === "hermanos"));
  assert.ok(buses.every(ss => ss.length === 1), "cada familia conserva un distribuidor compartido");
  assert.ok(Math.abs(buses[0][0].inicio.y - buses[1][0].inicio.y) >= 16,
    "los pequeños desniveles no deben superponer los recorridos horizontales");
});

for (const cantidad of [4, 8, 10, 11]) test(`${cantidad} hermanos: plegado acotado con puertos libres y generaciones distinguibles`, () => {
  const ps = [persona("raiz"), ...Array.from({ length: cantidad }, (_, i) => persona(`h${i}`, { padres: ["raiz"] }))];
  const r = comprobarArbol(ps), hs = r.layout.nodos.filter(n => n.id !== "raiz");
  const ys = [...new Set(hs.map(n => n.y))].sort((a, b) => a - b);
  assert.equal(ys.length, cantidad >= 8 ? 2 : 1);
  if (cantidad >= 8) {
    assert.equal(ys[1] - ys[0], GEOMETRIA_ARBOL.subnivelNumeroso);
    assert.ok(Math.max(...hs.map(n => n.x)) - Math.min(...hs.map(n => n.x)) + 176 < cantidad * 216 * 0.8);
    assert.equal(new Set(hs.map(n => n.generacion)).size, 1);
    const secundarios = hs.filter(n => n.y === ys[1]);
    assert.ok(secundarios.length < hs.length / 2, "la mayoría permanece en la fila principal");
    const orden = [...hs].sort((a, b) => a.id.localeCompare(b.id));
    const indices = secundarios.map(n => orden.indexOf(n)).sort((a, b) => a - b);
    assert.equal(indices.at(-1) - indices[0] + 1, indices.length, "se pliega un subgrupo continuo, no hermanos alternados");
    assert.ok(ys[0] - r.layout.posiciones.get("raiz").y >= GEOMETRIA_ARBOL.separacionVertical);
  }
  assert.deepEqual(calcularLayoutArbol(crearModeloArbol([...ps].reverse())).nodos, r.layout.nodos);
});

test("las bifurcaciones interiores se curvan y distinguen tronco, rama y terminación", () => {
  const ps = [persona("p"), ...["a", "b", "c"].map(id => persona(id, { padres: ["p"] }))];
  const r = comprobarArbol(ps), partes = r.trazos.flatMap(t => t.trazo.partes);
  assert.ok(partes.some(p => p.jerarquia === "tronco"));
  assert.ok(partes.some(p => p.jerarquia === "rama" && p.d.includes(" Q")));
  assert.ok(partes.some(p => p.jerarquia === "terminal" && p.d.includes(" Q")));
});

test("una pareja puente conserva ambas ascendencias y centra su bloque de hijos", () => {
  const ps = [miembro("raiz-a", "Biani"), miembro("raiz-b", "Acevey"),
    ...["a0", "a1", "a2"].map(id => miembro(id, "Biani", { padres: ["raiz-a"] })),
    ...["b0", "b1", "b2"].map(id => miembro(id, "Acevey", { padres: ["raiz-b"] })),
    ...["h0", "h1", "h2"].map(id => miembro(id, "Biani", { padres: ["a1", "b1"] }))];
  const { layout } = comprobarArbol(ps), p = id => layout.posiciones.get(id);
  assert.equal(Math.abs(p("a1").x - p("b1").x), 196);
  const centro = (p("a1").x + p("b1").x) / 2;
  const hijos = ["h0", "h1", "h2"].map(id => p(id).x);
  assert.ok(Math.abs((Math.min(...hijos) + Math.max(...hijos)) / 2 - centro) < 40);
  assert.equal(new Set(["h0", "h1", "h2"].map(id => p(id).y)).size, 1);
  for (const [id, hermanos] of [["a1", ["a0", "a2"]], ["b1", ["b0", "b2"]]]) {
    assert.ok(hermanos.every(h => Math.abs(p(h).x - p(id).x) <= 3 * 216));
  }
});

test("una madre aún no registrada no separa a los hermanos de generación", () => {
  const ps=JSON.parse(readFileSync(resolve(raiz, "Referencias/revision-layout/personas-actuales.json"),"utf8"));
  const r=comprobarArbol(ps), juan=ps.find(p=>p.nombre==="Juan Valentín"&&p.apellido==="Biani");
  assert.equal(new Set([...r.modelo.hijosPorPadre.get(juan.id)].map(id=>r.layout.posiciones.get(id).generacion)).size,1);
});

test("no se aceptan coordenadas no finitas ni referencias ausentes", () => {
  const v = {id:"c",tipo:"conyugal",origenId:"a",destinoId:"b"};
  assert.equal(crearTrazoVinculoArbol(v,[{data:{id:"a"},x:0,y:0}]),null);
  assert.equal(crearTrazoVinculoArbol(v,[{data:{id:"a"},x:0,y:0},{data:{id:"b"},x:NaN,y:0}]),null);
  assert.throws(()=>calcularLayoutArbol(crearModeloArbol([persona("a",{padres:["ausente"]})])),/inconsistentes/);
});

test("mover o eliminar personas vuelve a generar todos los puertos desde las nuevas posiciones", () => {
  const ps = datosReales(), a = comprobarArbol(ps);
  const n = a.nodos.map(n=>({...n,x:n.x+17,y:n.y+23}));
  const b = crearTrazosVinculosArbol(a.vinculos,n);
  comprobarGeometria(b,n);
  a.trazos.forEach((t,i)=>t.trazo.puertos.forEach((p,j)=>{
    assert.equal(b[i].trazo.puertos[j].x,p.x+17); assert.equal(b[i].trazo.puertos[j].y,p.y+23);
  }));
  const id = ps[0].id;
  comprobarArbol(ps.filter(p=>p.id!==id).map(p=>({...p,padres_ids:p.padres_ids.filter(q=>q!==id),hijos_ids:p.hijos_ids.filter(q=>q!==id),conyuges_ids:p.conyuges_ids.filter(q=>q!==id)})));
});

test("los diagnósticos detectan una línea incompleta aunque todos los ids estén declarados", () => {
  const r = comprobarArbol([persona("a"),persona("b",{padres:["a"]})]);
  const roto = structuredClone(r.trazos);
  roto[0].trazo.segmentos.pop();
  const d = diagnosticarGeometriaArbol(roto,r.nodos);
  assert.ok(d.puertosInvalidos.length+d.extremosLibres.length+d.desconectados.length>0);
});

test("un grupo con diez cónyuges sin hijos queda íntegro dentro del lienzo", () => {
  comprobarArbol([persona("centro"), ...Array.from({length:10},(_,i)=>persona(`pareja-${i}`,{conyuges:["centro"]}))]);
});

test("familias generadas reproduciblemente conservan continuidad al crecer y unirse", () => {
  for(let semilla=1;semilla<=10;semilla++) {
    let estado=semilla;
    const azar=limite=>{estado=(Math.imul(estado,1664525)+1013904223)>>>0;return estado%limite;};
    const ps=[];
    for(let nivel=0;nivel<5;nivel++) for(let i=0;i<8;i++) {
      const padres=nivel?[`g${nivel-1}-${azar(8)}`,`g${nivel-1}-${azar(8)}`]:[];
      ps.push(persona(`g${nivel}-${i}`,{padres:[...new Set(padres)],nacimiento:`${1850+nivel*28}-01-01`}));
    }
    comprobarArbol(ps);
  }
});

test("revisión final: Remigio y Esther se distinguen sin desplazar sus fichas ni incluir hermanos", () => {
  const ps = JSON.parse(readFileSync(resolve(raiz,"Referencias/revision-layout/personas-revision-final.json"),"utf8"));
  const r = comprobarArbol(ps), antes = structuredClone(r.layout.nodos);
  const remigio = ps.find(p=>p.nombre==="Remigio Lorenzo"), esther=ps.find(p=>p.nombre==="Esther Iris");
  const bruno = ps.find(p => p.nombre === "Bruno" && p.apellido === "Podrecca");
  const numerosa = [...r.modelo.familias].sort((a, b) => b.hijos.length - a.hijos.length)[0];
  const hermanosNumerosos = numerosa.hijos.map(id => r.layout.posiciones.get(id));
  assert.equal(new Set(hermanosNumerosos.map(n => n.y)).size, 2,
    "la familia más numerosa debe plegarse incluso con su pareja conectora en el extremo derecho");
  assert.ok(Math.max(...hermanosNumerosos.map(n => n.x)) - Math.min(...hermanosNumerosos.map(n => n.x)) + 176
    <= numerosa.hijos.length * 216 * 0.65, "la mayoría alineada todavía ahorra al menos 35% del ancho de una sola fila");
  assert.ok(Math.abs(r.layout.posiciones.get(esther.id).x - r.layout.posiciones.get(bruno.id).x) <= 4 * 216,
    "la zona de transición admite hasta cuatro pasos entre hermanos con ramas propias (antes: 2632 px)");
  const distancias = r.modelo.familias.flatMap(f => {
    const centro = f.progenitores.reduce((s, id) => s + r.layout.posiciones.get(id).x, 0) / f.progenitores.length;
    return f.hijos.map(id => Math.abs(r.layout.posiciones.get(id).x - centro));
  });
  assert.ok(Math.max(...distancias) < 1600, "reducir el máximo anterior de 1842 px");
  assert.ok(distancias.reduce((a,b) => a+b,0) / distancias.length < 450, "reducir la media anterior de 532 px");
  for (const generacion of new Set(r.layout.nodos.map(n => n.generacion))) {
    const ys = r.layout.nodos.filter(n => n.generacion === generacion).map(n => n.y);
    assert.ok(Math.max(...ys) - Math.min(...ys) <= GEOMETRIA_ARBOL.subnivelNumeroso);
  }
  const marcos = crearMarcosParejaArbol(r.modelo,r.layout), marco = marcos.find(m=>m.personasIds.includes(remigio.id));
  assert.ok(marco.ramaNumerosa);
  assert.deepEqual(new Set(marco.personasIds),new Set([remigio.id,esther.id]));
  for(const n of r.layout.nodos) if(!marco.personasIds.includes(n.id)) {
    assert.ok(n.x+88 <= marco.x || n.x-88 >= marco.x+marco.ancho || n.y+46 <= marco.y || n.y-46 >= marco.y+marco.alto, "el marco no debe agrupar una ficha ajena");
  }
  assert.deepEqual(r.layout.nodos,antes,"la presentación no toma decisiones de posición");
  assert.ok(marcos.filter(m=>m.ramaNumerosa).length>1,"la solución se aplica a otras familias numerosas");
});

test("los marcos no sugieren parejas exclusivas cuando hay varios cónyuges", () => {
  const r = comprobarArbol([persona("a",{conyuges:["b","c"]}),persona("b"),persona("c")]);
  assert.deepEqual(crearMarcosParejaArbol(r.modelo,r.layout),[]);
});

let referenciaBiani;
function casoBiani() {
  if (!referenciaBiani) {
    const personas = JSON.parse(readFileSync(resolve(raiz, "Referencias/revision-layout/personas-revision-final.json"), "utf8"));
    const r = comprobarArbol(personas);
    const juan = personas.find(p => p.nombre === "Juan Valentín" && p.apellido === "Biani");
    const hermanos = [...r.modelo.hijosPorPadre.get(juan.id)];
    const buscar = nombre => personas.find(p => p.nombre === nombre).id;
    referenciaBiani = { personas, ...r, hermanos, remigio: buscar("Remigio Lorenzo"), esther: buscar("Esther Iris"), bruno: buscar("Bruno") };
  }
  return referenciaBiani;
}

function comprobarFronteraBiani(layout) {
  const { hermanos, remigio, esther, bruno } = casoBiani();
  const p = id => layout.posiciones.get(id);
  const fila = layout.nodos.filter(n => n.generacion === p(remigio).generacion).sort((a, b) => a.x - b.x);
  const indices = hermanos.map(id => fila.findIndex(n => n.id === id));
  assert.equal(Math.max(...indices) - Math.min(...indices) + 1, 10, "ninguna persona ajena se inserta entre los diez hermanos");
  assert.equal(new Set(hermanos.map(id => p(id).y)).size, 1, "el matrimonio entre ramas mantiene una fila estable al crecer");
  assert.equal(p(remigio).x, Math.min(...hermanos.map(id => p(id).x)), "Remigio mira a la rama Podrecca de la izquierda");
  assert.ok(p(bruno).x < p(esther).x && p(esther).x < p(remigio).x);
  assert.ok(p(esther).x - p(bruno).x <= 256.001, "Bruno y Esther permanecen adyacentes");
  assert.ok(Math.abs(p(remigio).x - p(esther).x - 196) < 0.001, "la unión entre familias ocupa sólo el espacio de una pareja");
}

test("Podrecca y los diez Biani ocupan regiones consecutivas con una unión corta en la frontera", () => {
  const r = casoBiani();
  comprobarFronteraBiani(r.layout);
  assert.equal(r.geometria.cruces, 0);
  assert.deepEqual(r.geometria.solapamientos, []);
});

for (const nombres of [["Agustín Alberto", "Eduardo Mariano"], ["Isabel Emilia", "María Luisa"], ["José Valentín", "Ricardo Alfredo"]]) {
  test(`agregar hijos a ${nombres.join(" y ")} conserva las familias y las generaciones existentes`, () => {
    const base = casoBiani();
    const ps = structuredClone(base.personas);
    nombres.forEach((nombre, i) => ps.push(persona(`descendiente-prueba-${i}`, {
      padres: [ps.find(p => p.nombre === nombre).id], nacimiento: "1950-01-01",
    })));
    const r = comprobarArbol(ps);
    comprobarFronteraBiani(r.layout);
    const orden = l => [...base.hermanos].sort((a, b) => l.posiciones.get(a).x - l.posiciones.get(b).x);
    assert.deepEqual(orden(r.layout), orden(base.layout), "tener hijos no permuta hermanos");
    for (const n of base.layout.nodos) assert.equal(r.layout.posiciones.get(n.id).generacion, n.generacion, "una hoja nueva no cambia las generaciones existentes");
    for (const id of base.hermanos) assert.ok(Math.abs(r.layout.posiciones.get(id).x - base.layout.posiciones.get(id).x) < 216, "no desplazar innecesariamente la rama consolidada");
    assert.deepEqual(r.geometria.solapamientos, []);
    assert.equal(r.geometria.cruces, 0, "separar núcleos verticalmente antes de forzar cruces entre matrimonios");
  });
}

test("el orden de carriles elimina cruces evitables cuando dos familias se desplazan hacia el mismo lado", () => {
  const nodos = [
    { data: { id: "p" }, x: 0, y: 0 }, { data: { id: "q" }, x: 200, y: 0 },
    { data: { id: "a" }, x: 400, y: 300 }, { data: { id: "b" }, x: 600, y: 300 },
  ];
  const vs = [["p", "a"], ["q", "b"]].map(([p, h]) => ({ id: p, familiaId: p, tipo: "union-familiar", progenitoresIds: [p], hijosIds: [h] }));
  const trazos = crearTrazosVinculosArbol(vs, nodos);
  assert.equal(comprobarGeometria(trazos, nodos).cruces, 0);
  assert.deepEqual(diagnosticarGeometriaArbol(trazos, nodos).solapamientos, []);
  assert.deepEqual(crearTrazosVinculosArbol([...vs].reverse(), [...nodos].reverse()).reverse(), trazos);
});

test("nuevos cónyuges, hermanos y nietos conservan ambas hermandades sin depender de apellidos conocidos", () => {
  const ps = [persona("raiz-a"), persona("raiz-b"),
    ...Array.from({ length: 10 }, (_, i) => persona(`hermano-${i}`, { padres: ["raiz-a"] })),
    persona("puente", { padres: ["raiz-b"], conyuges: ["hermano-3"] }),
    persona("otro-hermano", { padres: ["raiz-b"] }),
    persona("hijo-puente", { padres: ["hermano-3", "puente"] }),
    persona("nieto-puente", { padres: ["hijo-puente"] }),
  ];
  const inicial = comprobarArbol(ps);
  for (const nuevas of [
    [persona("hijo-4", { padres: ["hermano-4"] }), persona("hijo-7", { padres: ["hermano-7"] })],
    [persona("pareja-4", { conyuges: ["hijo-4"] }), persona("otro-hijo-7", { padres: ["hermano-7"] })],
    [persona("nieto-4", { padres: ["hijo-4", "pareja-4"] }), persona("nieto-7", { padres: ["hijo-7"] })],
  ]) {
    ps.push(...nuevas);
    const r = comprobarArbol(ps);
    for (const n of inicial.layout.nodos) assert.equal(r.layout.posiciones.get(n.id).generacion, n.generacion);
    for (const raiz of ["raiz-a", "raiz-b"]) {
      const grupos = new Set([...r.modelo.hijosPorPadre.get(raiz)].map(id => r.layout.posiciones.get(id).grupoFamiliarId));
      const hs = r.layout.nodos.filter(n => grupos.has(n.grupoFamiliarId));
      const min = Math.min(...hs.map(n => n.x)), max = Math.max(...hs.map(n => n.x));
      assert.ok(r.layout.nodos.filter(n => n.generacion === hs[0].generacion && n.x >= min && n.x <= max)
        .every(n => grupos.has(n.grupoFamiliarId)), "no intercalar otra familia al ampliar una rama");
    }
    assert.deepEqual(r.geometria.solapamientos, []);
  }
});

test("la jerarquía visual conserva exactamente los mismos tramos y puertos", () => {
  const r = comprobarArbol(datosReales());
  for(const {trazo} of r.trazos) {
    const partes = trazo.partes.flatMap(p=>p.d.split(/ (?=M)/)).sort();
    assert.deepEqual(partes,trazo.d.split(/ (?=M)/).sort());
    assert.ok(trazo.partes.every(p=>["union","descendencia","hermanos"].includes(p.papel)));
  }
});
test("una pareja con uno o varios hijos genera una sola unión familiar", () => {
  const unHijo = [
    persona("progenitor-a", { hijos: ["hijo"], conyuges: ["progenitor-b"] }),
    persona("progenitor-b", { hijos: ["hijo"], conyuges: ["progenitor-a"] }),
    persona("hijo", { padres: ["progenitor-a", "progenitor-b"] }),
  ];
  const variosHijos = [
    persona("progenitor-a", { hijos: ["hijo-1", "hijo-2", "hijo-3"], conyuges: ["progenitor-b"] }),
    persona("progenitor-b", { hijos: ["hijo-1", "hijo-2", "hijo-3"], conyuges: ["progenitor-a"] }),
    persona("hijo-1", { padres: ["progenitor-a", "progenitor-b"] }),
    persona("hijo-2", { padres: ["progenitor-a", "progenitor-b"] }),
    persona("hijo-3", { padres: ["progenitor-a", "progenitor-b"] }),
  ];

  assert.deepEqual(unionesFamiliares(unHijo), [{
    id: "union-familiar:progenitor-a:progenitor-b",
    tipo: "union-familiar",
    familiaId: "progenitor-a:progenitor-b",
    progenitoresIds: ["progenitor-a", "progenitor-b"],
    hijosIds: ["hijo"],
  }]);
  assert.deepEqual(unionesFamiliares(variosHijos)[0]?.hijosIds, ["hijo-1", "hijo-2", "hijo-3"]);
  assert.equal(unionesFamiliares(variosHijos).length, 1);

  const trazo = crearTrazoVinculoArbol(unionesFamiliares(unHijo)[0], [
    { data: { id: "progenitor-a", data: {} }, x: -108, y: 0 },
    { data: { id: "progenitor-b", data: {} }, x: 108, y: 0 },
    { data: { id: "hijo", data: {} }, x: 0, y: 148 },
  ]);
  assert.equal(trazo?.modo, "bus");
  assert.equal(trazo?.degradado, false);
  assert.equal(trazo?.d.includes(" H"), true);
});


test("un único progenitor consolida todos sus hijos bajo una sola unión", () => {
  const personas = [
    persona("progenitor", { hijos: ["hijo-1", "hijo-2"] }),
    persona("hijo-1", { padres: ["progenitor"] }),
    persona("hijo-2", { padres: ["progenitor"] }),
  ];

  assert.deepEqual(unionesFamiliares(personas), [{
    id: "union-familiar:progenitor",
    tipo: "union-familiar",
    familiaId: "progenitor",
    progenitoresIds: ["progenitor"],
    hijosIds: ["hijo-1", "hijo-2"],
  }]);
});


test("dos uniones de una persona mantienen separados sus respectivos hijos", () => {
  const personas = [
    persona("progenitor", { hijos: ["hijo-a", "hijo-b"], conyuges: ["pareja-a", "pareja-b"] }),
    persona("pareja-a", { hijos: ["hijo-a"], conyuges: ["progenitor"] }),
    persona("pareja-b", { hijos: ["hijo-b"], conyuges: ["progenitor"] }),
    persona("hijo-a", { padres: ["progenitor", "pareja-a"] }),
    persona("hijo-b", { padres: ["progenitor", "pareja-b"] }),
  ];
  const uniones = unionesFamiliares(personas);

  assert.equal(uniones.length, 2);
  assert.deepEqual(new Set(uniones.map(({ progenitoresIds, hijosIds }) => `${progenitoresIds.join("+")}=>${hijosIds.join("+")}`)), new Set([
    "pareja-a+progenitor=>hijo-a",
    "pareja-b+progenitor=>hijo-b",
  ]));
});


test("la unión parental existe aunque los progenitores no tengan vínculo conyugal", () => {
  const personas = [
    persona("progenitor-a", { hijos: ["hijo"] }),
    persona("progenitor-b", { hijos: ["hijo"] }),
    persona("hijo", { padres: ["progenitor-a", "progenitor-b"] }),
  ];
  const vinculos = crearVinculosVisualesArbol(crearModeloArbol(personas));

  assert.equal(vinculos.filter(({ tipo }) => tipo === "union-familiar").length, 1);
  assert.equal(vinculos.filter(({ tipo }) => tipo === "conyugal").length, 0);
});


test("hermanos completos y medios hermanos se agrupan por sus progenitores reales", () => {
  const personas = [
    persona("progenitor", { hijos: ["completo-1", "completo-2", "medio"] }),
    persona("pareja-a", { hijos: ["completo-1", "completo-2"] }),
    persona("pareja-b", { hijos: ["medio"] }),
    persona("completo-1", { padres: ["progenitor", "pareja-a"] }),
    persona("completo-2", { padres: ["progenitor", "pareja-a"] }),
    persona("medio", { padres: ["progenitor", "pareja-b"] }),
  ];
  const grupos = unionesFamiliares(personas).map(({ progenitoresIds, hijosIds }) => ({ progenitoresIds, hijosIds }));

  assert.deepEqual(grupos, [
    { progenitoresIds: ["pareja-a", "progenitor"], hijosIds: ["completo-1", "completo-2"] },
    { progenitoresIds: ["pareja-b", "progenitor"], hijosIds: ["medio"] },
  ]);
});


test("una unión conserva un bus sólido aunque otras tarjetas separen visualmente a sus hijos", () => {
  const vinculo = {
    id: "union-familiar:progenitor",
    tipo: "union-familiar",
    familiaId: "progenitor",
    progenitoresIds: ["progenitor"],
    hijosIds: ["hijo-1", "hijo-2"],
  };
  const nodos = [
    { data: { id: "progenitor", data: {} }, x: 0, y: 0 },
    { data: { id: "hijo-1", data: {} }, x: -216, y: 148 },
    { data: { id: "medio-intercalado", data: {} }, x: 0, y: 148 },
    { data: { id: "hijo-2", data: {} }, x: 216, y: 148 },
  ];
  const resultado = crearTrazoVinculoArbol(vinculo, nodos);

  assert.equal(resultado?.modo, "bus");
  assert.equal(resultado?.degradado, false);
  assert.ok(resultado?.segmentos.some(s => s.papel === "hermanos" && s.inicio.y === s.fin.y
    && Math.abs(s.inicio.x - s.fin.x) >= 432), "la filiación debe mantener una barra común continua aunque sus codos sean curvas");
  assert.equal(resultado?.d.includes(" C"), false, "no debe convertir relaciones confirmadas en curvas degradadas");
});


test("una pareja parental no adyacente se conecta por debajo de las tarjetas interpuestas", () => {
  const vinculo = {
    id: "union-familiar:padre-a:padre-b",
    tipo: "union-familiar",
    familiaId: "padre-a:padre-b",
    progenitoresIds: ["padre-a", "padre-b"],
    hijosIds: ["hijo"],
  };
  const resultado = crearTrazoVinculoArbol(vinculo, [
    { data: { id: "padre-a", data: {} }, x: -300, y: 0 },
    { data: { id: "tarjeta-interpuesta", data: {} }, x: 0, y: 0 },
    { data: { id: "padre-b", data: {} }, x: 300, y: 0 },
    { data: { id: "hijo", data: {} }, x: 0, y: 148 },
  ]);

  assert.equal(resultado?.modo, "bus");
  assert.equal(resultado?.degradado, false);
  assert.ok(resultado.segmentos.some(s => s.inicio.x === -300 && s.inicio.y === 46));
  assert.ok(resultado.segmentos.some(s => s.inicio.x === 300 && s.inicio.y === 46));
  assert.doesNotMatch(resultado?.d ?? "", /M-212,0 H212/, "la línea no debe atravesar la tarjeta central");
});


test("un vínculo conyugal no adyacente también evita atravesar otra tarjeta", () => {
  const resultado = crearTrazoVinculoArbol({
    id: "conyugal:a:b",
    tipo: "conyugal",
    origenId: "a",
    destinoId: "b",
  }, [
    { data: { id: "a", data: {} }, x: -300, y: 0 },
    { data: { id: "interpuesta", data: {} }, x: 0, y: 0 },
    { data: { id: "b", data: {} }, x: 300, y: 0 },
  ]);

  assert.equal(resultado?.degradado, false);
  assert.deepEqual(resultado.puertos.map(p => p.personaId), ["a", "b"]);
  assert.ok(resultado.segmentos.every(s => s.inicio.y >= 46 && s.fin.y >= 46));
});


test("una fila canónica creada desde Padres o desde Hijos produce la misma reciprocidad funcional", () => {
  const personasBase = [personaPersistida("progenitor", "1920-01-01"), personaPersistida("hijo", "1950-01-01")];
  const filaCreadaDesdePadres = [{ id: "rel-1", padre_id: "progenitor", hijo_id: "hijo" }];
  const filaCreadaDesdeHijos = [{ id: "rel-2", padre_id: "progenitor", hijo_id: "hijo" }];
  const desdePadres = normalizarPersonasArbol(personasBase, filaCreadaDesdePadres, []);
  const desdeHijos = normalizarPersonasArbol(personasBase, filaCreadaDesdeHijos, []);

  assert.deepEqual(desdePadres, desdeHijos);
  assert.deepEqual(desdePadres.find(({ id }) => id === "progenitor")?.hijos_ids, ["hijo"]);
  assert.deepEqual(desdePadres.find(({ id }) => id === "hijo")?.padres_ids, ["progenitor"]);
  assert.deepEqual(calcularLayoutArbol(crearModeloArbol(desdePadres)), calcularLayoutArbol(crearModeloArbol(desdeHijos)));

  const ficha = readFileSync(resolve(raiz, "components/archivo/persona-ficha-client.tsx"), "utf8");
  assert.match(ficha, /agregarFiliacion\(\{\s*padre_id:\s*padreElegido,\s*hijo_id:\s*persona\.id\s*\}\)/);
  assert.match(ficha, /agregarFiliacion\(\{\s*padre_id:\s*persona\.id,\s*hijo_id:\s*hijoElegido\s*\}\)/);
});


test("la lectura paginada no descarta filas de relaciones", async () => {
  const filas = Array.from({ length: 1003 }, (_, indice) => ({ id: `fila-${indice}` }));
  const rangos = [];
  const resultado = await obtenerTodasLasFilas(async (desde, hasta) => {
    rangos.push([desde, hasta]);
    return { data: filas.slice(desde, hasta + 1), error: null };
  });

  assert.equal(resultado.error, null);
  assert.equal(resultado.data.length, filas.length);
  assert.deepEqual(rangos, [[0, 999], [1000, 1999]]);
});


test("las filas relacionales inconsistentes se informan antes de normalizarse", () => {
  const personasBase = [personaPersistida("a"), personaPersistida("b")];
  const filiaciones = [
    { id: "f-1", padre_id: "a", hijo_id: "b" },
    { id: "f-2", padre_id: "a", hijo_id: "b" },
    { id: "f-3", padre_id: "a", hijo_id: "ausente" },
  ];
  const conyuges = [{ id: "c-1", persona1_id: "a", persona2_id: "a" }];
  const problemas = diagnosticarFilasArbol(personasBase, filiaciones, conyuges);

  assert.deepEqual(new Set(problemas.map(({ codigo }) => codigo)), new Set([
    "filiacion-duplicada",
    "referencia-ausente-filiacion",
    "auto-referencia-conyuge",
  ]));
  assert.throws(
    () => normalizarPersonasArbol(personasBase, filiaciones, conyuges),
    /filas inconsistentes/,
    "la normalización no debe descartar ni corregir relaciones silenciosamente",
  );
});


test("los ciclos existentes se diagnostican y un alta que cerraría un ciclo se bloquea", async () => {
  const personasConCiclo = [
    persona("a", { padres: ["c"], hijos: ["b"] }),
    persona("b", { padres: ["a"], hijos: ["c"] }),
    persona("c", { padres: ["b"], hijos: ["a"] }),
  ];
  const diagnostico = diagnosticarModeloArbol(personasConCiclo);
  assert.throws(() => calcularLayoutArbol(crearModeloArbol(personasConCiclo)), /inconsistentes/);

  assert.equal(diagnostico.errores.filter(({ codigo }) => codigo === "ciclo-filiacion").length, 1);



  let inserto = false;
  const padresPorHijo = new Map([["c", ["b"]], ["b", ["a"]]]);
  const { agregarFiliacion } = cargarModulo("lib/relaciones-actions.ts", {
    "next/cache": { revalidatePath: () => {} },
    "@/lib/supabase/server": {
      createClient: async () => ({
        from: () => ({
          select: (_columnas, opciones) => opciones?.head
            ? { eq: async () => ({ count: 0, error: null }) }
            : { in: async (_columna, ids) => ({ data: ids.flatMap((id) => (padresPorHijo.get(id) ?? []).map((padre_id) => ({ padre_id }))), error: null }) },
          insert: async () => { inserto = true; return { error: null }; },
        }),
      }),
    },
    "@/lib/relaciones": {},
  });
  const resultado = await agregarFiliacion({ padre_id: "c", hijo_id: "a" });
  assert.match(resultado.error, /ciclo/i);
  assert.equal(inserto, false);
});


test("al desvincular o borrar se recalculan las raíces sin perder el resto del componente", async () => {
  const conFiliacion = [
    persona("a", { hijos: ["b"], nacimiento: "1900-01-01" }),
    persona("b", { padres: ["a"], hijos: ["c"], nacimiento: "1930-01-01" }),
    persona("c", { padres: ["b"], hijos: ["d"], nacimiento: "1960-01-01" }),
    persona("d", { padres: ["c"], nacimiento: "1990-01-01" }),
  ];

  assert.deepEqual(componente(crearModeloArbol(conFiliacion), "a").raicesAncestrales, ["a"]);

  let seIntentoBorrarEnBase = false;
  const { eliminarPersona } = cargarModulo("lib/personas-actions.ts", {
    "next/cache": { revalidatePath: () => {} },
    "@/lib/supabase/server": { createClient: async () => ({ from: () => ({ delete: () => { seIntentoBorrarEnBase = true; } }) }) },
    "@/lib/integridad-referencial": {
      personaTieneVinculos: async () => ({ tieneVinculos: true, detalle: ["padres, hijos o cónyuges"] }),
    },
  });
  const bloqueo = await eliminarPersona("a");
  assert.match(bloqueo.error, /No se puede eliminar/);
  assert.equal(seIntentoBorrarEnBase, false, "no debe ejecutarse el delete mientras A conserva la filiación con B");

  // La ficha convierte el bloqueo en un aviso que permite confirmar el
  // segundo paso de eliminación forzada de manera explícita.
  const ficha = readFileSync(resolve(raiz, "components/archivo/persona-ficha-client.tsx"), "utf8");
  assert.match(ficha, /tarea:\s*\(\)\s*=>\s*eliminarPersona\(persona\.id\)/);
  assert.match(ficha, /permiteEliminacionForzada:\s*true/);
  assert.match(ficha, /eliminarPersonaForzada\(persona\.id\)/);
  assert.match(ficha, /onActualizarFicha\?\.\(\)/);

  const sinFiliacionAB = [
    persona("a", { nacimiento: "1900-01-01" }),
    persona("b", { hijos: ["c"], nacimiento: "1930-01-01" }),
    persona("c", { padres: ["b"], hijos: ["d"], nacimiento: "1960-01-01" }),
    persona("d", { padres: ["c"], nacimiento: "1990-01-01" }),
  ];
  const modeloSinFiliacionAB = crearModeloArbol(sinFiliacionAB);
  const componenteB = componente(modeloSinFiliacionAB, "b");
  assert.deepEqual(componenteB.raicesAncestrales, ["b"]);
  assert.deepEqual(new Set(componenteB.ids), new Set(["b", "c", "d"]));
  const renderizadosSinFiliacion = idsRenderizados(sinFiliacionAB);
  assert.equal(new Set(renderizadosSinFiliacion).size, sinFiliacionAB.length, "no debe haber tarjetas duplicadas");
  assert.deepEqual(new Set(renderizadosSinFiliacion), new Set(sinFiliacionAB.map(({ id }) => id)), "no debe perderse nadie al recalcular las anclas");

  const sinA = sinFiliacionAB.filter(({ id }) => id !== "a");
  const modeloSinA = crearModeloArbol(sinA);
  assert.equal(modeloSinA.componentes.length, 1);
  assert.deepEqual(modeloSinA.componentes[0].raicesAncestrales, ["b"]);
  const renderizadosSinA = idsRenderizados(sinA);
  assert.equal(new Set(renderizadosSinA).size, sinA.length, "no debe haber tarjetas duplicadas tras borrar A");
  assert.deepEqual(new Set(renderizadosSinA), new Set(sinA.map(({ id }) => id)), "el resto del componente debe seguir completo tras borrar A");
});


test("la eliminación forzada usa la operación transaccional y sólo limpia archivos de documentos huérfanos", async () => {
  let llamadaRpc = null;
  let rutasEliminadas = [];
  const { eliminarPersonaForzada } = cargarModulo("lib/personas-actions.ts", {
    "next/cache": { revalidatePath: () => {} },
    "@/lib/supabase/server": {
      createClient: async () => ({
        rpc: async (nombre, parametros) => {
          llamadaRpc = { nombre, parametros };
          return { data: [{ archivo_url: "solo-de-esta-persona.pdf" }, { archivo_url: null }], error: null };
        },
        storage: {
          from: (bucket) => ({
            remove: async (rutas) => {
              assert.equal(bucket, "documentos");
              rutasEliminadas = rutas;
              return { error: null };
            },
          }),
        },
      }),
    },
    "@/lib/integridad-referencial": { personaTieneVinculos: async () => ({ tieneVinculos: false, detalle: [], dependencias: {} }) },
  });

  assert.deepEqual(await eliminarPersonaForzada("persona-a"), { error: null });
  assert.deepEqual(llamadaRpc, { nombre: "eliminar_persona_forzada", parametros: { persona_uuid: "persona-a" } });
  assert.deepEqual(rutasEliminadas, ["solo-de-esta-persona.pdf"]);

  const migracion = readFileSync(resolve(raiz, "supabase/migrations/0004_eliminacion_forzada_persona.sql"), "utf8");
  assert.match(migracion, /delete from personas where id = persona_uuid/i);
  assert.match(migracion, /not exists\s*\(\s*select 1\s*from documento_persona/i);
  assert.match(migracion, /returning documento\.archivo_url/i);
});


test("la importación del Excel inserta sólo personas propuestas y no crea relaciones", async () => {
  const tablasConsultadas = [];
  let personasInsertadas = [];
  const revision = require(resolve(raiz, "Referencias/importacion-arbol-genealogico-revision.json"));
  const { importarPersonasDesdeExcel } = cargarModulo("lib/importacion-excel-actions.ts", {
    "next/cache": { revalidatePath: () => {} },
    "@/Referencias/importacion-arbol-genealogico-revision.json": { default: revision },
    "@/lib/supabase/server": {
      createClient: async () => ({
        from: (tabla) => {
          tablasConsultadas.push(tabla);
          assert.equal(tabla, "personas", "la importación no debe tocar tablas de vínculos, documentos ni Bitácora");
          return {
            select: () => ({ data: [], error: null }),
            insert: (filas) => {
              personasInsertadas = filas;
              return { select: () => ({ data: filas.map((_, indice) => ({ id: `nueva-${indice}` })), error: null }) };
            },
          };
        },
      }),
    },
  });

  const resultado = await importarPersonasDesdeExcel();
  assert.deepEqual(resultado, { error: null, importadas: 50, existentes: 2, conflictos: [] });
  assert.equal(personasInsertadas.length, 50);
  assert.deepEqual(new Set(tablasConsultadas), new Set(["personas"]));
  assert.equal(personasInsertadas.every((persona) => persona.genero === "no_definido"), true);
});


test("el layout propio centra la pareja sobre sus hijos y reserva cada subárbol", () => {
  const personas = [
    persona("padre", { hijos: ["hija-mayor", "hijo-menor"], conyuges: ["madre"], nacimiento: "1940-01-01" }),
    persona("madre", { hijos: ["hija-mayor", "hijo-menor"], conyuges: ["padre"], nacimiento: "1942-01-01" }),
    persona("hija-mayor", { padres: ["padre", "madre"], nacimiento: "1970-01-01" }),
    persona("hijo-menor", { padres: ["padre", "madre"], nacimiento: "1974-01-01" }),
  ];
  const modelo = crearModeloArbol(personas);
  const layout = calcularLayoutArbol(modelo);
  const padre = layout.posiciones.get("padre");
  const madre = layout.posiciones.get("madre");
  const hija = layout.posiciones.get("hija-mayor");
  const hijo = layout.posiciones.get("hijo-menor");

  assert.ok(padre && madre && hija && hijo);
  assert.equal(padre.y, madre.y, "la pareja debe compartir nivel generacional");
  assert.equal(hija.y, hijo.y, "los hermanos deben compartir nivel generacional");
  assert.equal(hija.y - padre.y, GEOMETRIA_ARBOL.separacionVertical);
  assert.equal((padre.x + madre.x) / 2, (hija.x + hijo.x) / 2, "la unidad parental debe quedar centrada sobre la descendencia");
  assert.ok(Math.abs(hijo.x - hija.x) >= GEOMETRIA_ARBOL.anchoNodo + GEOMETRIA_ARBOL.separacionEntreHermanos);
  assert.deepEqual(diagnosticarLayoutArbol(modelo, layout), {
    cantidadPersonas: personas.length,
    cantidadPosicionadas: personas.length,
    faltantes: [],
    desconocidos: [],
    solapamientos: [],
    filiacionesNoDescendentes: [],
    conyugesEnFilasDistintas: [],
    familiasConHijosEnFilasDistintas: [],
  });
});


test("matrimonios sucesivos permanecen juntos y separan los hijos de cada unión", () => {
  const personas = [
    persona("progenitor", { hijos: ["hijo-a", "hijo-b", "hijo-c"], conyuges: ["pareja-a", "pareja-b", "pareja-c"], nacimiento: "1940-01-01" }),
    persona("pareja-a", { hijos: ["hijo-a"], conyuges: ["progenitor"], nacimiento: "1941-01-01" }),
    persona("pareja-b", { hijos: ["hijo-b"], conyuges: ["progenitor"], nacimiento: "1942-01-01" }),
    persona("pareja-c", { hijos: ["hijo-c"], conyuges: ["progenitor"], nacimiento: "1943-01-01" }),
    persona("hijo-a", { padres: ["progenitor", "pareja-a"], nacimiento: "1965-01-01" }),
    persona("hijo-b", { padres: ["progenitor", "pareja-b"], nacimiento: "1970-01-01" }),
    persona("hijo-c", { padres: ["progenitor", "pareja-c"], nacimiento: "1975-01-01" }),
  ];
  const layout = calcularLayoutArbol(crearModeloArbol(personas));
  const parejas = ["progenitor", "pareja-a", "pareja-b", "pareja-c"].map((id) => layout.posiciones.get(id));
  const hijos = ["hijo-a", "hijo-b", "hijo-c"].map((id) => layout.posiciones.get(id));

  assert.equal(new Set(parejas.map((posicion) => posicion?.grupoFamiliarId)).size, 1);
  assert.equal(new Set(parejas.map((posicion) => posicion?.y)).size, 1);
  const hijosOrdenados = hijos.filter(Boolean).sort((a, b) => a.x - b.x);
  for (let indice = 1; indice < hijosOrdenados.length; indice += 1) {
    assert.ok(
      hijosOrdenados[indice].x - hijosOrdenados[indice - 1].x >= GEOMETRIA_ARBOL.anchoNodo + GEOMETRIA_ARBOL.separacionUnidadesFamiliares - 0.001,
      "cada unión debe reservar una rama horizontal independiente",
    );
  }
});


test("la auditoría visual cubre parejas, progenitor único, múltiples cónyuges y medio hermanos sin duplicar", () => {
  const personas = [
    persona("progenitor", { hijos: ["completo-1", "completo-2", "medio"], conyuges: ["pareja-a", "pareja-b"], nacimiento: "1940-01-01" }),
    persona("pareja-a", { hijos: ["completo-1", "completo-2"], conyuges: ["progenitor"], nacimiento: "1942-01-01" }),
    persona("pareja-b", { hijos: ["medio"], conyuges: ["progenitor"], nacimiento: "1944-01-01" }),
    persona("completo-1", { padres: ["progenitor", "pareja-a"], nacimiento: "1965-01-01" }),
    persona("completo-2", { padres: ["progenitor", "pareja-a"], nacimiento: "1968-01-01" }),
    persona("medio", { padres: ["progenitor", "pareja-b"], nacimiento: "1972-01-01" }),
    persona("progenitor-unico", { hijos: ["hijo-unico"], nacimiento: "1945-01-01" }),
    persona("hijo-unico", { padres: ["progenitor-unico"], nacimiento: "1975-01-01" }),
    persona("coprogenitor-a", { hijos: ["hijo-coparental"], nacimiento: "1946-01-01" }),
    persona("coprogenitor-b", { hijos: ["hijo-coparental"], nacimiento: "1947-01-01" }),
    persona("hijo-coparental", { padres: ["coprogenitor-a", "coprogenitor-b"], nacimiento: "1976-01-01" }),
  ];
  const modelo = crearModeloArbol(personas);
  const layout = calcularLayoutArbol(modelo);
  const nodos = layout.nodos.map((nodo) => ({ data: { id: nodo.id, data: {} }, x: nodo.x, y: nodo.y }));
  const vinculos = crearVinculosVisualesArbol(modelo);
  const diagnostico = diagnosticarVinculosVisualesArbol(modelo, vinculos, nodos);
  const trazos = vinculos.map((vinculo) => crearTrazoVinculoArbol(vinculo, nodos));

  assert.equal(vinculos.filter(({ tipo }) => tipo === "union-familiar").length, 4);
  assert.equal(vinculos.filter(({ tipo }) => tipo === "conyugal").length, 0, "las parejas con hijos ya están integradas en su unidad parental");
  assert.equal(diagnostico.filiacionesEsperadas, 9);
  assert.equal(diagnostico.filiacionesRepresentadas, 9);
  assert.equal(diagnostico.vinculosConyugalesEsperados, 2);
  assert.equal(diagnostico.vinculosConyugalesRepresentados, 2);
  assert.deepEqual(diagnostico.filiacionesFaltantes, []);
  assert.deepEqual(diagnostico.filiacionesDuplicadas, []);
  assert.deepEqual(diagnostico.vinculosConyugalesFaltantes, []);
  assert.deepEqual(diagnostico.vinculosConyugalesDuplicados, []);
  assert.deepEqual(diagnostico.personasVinculadasSinRepresentacion, []);
  assert.deepEqual(diagnostico.idsVisualesDuplicados, []);
  assert.deepEqual(diagnostico.vinculosSinTrazo, []);
  assert.equal(trazos.every((trazo) => trazo?.modo === "bus" && trazo.degradado === false), true);
  assert.equal(layout.posiciones.size, personas.length, "cada persona conserva una sola tarjeta");

  const familias = vinculos.filter(({ tipo }) => tipo === "union-familiar");
  assert.deepEqual(
    new Set(familias.map(({ progenitoresIds, hijosIds }) => `${[...progenitoresIds].sort().join("+")}=>${[...hijosIds].sort().join("+")}`)),
    new Set([
      "coprogenitor-a+coprogenitor-b=>hijo-coparental",
      "pareja-a+progenitor=>completo-1+completo-2",
      "pareja-b+progenitor=>medio",
      "progenitor-unico=>hijo-unico",
    ]),
  );
});


test("una coparentalidad entre ramas de distinta profundidad no colapsa progenitores e hijos en la misma fila", () => {
  const personas = [
    persona("ancestro", { hijos: ["descendiente", "hija-coparental"], nacimiento: "1800-01-01" }),
    persona("descendiente", { padres: ["ancestro"], conyuges: ["coprogenitora"], nacimiento: "1830-01-01" }),
    persona("coprogenitora", { hijos: ["hija-coparental"], conyuges: ["descendiente"], nacimiento: "1832-01-01" }),
    persona("hija-coparental", { padres: ["ancestro", "coprogenitora"], nacimiento: "1860-01-01" }),
  ];
  const modelo = crearModeloArbol(personas);
  const layout = calcularLayoutArbol(modelo);
  const diagnosticoLayout = diagnosticarLayoutArbol(modelo, layout);
  const nodos = layout.nodos.map((nodo) => ({ data: { id: nodo.id, data: {} }, x: nodo.x, y: nodo.y }));
  const vinculos = crearVinculosVisualesArbol(modelo);
  const diagnostico = diagnosticarVinculosVisualesArbol(modelo, vinculos, nodos);
  const familiaCruzada = vinculos.find((vinculo) =>
    vinculo.tipo === "union-familiar" && vinculo.hijosIds.includes("hija-coparental"));

  assert.ok(familiaCruzada && familiaCruzada.tipo === "union-familiar");
  assert.ok(layout.posiciones.get("ancestro").y < layout.posiciones.get("coprogenitora").y);
  assert.equal(layout.posiciones.get("descendiente").y, layout.posiciones.get("coprogenitora").y);
  assert.ok(layout.posiciones.get("coprogenitora").y < layout.posiciones.get("hija-coparental").y);
  assert.deepEqual(diagnosticoLayout.filiacionesNoDescendentes, []);
  assert.deepEqual(diagnosticoLayout.conyugesEnFilasDistintas, []);
  assert.deepEqual(diagnosticoLayout.familiasConHijosEnFilasDistintas, []);
  assert.equal(crearTrazoVinculoArbol(familiaCruzada, nodos)?.modo, "bus");
  assert.deepEqual(diagnostico.filiacionesFaltantes, []);
  assert.deepEqual(diagnostico.vinculosConyugalesFaltantes, []);
  assert.deepEqual(diagnostico.personasVinculadasSinRepresentacion, []);
  assert.deepEqual(diagnostico.vinculosSinTrazo, []);
});


test("los hermanos no se separan de generación por diferencias de fecha y las ramas pueden comenzar a distinta altura", () => {
  const personas = [
    persona("raiz-antigua", { hijos: ["hermano-mayor", "hermano-menor"], nacimiento: "1870-01-01" }),
    persona("hermano-mayor", { padres: ["raiz-antigua"], nacimiento: "1900-01-01" }),
    persona("hermano-menor", { padres: ["raiz-antigua"], nacimiento: "1958-01-01" }),
    persona("raiz-tardia", { nacimiento: "1960-01-01" }),
  ];
  const layout = calcularLayoutArbol(crearModeloArbol(personas));

  assert.equal(layout.posiciones.get("hermano-mayor")?.y, layout.posiciones.get("hermano-menor")?.y);
  assert.equal(
    layout.posiciones.get("hermano-mayor")?.y - layout.posiciones.get("raiz-antigua")?.y,
    GEOMETRIA_ARBOL.separacionVertical,
  );
  assert.ok(
    layout.posiciones.get("raiz-tardia").y > layout.posiciones.get("raiz-antigua").y,
    "una rama raíz independiente puede empezar más abajo sin separar hermanos",
  );
});


test("los estilos del árbol no convierten relaciones confirmadas en líneas punteadas", () => {
  const estilos = readFileSync(resolve(raiz, "app/globals.css"), "utf8");
  assert.doesNotMatch(estilos, /arbol-vinculo[^\n{]*\{[^}]*stroke-dasharray/s);
  assert.doesNotMatch(estilos, /data-vinculo-modo=["']individual["']/);
});


test("una rama corta se alinea por generación con el cónyuge de una rama larga", () => {
  const personas = [
    persona("raiz-larga", { hijos: ["segunda-generacion"], nacimiento: "1900-01-01" }),
    persona("segunda-generacion", { padres: ["raiz-larga"], hijos: ["persona-profunda"], nacimiento: "1930-01-01" }),
    persona("persona-profunda", { padres: ["segunda-generacion"], conyuges: ["raiz-corta"], nacimiento: "1960-01-01" }),
    persona("raiz-corta", { conyuges: ["persona-profunda"], nacimiento: "1962-01-01" }),
  ];
  const layout = calcularLayoutArbol(crearModeloArbol(personas));

  assert.equal(layout.posiciones.get("persona-profunda")?.y, layout.posiciones.get("raiz-corta")?.y);
  assert.equal(
    layout.posiciones.get("persona-profunda")?.y - layout.posiciones.get("raiz-larga")?.y,
    GEOMETRIA_ARBOL.separacionVertical * 2,
  );
});


test("componentes distintos conservan un margen explícito y la fecha desplaza nodos aislados", () => {
  const personas = [
    persona("familia-a", { hijos: ["hija-a"], nacimiento: "1900-01-01" }),
    persona("hija-a", { padres: ["familia-a"], nacimiento: "1930-01-01" }),
    persona("familia-b", { hijos: ["hija-b"], nacimiento: "1905-01-01" }),
    persona("hija-b", { padres: ["familia-b"], nacimiento: "1935-01-01" }),
    persona("persona-aislada", { nacimiento: "1985-01-01" }),
  ];
  const modelo = crearModeloArbol(personas);
  const layout = calcularLayoutArbol(modelo);
  const limitesPorComponente = modelo.componentes.map((_componente, componenteIndice) => {
    const nodos = layout.nodos.filter((nodo) => nodo.componenteIndice === componenteIndice);
    return {
      min: Math.min(...nodos.map((nodo) => nodo.x - GEOMETRIA_ARBOL.anchoNodo / 2)),
      max: Math.max(...nodos.map((nodo) => nodo.x + GEOMETRIA_ARBOL.anchoNodo / 2)),
    };
  });
  for (let indice = 1; indice < limitesPorComponente.length; indice += 1) {
    assert.ok(
      limitesPorComponente[indice].min - limitesPorComponente[indice - 1].max >= GEOMETRIA_ARBOL.separacionComponentes,
      "los componentes no deben compactarse como si fueran hermanos",
    );
  }
  assert.ok(layout.posiciones.get("persona-aislada").y > layout.posiciones.get("hija-a").y);
});


test("el layout propio es determinista y posiciona una sola vez a cada persona", () => {
  const personas = [
    persona("raiz-a", { hijos: ["a"], nacimiento: "1900-01-01" }),
    persona("a", { padres: ["raiz-a"], conyuges: ["b"], nacimiento: "1930-01-01" }),
    persona("raiz-b", { hijos: ["b"], nacimiento: "1901-01-01" }),
    persona("b", { padres: ["raiz-b"], conyuges: ["a"], nacimiento: "1931-01-01" }),
  ];
  const modelo = crearModeloArbol(personas);
  const primera = calcularLayoutArbol(modelo);
  const segunda = calcularLayoutArbol(crearModeloArbol(structuredClone(personas)));

  assert.deepEqual(primera.nodos, segunda.nodos);
  assert.equal(primera.posiciones.size, personas.length);
  assert.deepEqual(new Set(primera.nodos.map(({ id }) => id)), new Set(personas.map(({ id }) => id)));
  assert.deepEqual(diagnosticarLayoutArbol(modelo, primera).solapamientos, []);
});
