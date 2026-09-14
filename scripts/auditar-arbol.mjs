import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cargarTypescript } from "./cargar-typescript.mjs";
import { datosReales } from "../tests/datos-reales.mjs";

const arbol = cargarTypescript(process.env.ARBOL_MODULO ?? "lib/arbol-chart.ts");
const personas = process.env.ARBOL_DATOS ? JSON.parse(readFileSync(process.env.ARBOL_DATOS, "utf8")) : datosReales();
const modelo = arbol.crearModeloArbol(personas);
const layout = arbol.calcularLayoutArbol(modelo);
const nodos = layout.nodos.map(n => ({ data: { id: n.id }, x: n.x, y: n.y }));
const vinculos = arbol.crearVinculosVisualesArbol(modelo);
const trazos = arbol.crearTrazosVinculosArbol ? arbol.crearTrazosVinculosArbol(vinculos, nodos) : vinculos.map(v => ({ vinculo: v, trazo: arbol.crearTrazoVinculoArbol(v, nodos) }));
const distancias = modelo.familias.flatMap(f => f.hijos.map(id => {
  const centro = f.progenitores.reduce((n, p) => n + layout.posiciones.get(p).x, 0) / f.progenitores.length;
  return Math.abs(layout.posiciones.get(id).x - centro);
}));
const informe = {
  fuente: process.env.ARBOL_DATOS ? "Archivo local indicado en ARBOL_DATOS" : "Foto real existente: diagnostico-family-chart-datos-reales.json (11 personas)",
  modelo: arbol.diagnosticarModeloArbol(personas),
  layout: arbol.diagnosticarLayoutArbol(modelo, layout),
  advertencias: layout.advertencias ?? [],
  relaciones: arbol.diagnosticarVinculosVisualesArbol(modelo, vinculos, nodos),
  geometria: arbol.diagnosticarGeometriaArbol?.(trazos, nodos),
  medidas: { ancho: layout.ancho, alto: layout.alto, distanciaHorizontalMedia: distancias.reduce((a,b)=>a+b,0)/Math.max(1,distancias.length), distanciaHorizontalMaxima: Math.max(0,...distancias) },
};
const carpeta = resolve("Referencias/revision-layout");
mkdirSync(carpeta, { recursive: true });
const nombre = process.argv[2] ?? "actual";
writeFileSync(resolve(carpeta, `${nombre}.json`), JSON.stringify(informe, null, 2));
const escapar = s => String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
const tarjetas = layout.nodos.map(n => {
  const p = modelo.personas.get(n.id);
  return `<g><rect x="${n.x-88}" y="${n.y-46}" width="176" height="92" rx="10" fill="#fff" stroke="#83708d"/><text x="${n.x}" y="${n.y-4}" text-anchor="middle" font-size="13">${escapar(p.nombre)} ${escapar(p.apellido)}</text><text x="${n.x}" y="${n.y+18}" text-anchor="middle" font-size="11" fill="#655a68">${p.fecha_nacimiento?.slice(0,4)??""}</text></g>`;
}).join("");
const lineas = trazos.map(({trazo},i)=>trazo?`<path d="${trazo.d}" fill="none" stroke="${["#75557e","#326b88","#95822b","#b35865","#4c876b"][i%5]}" stroke-width="2"/>`:"").join("");
writeFileSync(resolve(carpeta, `${nombre}.svg`), `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.ancho}" height="${layout.alto}" viewBox="0 0 ${layout.ancho} ${layout.alto}" style="background:#fbf8fc;font-family:Arial">${lineas}${tarjetas}</svg>`);
console.log(JSON.stringify({ medidas: informe.medidas, layout: informe.layout, geometria: informe.geometria }, null, 2));
