"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { FamiliaFiltroArbol } from "@/lib/arbol-filtro";
import type { ModeloArbol } from "@/lib/arbol-chart";

export function FiltroFamilias({ familias, activas, modelo, onCambiar }: {
  familias: FamiliaFiltroArbol[];
  activas: ReadonlySet<string>;
  modelo: ModeloArbol;
  onCambiar: (ids: Set<string>) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const panelId = useId();
  const contenedor = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const cerrarFuera = (event: PointerEvent) => {
      if (!contenedor.current?.contains(event.target as Node)) setAbierto(false);
    };
    document.addEventListener("pointerdown", cerrarFuera);
    return () => document.removeEventListener("pointerdown", cerrarFuera);
  }, [abierto]);
  return <div ref={contenedor} className="arbol-filtro-familias absolute left-4 top-4 z-20 sm:left-6 sm:top-6"
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setAbierto(false); }}
    onKeyDown={event => { if (event.key === "Escape") { setAbierto(false); boton.current?.focus(); } }}>
    <button ref={boton} type="button" className="arbol-filtro-superficie arbol-control gap-2 rounded-xl border px-3 text-xs font-medium"
      aria-expanded={abierto} aria-controls={panelId} onClick={() => setAbierto(!abierto)}>
      Familias {activas.size < familias.length && <span>{activas.size}/{familias.length}</span>}
      <ChevronDown size={14} className={abierto ? "rotate-180" : ""} />
    </button>
    {abierto && <section id={panelId} aria-label="Familias visibles" className="arbol-filtro-superficie mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-2xl border p-3">
      <div className="mb-2 flex items-center justify-between gap-3 px-1">
        <span className="font-display text-lg text-velvet">Familias</span>
        <div className="flex gap-1 text-xs text-velvet">
          <button type="button" className="min-h-10 rounded-lg px-2 hover:bg-lavender/30 focus-visible:outline-velvet" onClick={() => onCambiar(new Set(familias.map(f => f.id)))}>Todas</button>
          <button type="button" className="min-h-10 rounded-lg px-2 hover:bg-lavender/30 focus-visible:outline-velvet" onClick={() => onCambiar(new Set())}>Ninguna</button>
        </div>
      </div>
      <div className="max-h-[min(55svh,24rem)] space-y-1 overflow-y-auto overscroll-contain">
        {familias.map(familia => <label key={familia.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2 py-2 text-sm text-ink hover:bg-lavender/25">
          <input type="checkbox" checked={activas.has(familia.id)} className="h-4 w-4 shrink-0 accent-[rgb(var(--sakura-plum))]" onChange={event => {
            const siguientes = new Set(activas);
            if (event.target.checked) siguientes.add(familia.id); else siguientes.delete(familia.id);
            onCambiar(siguientes);
          }} />
          <span className="min-w-0 break-words">{familia.nombre}
            <span className="mt-0.5 block text-xs text-ink/55">{familia.raices.map(id => {
              const p = modelo.personas.get(id)!;
              return `${p.nombre} ${p.apellido}`.trim();
            }).join(" · ")}</span>
          </span>
        </label>)}
      </div>
      <p className="mt-2 px-1 text-xs leading-5 text-ink/55">Los descendientes compartidos siguen visibles si alguna de sus familias está activa.</p>
    </section>}
  </div>;
}
