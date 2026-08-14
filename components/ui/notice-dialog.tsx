"use client";

import { X } from "lucide-react";

interface NoticeDialogProps {
  abierto: boolean;
  titulo?: string;
  mensaje: string;
  onCerrar: () => void;
  accionDestructiva?: {
    etiqueta: string;
    onAccionar: () => void;
  };
  pendiente?: boolean;
}

export function NoticeDialog({ abierto, titulo = "No se pudo completar la acción", mensaje, onCerrar, accionDestructiva, pendiente = false }: NoticeDialogProps) {
  if (!abierto) return null;
  return <div className="fixed inset-0 z-40 flex items-end bg-ink/30 p-0 sm:items-center sm:justify-center sm:p-5" onClick={pendiente ? undefined : onCerrar}><section role="alertdialog" aria-modal="true" aria-labelledby="notice-dialog-title" onClick={(event) => event.stopPropagation()} className="w-full rounded-t-2xl border border-border bg-sakura-paper p-5 shadow-sakura-float sm:max-w-md sm:rounded-2xl sm:p-6"><div className="flex items-start justify-between gap-4"><div><h2 id="notice-dialog-title" className="font-display text-2xl text-velvet">{titulo}</h2><p className="mt-2 text-sm leading-6 text-ink/65">{mensaje}</p></div><button type="button" onClick={onCerrar} disabled={pendiente} className="rounded-lg p-1 text-ink/45 hover:bg-lavender/30 hover:text-velvet disabled:opacity-50" aria-label="Cerrar"><X size={18} /></button></div><div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={onCerrar} disabled={pendiente} className="boton-secundario">Entendido</button>{accionDestructiva && <button type="button" onClick={accionDestructiva.onAccionar} disabled={pendiente} className="inline-flex items-center justify-center rounded-xl bg-estado-incompleta px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50">{pendiente ? "Eliminando…" : accionDestructiva.etiqueta}</button>}</div></section></div>;
}
