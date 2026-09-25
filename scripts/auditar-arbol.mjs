import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cargarTypescript } from "./cargar-typescript.mjs";

const arbol = cargarTypescript(process.env.ARBOL_MODULO ?? "lib/arbol-chart.ts");
const archivoDatos = process.env.ARBOL_DATOS ?? "Referencias/revision-layout/personas-revision-final.json";
const personas = JSON.parse(readFileSync(archivoDatos, "utf8"));
const modelo = arbol.crearModeloArbol(personas);
const layout = arbol.calcularLayoutArbol(modelo);
const nodos = layout.nodos.map(n => ({ data: { id: n.id }, x: n.x, y: n.y }));
const vinculos = arbol.crearVinculosVisualesArbol(modelo);
const trazos = layout.trazos ?? vinculos.map(v => ({ vinculo: v, trazo: arbol.crearTrazoVinculoArbol(v, nodos) }));
const distancias = modelo.familias.flatMap(f => f.hijos.map(id => {
  const centro = f.progenitores.reduce((n, p) => n + layout.posiciones.get(p).x, 0) / f.progenitores.length;
  return Math.abs(layout.posiciones.get(id).x - centro);
}));
const informe = {
  fuente: archivoDatos,
  modelo: arbol.diagnosticarModeloArbol(personas),
  layout: arbol.diagnosticarLayoutArbol(modelo, layout),
  advertencias: layout.advertencias ?? [],
  relaciones: arbol.diagnosticarVinculosVisualesArbol(modelo, vinculos, nodos),
  geometria: arbol.diagnosticarGeometriaArbol?.(trazos, nodos),
  medidas: { ancho: layout.ancho, alto: layout.alto, distanciaHorizontalMedia: distancias.reduce((a,b)=>a+b,0)/Math.max(1,distancias.length), distanciaHorizontalMaxima: Math.max(0,...distancias) },
  grupos: modelo.familias.map(f => {
    const hijos = f.hijos.map(id => layout.posiciones.get(id));
    const xs = hijos.map(n => n.x);
    const centroPadres = f.progenitores.reduce((s, id) => s + layout.posiciones.get(id).x, 0) / f.progenitores.length;
    return { progenitores: f.progenitores.map(id => modelo.personas.get(id).nombre),
      hijos: hijos.map(n => ({ nombre: modelo.personas.get(n.id).nombre, apellido: modelo.personas.get(n.id).apellido, x: n.x, y: n.y })),
      ancho: Math.max(...xs) - Math.min(...xs) + arbol.GEOMETRIA_ARBOL.anchoNodo,
      desvioCentro: Math.abs((Math.min(...xs) + Math.max(...xs)) / 2 - centroPadres) };
  }),
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
const lineas = trazos.map(({trazo})=>trazo?(trazo.partes??[{d:trazo.d,papel:"descendencia"}]).map(p=>`<path d="${p.d}" fill="none" stroke="${p.papel==="union"?"#49355f":"#836d6e"}" opacity="0.82" stroke-linecap="round" stroke-linejoin="round" stroke-width="${1.9 * (p.papel === "union" ? 1.2 : ({tronco:1.25,rama:1.06,terminal:0.92}[p.jerarquia] ?? 1.05))}"/>`).join(""):"").join("");
const marcos = (arbol.crearMarcosParejaArbol?.(modelo,layout)??[]).map(m=>`<rect x="${m.x}" y="${m.y}" width="${m.ancho}" height="${m.alto}" rx="19" fill="#e9e4f1" fill-opacity="0.5" stroke="#49355f" stroke-opacity="${m.ramaNumerosa?0.3:0.14}"/>`).join("");
writeFileSync(resolve(carpeta, `${nombre}.svg`), `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.ancho}" height="${layout.alto}" viewBox="0 0 ${layout.ancho} ${layout.alto}" style="background:#fbf8fc;font-family:Arial">${marcos}${lineas}${tarjetas}</svg>`);
console.log(JSON.stringify({ medidas: informe.medidas, layout: informe.layout, geometria: informe.geometria }, null, 2));
