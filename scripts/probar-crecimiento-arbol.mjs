import { readFileSync, writeFileSync } from 'node:fs';
import { cargarTypescript } from './cargar-typescript.mjs';
import { persona } from '../tests/casos-arbol.mjs';
const a = cargarTypescript('lib/arbol-chart.ts');
const base = JSON.parse(readFileSync('Referencias/revision-layout/personas-revision-final.json', 'utf8'));
const padre = base.find(p => p.nombre === 'Juan Valentín');
const hermanos = base.filter(p => p.padres_ids.includes(padre.id));
for (const indices of [[], [0], [0, 1], [2, 7], [4, 9]]) {
  const ps = structuredClone(base);
  for (const i of indices) ps.push(persona(`nuevo-${i}`, { padres: [hermanos[i].id], nacimiento: '1950-01-01' }));
  const m = a.crearModeloArbol(ps), l = a.calcularLayoutArbol(m);
  const g = a.diagnosticarGeometriaArbol(l.trazos, l.nodos.map(n => ({ data: { id: n.id }, x: n.x, y: n.y })));
  const ids = new Set([...hermanos.map(p => p.id), ...ps.filter(p => p.apellido === 'Podrecca' && ['Bruno', 'Esther Iris'].includes(p.nombre)).map(p => p.id)]);
  console.log(JSON.stringify({ indices, geometria: g, fila: l.nodos.filter(n => ids.has(n.id)).sort((a,b)=>a.x-b.x).map(n => ({nombre: m.personas.get(n.id).nombre, x: Math.round(n.x), y: n.y})) }));
  if (indices.join() === '0,1') writeFileSync('Referencias/revision-layout/personas-crecimiento-prueba.json', JSON.stringify(ps, null, 2));
}
