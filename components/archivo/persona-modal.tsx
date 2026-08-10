"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { crearPersona, actualizarPersona } from "@/lib/personas-actions";
import type { Genero, Persona } from "@/lib/supabase/types";

interface PersonaModalProps {
  persona?: Persona;
  onCerrar: () => void;
}

export function PersonaModal({ persona, onCerrar }: PersonaModalProps) {
  const esEdicion = !!persona;

  const [nombre, setNombre] = useState(persona?.nombre ?? "");
  const [apellido, setApellido] = useState(persona?.apellido ?? "");
  const [genero, setGenero] = useState<Genero>(persona?.genero ?? "no_definido");
  const [fechaNacimiento, setFechaNacimiento] = useState(
    persona?.fecha_nacimiento ?? ""
  );
  const [lugarNacimiento, setLugarNacimiento] = useState(
    persona?.lugar_nacimiento ?? ""
  );
  const [fechaFallecimiento, setFechaFallecimiento] = useState(
    persona?.fecha_fallecimiento ?? ""
  );
  const [lugarFallecimiento, setLugarFallecimiento] = useState(
    persona?.lugar_fallecimiento ?? ""
  );
  const [notas, setNotas] = useState(persona?.notas ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
      const res = esEdicion
        ? await actualizarPersona(persona.id, input)
        : await crearPersona(input);

      if (res.error) {
        setError(res.error);
        return;
      }
      onCerrar();
    });
  }

  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-ink/20 px-4 py-8 overflow-y-auto"
      onClick={onCerrar}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-border bg-white p-6 shadow-soft my-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg text-velvet">
            {esEdicion ? "Editar persona" : "Agregar persona"}
          </h2>
          <button   
            onClick={onCerrar}
            className="text-ink/40 hover:text-ink/70 transition-colors"
            aria-label="Cerrar"
          >
        <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="nombre" className="text-sm text-ink/70">
                Nombre
              </label>
              <input
                id="nombre"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-ink outline-none focus:border-velvet transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="apellido" className="text-sm text-ink/70">
                Apellido
              </label>
              <input
                id="apellido"
                required
                value={apellido}
                onChange={(e) => setApellido(e.target.value)}
                className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-ink outline-none focus:border-velvet transition-colors"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="genero" className="text-sm text-ink/70">
              Género
            </label>
            <select
              id="genero"
              value={genero}
              onChange={(e) => setGenero(e.target.value as Genero)}
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-ink outline-none focus:border-velvet transition-colors"
            >
              <option value="no_definido">No definido</option>
              <option value="masculino">Masculino</option>
              <option value="femenino">Femenino</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="fecha_nac" className="text-sm text-ink/70">
                Fecha de nacimiento
              </label>
              <input
                id="fecha_nac"
                type="date"
                value={fechaNacimiento}
                onChange={(e) => setFechaNacimiento(e.target.value)}
                className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-ink outline-none focus:border-velvet transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="lugar_nac" className="text-sm text-ink/70">
                Lugar de nacimiento
              </label>
              <input
                id="lugar_nac"
                value={lugarNacimiento}
                onChange={(e) => setLugarNacimiento(e.target.value)}
                className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-ink outline-none focus:border-velvet transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="fecha_fall" className="text-sm text-ink/70">
                Fecha de fallecimiento
              </label>
              <input
                id="fecha_fall"
                type="date"
                value={fechaFallecimiento}
                onChange={(e) => setFechaFallecimiento(e.target.value)}
                className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-ink outline-none focus:border-velvet transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="lugar_fall" className="text-sm text-ink/70">
                Lugar de fallecimiento
              </label>
              <input
                id="lugar_fall"
                value={lugarFallecimiento}
                onChange={(e) => setLugarFallecimiento(e.target.value)}
                className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-ink outline-none focus:border-velvet transition-colors"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="notas" className="text-sm text-ink/70">
              Notas
            </label>
            <textarea
              id="notas"
              rows={3}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-ink outline-none focus:border-velvet transition-colors resize-none"
            />
          </div>

          {error && <p className="text-xs text-estado-incompleta">{error}</p>}

          <button
            type="submit"
            disabled={pendiente}
            className="mt-1 rounded-xl bg-velvet px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pendiente ? "Guardando..." : "Guardar"}
          </button>
        </form>
      </div>
    </div>
  );
}