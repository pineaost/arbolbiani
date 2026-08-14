"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ChevronDown, ExternalLink, X } from "lucide-react";
import { crearPersona, actualizarPersona } from "@/lib/personas-actions";
import type { Genero, Persona } from "@/lib/supabase/types";

interface PersonaModalProps {
  persona?: Persona;
  onCerrar: () => void;
  onGuardado?: () => void;
}

export function PersonaModal({ persona, onCerrar, onGuardado }: PersonaModalProps) {
  const esEdicion = !!persona;
  const [nombre, setNombre] = useState(persona?.nombre ?? "");
  const [apellido, setApellido] = useState(persona?.apellido ?? "");
  const [genero, setGenero] = useState<Genero>(persona?.genero ?? "no_definido");
  const [fechaNacimiento, setFechaNacimiento] = useState(persona?.fecha_nacimiento ?? "");
  const [lugarNacimiento, setLugarNacimiento] = useState(persona?.lugar_nacimiento ?? "");
  const [fechaFallecimiento, setFechaFallecimiento] = useState(persona?.fecha_fallecimiento ?? "");
  const [lugarFallecimiento, setLugarFallecimiento] = useState(persona?.lugar_fallecimiento ?? "");
  const [notas, setNotas] = useState(persona?.notas ?? "");
  const [detallesAbiertos, setDetallesAbiertos] = useState(esEdicion);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const input = {
      nombre,
      apellido,
      genero,
      fecha_nacimiento: fechaNacimiento || null,
      lugar_nacimiento: lugarNacimiento.trim() || null,
      fecha_fallecimiento: fechaFallecimiento || null,
      lugar_fallecimiento: lugarFallecimiento.trim() || null,
      notas: notas.trim() || null,
    };

    startTransition(async () => {
      const resultado = esEdicion
        ? await actualizarPersona(persona.id, input)
        : await crearPersona(input);

      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      onGuardado?.();
      onCerrar();
    });
  }

  return (
    <div
      className="fixed inset-0 z-20 flex items-end bg-ink/25 p-0 sm:items-center sm:justify-center sm:p-5"
      onClick={onCerrar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="persona-modal-titulo"
        onClick={(event) => event.stopPropagation()}
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-border bg-sakura-paper shadow-sakura-float sm:max-w-xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-5 border-b border-border px-5 py-5 sm:px-6">
          <div>
            <h2 id="persona-modal-titulo" className="font-display text-2xl text-velvet">
              {esEdicion ? "Editar persona" : "Nueva persona"}
            </h2>
            <p className="mt-1 text-sm leading-5 text-ink/60">
              {esEdicion
                ? "Actualizá los datos biográficos de esta ficha."
                : "Con nombre y apellido alcanza para empezar."}
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-lg p-1.5 text-ink/40 transition-colors hover:bg-lavender/30 hover:text-velvet focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-velvet"
            aria-label="Cerrar"
          >
            <X size={19} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-5 sm:px-6 sm:py-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Nombre" htmlFor="nombre">
              <input id="nombre" required autoFocus value={nombre} onChange={(event) => setNombre(event.target.value)} className="campo" />
            </Campo>
            <Campo etiqueta="Apellido" htmlFor="apellido">
              <input id="apellido" required value={apellido} onChange={(event) => setApellido(event.target.value)} className="campo" />
            </Campo>
          </div>

          <Campo etiqueta="Género" htmlFor="genero" className="mt-4 max-w-xs">
            <select id="genero" value={genero} onChange={(event) => setGenero(event.target.value as Genero)} className="campo">
              <option value="no_definido">No definido</option>
              <option value="masculino">Masculino</option>
              <option value="femenino">Femenino</option>
            </select>
          </Campo>

          <details
            className="group mt-6 border-y border-border py-1.5"
            open={detallesAbiertos}
            onToggle={(event) => setDetallesAbiertos(event.currentTarget.open)}
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-lg py-2 text-sm font-medium text-velvet outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-velvet">
              Datos biográficos y notas
              <ChevronDown size={17} className="transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            <div className="grid gap-4 pb-4 pt-3">
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo etiqueta="Fecha de nacimiento" htmlFor="fecha-nacimiento">
                  <input id="fecha-nacimiento" type="date" value={fechaNacimiento} onChange={(event) => setFechaNacimiento(event.target.value)} className="campo" />
                </Campo>
                <Campo etiqueta="Lugar de nacimiento" htmlFor="lugar-nacimiento">
                  <input id="lugar-nacimiento" value={lugarNacimiento} onChange={(event) => setLugarNacimiento(event.target.value)} className="campo" />
                </Campo>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo etiqueta="Fecha de fallecimiento" htmlFor="fecha-fallecimiento">
                  <input id="fecha-fallecimiento" type="date" value={fechaFallecimiento} onChange={(event) => setFechaFallecimiento(event.target.value)} className="campo" />
                </Campo>
                <Campo etiqueta="Lugar de fallecimiento" htmlFor="lugar-fallecimiento">
                  <input id="lugar-fallecimiento" value={lugarFallecimiento} onChange={(event) => setLugarFallecimiento(event.target.value)} className="campo" />
                </Campo>
              </div>
              <Campo etiqueta="Notas" htmlFor="notas">
                <textarea id="notas" rows={3} value={notas} onChange={(event) => setNotas(event.target.value)} className="campo resize-y" />
              </Campo>
            </div>
          </details>

          {esEdicion && (
            <Link
              href={`/archivo/${persona.id}`}
              onClick={onCerrar}
              className="mt-4 inline-flex items-center gap-1.5 text-sm text-ink/60 transition-colors hover:text-velvet hover:underline"
            >
              Abrir ficha y administrar vínculos familiares
              <ExternalLink size={15} aria-hidden="true" />
            </Link>
          )}

          {error && <p className="mt-4 text-sm text-estado-incompleta" role="alert">{error}</p>}

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onCerrar} disabled={pendiente} className="boton-secundario">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pendiente}
              className="inline-flex items-center justify-center rounded-xl bg-velvet px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-velvet focus-visible:ring-offset-2 disabled:opacity-50"
            >
              {pendiente ? "Guardando…" : esEdicion ? "Guardar cambios" : "Guardar persona"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Campo({ etiqueta, htmlFor, className = "", children }: { etiqueta: string; htmlFor: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={htmlFor} className="text-sm text-ink/70">{etiqueta}</label>
      {children}
    </div>
  );
}
