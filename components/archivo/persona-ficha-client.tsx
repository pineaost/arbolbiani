"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  ArrowLeft,
  Download,
  Eye,
  FileText,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import {
  eliminarDocumentoDePersona,
  obtenerEnlaceDocumento,
  subirDocumentosPersona,
} from "@/lib/documentos-actions";
import {
  agregarConyuge,
  agregarFiliacion,
  actualizarConyuge,
  eliminarConyuge,
  eliminarFiliacion,
} from "@/lib/relaciones-actions";
import { eliminarPersona, eliminarPersonaForzada, type ResultadoEliminarPersona } from "@/lib/personas-actions";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { NoticeDialog } from "@/components/ui/notice-dialog";
import { PersonaModal } from "@/components/archivo/persona-modal";
import type { Documento, PersonaConNivel, PersonaFicha, TipoDocumento } from "@/lib/supabase/types";

interface Props {
  persona: PersonaFicha;
  personas: PersonaConNivel[];
  enDrawer?: boolean;
  onCerrar?: () => void;
  onActualizarFicha?: () => Promise<void>;
}

type Confirmacion = {
  titulo: string;
  descripcion: string;
  confirmar: string;
  tarea: () => Promise<ResultadoEliminarPersona>;
  alExito?: () => void;
};

type Aviso = {
  titulo?: string;
  mensaje: string;
  permiteEliminacionForzada?: boolean;
};

function nombreCompleto(persona: { nombre: string; apellido: string }) {
  return `${persona.nombre} ${persona.apellido}`;
}

function fechaVisible(fecha: string | null) {
  if (!fecha) return null;
  const [anio, mes, dia] = fecha.split("-");
  return `${dia}/${mes}/${anio}`;
}

function mensajeEliminacionForzada(
  detalle: string[] = [],
  dependencias?: ResultadoEliminarPersona["dependencias"]
) {
  const tieneVinculosFamiliares = (dependencias?.vinculosFamiliares ?? 0) > 0 || detalle.includes("padres, hijos o cónyuges");
  const tieneDocumentos = (dependencias?.documentos ?? 0) > 0 || detalle.includes("documentos asociados");
  const acciones: string[] = [];

  if (tieneVinculosFamiliares) acciones.push("Se eliminarán sus vínculos familiares.");
  if (tieneDocumentos) acciones.push("Se quitarán sus asociaciones con documentos; los documentos compartidos se conservarán y los que queden sin asociaciones se eliminarán junto con su archivo.");
  if ((dependencias?.entradasBitacora ?? 0) > 0) acciones.push("Las entradas de Bitácora se conservarán, pero quedarán sin esta persona asociada.");

  return `Esta persona todavía tiene ${detalle.join(" y ") || "información asociada"}. ${acciones.join(" ")} Esta acción no se puede deshacer.`;
}

const etiquetasDocumento: Record<TipoDocumento, string> = {
  nacimiento: "Nacimiento",
  matrimonio: "Matrimonio",
  defuncion: "Defunción",
  otro: "Otro documento",
};

export function PersonaFichaClient({ persona, personas, enDrawer = false, onCerrar, onActualizarFicha }: Props) {
  const router = useRouter();
  const [padreElegido, setPadreElegido] = useState("");
  const [hijoElegido, setHijoElegido] = useState("");
  const [conyugeElegido, setConyugeElegido] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [notasConyuge, setNotasConyuge] = useState("");
  const [conyugeEditando, setConyugeEditando] = useState<PersonaFicha["conyuges"][number] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmacion, setConfirmacion] = useState<Confirmacion | null>(null);
  const [editandoDatos, setEditandoDatos] = useState(false);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [pendiente, startTransition] = useTransition();
  const opciones = personas.filter((p) => p.id !== persona.id);

  function ejecutar(tarea: () => Promise<ResultadoEliminarPersona>) {
    setError(null);
    startTransition(async () => {
      const resultado = await tarea();
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      setPadreElegido("");
      setHijoElegido("");
      setConyugeElegido("");
      setFechaInicio("");
      setFechaFin("");
      setNotasConyuge("");
      setConyugeEditando(null);
      router.refresh();
      await onActualizarFicha?.();
    });
  }

  function pedirEliminacion(etiqueta: string, tarea: () => Promise<{ error: string | null }>) {
    setConfirmacion({ titulo: "Eliminar vínculo", descripcion: `¿Querés eliminar el vínculo con ${etiqueta}? Esta acción no borra a la otra persona.`, confirmar: "Eliminar vínculo", tarea });
  }

  function confirmarEliminacion() {
    if (!confirmacion) return;
    const actual = confirmacion;
    setError(null);
    startTransition(async () => {
      const resultado = await actual.tarea();
      if (resultado.error) {
        setError(resultado.error);
        setAviso(resultado.requiereEliminacionForzada ? {
          titulo: "Esta persona tiene información asociada",
          mensaje: mensajeEliminacionForzada(resultado.detalle, resultado.dependencias),
          permiteEliminacionForzada: true,
        } : { mensaje: resultado.error });
        setConfirmacion(null);
        return;
      }
      setConfirmacion(null);
      actual.alExito?.();
      router.refresh();
      if (!actual.alExito) await onActualizarFicha?.();
    });
  }

  function confirmarEliminacionForzada() {
    setError(null);
    startTransition(async () => {
      const resultado = await eliminarPersonaForzada(persona.id);
      if (resultado.error) {
        setError(resultado.error);
        setAviso({ mensaje: resultado.error });
        return;
      }

      setAviso(null);
      router.refresh();
      if (enDrawer) onCerrar?.();
      router.push("/archivo");
    });
  }

  function editarConyuge(vinculo: PersonaFicha["conyuges"][number]) {
    setConyugeEditando(vinculo);
    setConyugeElegido(vinculo.conyuge.id);
    setFechaInicio(vinculo.fecha_inicio ?? "");
    setFechaFin(vinculo.fecha_fin ?? "");
    setNotasConyuge(vinculo.notas ?? "");
  }

  function subirDocumentos(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formulario = event.currentTarget;
    const formData = new FormData(formulario);

    setError(null);
    startTransition(async () => {
      const resultado = await subirDocumentosPersona(persona.id, formData);
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      formulario.reset();
      router.refresh();
      await onActualizarFicha?.();
    });
  }

  function abrirDocumento(documento: Documento, descargar = false) {
    setError(null);
    startTransition(async () => {
      const resultado = await obtenerEnlaceDocumento(documento.id, descargar);
      if (resultado.error || !resultado.url) {
        setError(resultado.error ?? "No se pudo abrir el documento.");
        return;
      }

      const enlace = window.document.createElement("a");
      enlace.href = resultado.url;
      enlace.target = "_blank";
      enlace.rel = "noreferrer";
      enlace.click();
    });
  }

  return (
    <div className="mx-auto max-w-4xl px-5 py-7 sm:px-6 md:py-10">
      {!enDrawer && <Link href="/archivo" className="mb-6 inline-flex items-center gap-1.5 text-sm text-ink/60 transition-colors hover:text-velvet">
        <ArrowLeft size={16} /> Volver al Archivo Familiar
      </Link>}

      <section className="rounded-2xl border border-border bg-sakura-paper p-5 shadow-soft sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-[0.16em] text-ink/45">Datos personales</p>
          <h1 className="font-display text-3xl text-velvet">{nombreCompleto(persona)}</h1>
          </div>
          <button type="button" onClick={() => setEditandoDatos(true)} className="boton-secundario shrink-0"><Pencil size={15} />Editar datos</button>
        </div>
        <div className="mt-6 grid gap-4 text-sm text-ink/75 sm:grid-cols-2">
          <Dato etiqueta="Nacimiento" valor={[fechaVisible(persona.fecha_nacimiento), persona.lugar_nacimiento].filter(Boolean).join(" · ")} />
          <Dato etiqueta="Fallecimiento" valor={[fechaVisible(persona.fecha_fallecimiento), persona.lugar_fallecimiento].filter(Boolean).join(" · ")} />
        </div>
        <div className="mt-5 border-t border-border pt-4"><p className="text-xs font-medium uppercase tracking-[.14em] text-ink/45">Notas</p><p className="mt-2 border-l-2 border-lavender pl-3 text-sm leading-6 text-ink/70">{persona.notas || "Sin notas registradas."}</p></div>
      </section>

      <p className="mt-4 min-h-5 text-sm text-estado-incompleta" role="alert">{error}</p>

      <p className="mt-7 text-xs font-medium uppercase tracking-[.16em] text-ink/45">Relaciones</p>
      <div className="mt-1 grid gap-4 md:grid-cols-2">
        <RelacionCard titulo="Padres / madres" descripcion="Personas registradas como progenitores.">
          <ListaVinculos vinculos={persona.padres} onEliminar={(vinculo) => pedirEliminacion(nombreCompleto(vinculo.persona), () => eliminarFiliacion(vinculo.id))} />
          <FormularioPersona
            valor={padreElegido}
            onCambio={setPadreElegido}
            opciones={opciones}
            etiqueta="Agregar padre o madre"
            pendiente={pendiente}
            onAgregar={() => ejecutar(() => agregarFiliacion({ padre_id: padreElegido, hijo_id: persona.id }))}
          />
        </RelacionCard>

        <RelacionCard titulo="Hijos / hijas" descripcion="Personas para las que figura como progenitor/a.">
          <ListaVinculos vinculos={persona.hijos} onEliminar={(vinculo) => pedirEliminacion(nombreCompleto(vinculo.persona), () => eliminarFiliacion(vinculo.id))} />
          <FormularioPersona
            valor={hijoElegido}
            onCambio={setHijoElegido}
            opciones={opciones}
            etiqueta="Agregar hijo o hija"
            pendiente={pendiente}
            onAgregar={() => ejecutar(() => agregarFiliacion({ padre_id: persona.id, hijo_id: hijoElegido }))}
          />
        </RelacionCard>
      </div>

      <RelacionCard titulo="Cónyuges / parejas" descripcion="Podés registrar fechas y una nota opcionales.">
        <ul className="mb-4 divide-y divide-border">
          {persona.conyuges.map((vinculo) => (
            <li key={vinculo.id} className="flex items-start justify-between gap-3 py-3 first:pt-0">
              <div>
                <p className="text-sm text-ink">{nombreCompleto(vinculo.conyuge)}</p>
                {(vinculo.fecha_inicio || vinculo.fecha_fin || vinculo.notas) && <p className="mt-1 text-xs leading-5 text-ink/55">{[vinculo.fecha_inicio && `Desde ${fechaVisible(vinculo.fecha_inicio)}`, vinculo.fecha_fin && `hasta ${fechaVisible(vinculo.fecha_fin)}`, vinculo.notas].filter(Boolean).join(" · ")}</p>}
              </div>
              <div className="flex shrink-0 gap-1">
                <button type="button" onClick={() => editarConyuge(vinculo)} className="rounded-lg p-1 text-ink/40 hover:bg-lavender/30 hover:text-velvet" aria-label={`Editar vínculo con ${nombreCompleto(vinculo.conyuge)}`}><Pencil size={15} /></button>
                <button type="button" onClick={() => pedirEliminacion(nombreCompleto(vinculo.conyuge), () => eliminarConyuge(vinculo.id))} className="rounded-lg p-1 text-ink/40 hover:bg-estado-incompleta/10 hover:text-estado-incompleta" aria-label={`Eliminar vínculo con ${nombreCompleto(vinculo.conyuge)}`}><Trash2 size={16} /></button>
              </div>
            </li>
          ))}
          {persona.conyuges.length === 0 && <li className="pb-3 text-sm text-ink/45">Todavía no hay vínculos cargados.</li>}
        </ul>
        <div className="grid gap-3 sm:grid-cols-2">
          <select value={conyugeElegido} onChange={(event) => setConyugeElegido(event.target.value)} disabled={!!conyugeEditando} className="campo disabled:cursor-not-allowed disabled:opacity-60" aria-label="Persona cónyuge o pareja">
            <option value="">Elegir persona</option>
            {opciones.map((opcion) => <option key={opcion.id} value={opcion.id}>{nombreCompleto(opcion)}</option>)}
          </select>
          <input type="date" value={fechaInicio} onChange={(event) => setFechaInicio(event.target.value)} className="campo" aria-label="Fecha de inicio" />
          <input type="date" value={fechaFin} onChange={(event) => setFechaFin(event.target.value)} className="campo" aria-label="Fecha de fin" />
          <input value={notasConyuge} onChange={(event) => setNotasConyuge(event.target.value)} placeholder="Nota opcional" className="campo" />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button type="button" disabled={!conyugeElegido || pendiente} onClick={() => conyugeEditando ? ejecutar(() => actualizarConyuge(conyugeEditando.id, { fecha_inicio: fechaInicio || null, fecha_fin: fechaFin || null, notas: notasConyuge.trim() || null })) : ejecutar(() => agregarConyuge({ persona1_id: persona.id, persona2_id: conyugeElegido, fecha_inicio: fechaInicio || null, fecha_fin: fechaFin || null, notas: notasConyuge.trim() || null }))} className="boton-secundario">
            {conyugeEditando ? <Pencil size={15} /> : <Plus size={15} />}
            {conyugeEditando ? "Guardar cambios" : "Agregar vínculo"}
          </button>
          {conyugeEditando && <button type="button" onClick={() => { setConyugeEditando(null); setConyugeElegido(""); setFechaInicio(""); setFechaFin(""); setNotasConyuge(""); }} className="text-sm text-ink/60 hover:text-velvet">Cancelar</button>}
        </div>
      </RelacionCard>

      <RelacionCard titulo="Documentos" descripcion="Actas y documentos de respaldo asociados a esta persona.">
        <ListaDocumentos documentos={persona.documentos} pendiente={pendiente} onAbrir={(documento) => abrirDocumento(documento)} onDescargar={(documento) => abrirDocumento(documento, true)} onEliminar={(documento) => pedirEliminacion(documento.titulo, () => eliminarDocumentoDePersona(documento.id, persona.id))} />
        <form onSubmit={subirDocumentos} className="mt-4 border-t border-border pt-4">
          <div className="grid gap-3 sm:grid-cols-[11rem_1fr_auto] sm:items-end">
            <label className="flex flex-col gap-1.5 text-sm text-ink/70">
              Tipo
              <select name="tipo" defaultValue="otro" className="campo">
                {Object.entries(etiquetasDocumento).map(([valor, etiqueta]) => <option key={valor} value={valor}>{etiqueta}</option>)}
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-1.5 text-sm text-ink/70">
              Archivos PDF
              <input name="archivos" type="file" accept="application/pdf,.pdf" multiple className="block w-full text-sm text-ink/60 file:mr-3 file:rounded-lg file:border-0 file:bg-lavender/35 file:px-3 file:py-2 file:text-sm file:font-medium file:text-velvet hover:file:bg-lavender/55" />
            </label>
            <button type="submit" disabled={pendiente} className="boton-secundario"><Upload size={15} /> Subir</button>
          </div>
          <p className="mt-2 text-xs text-ink/45">Podés seleccionar uno, varios o ningún documento. Solo PDF.</p>
        </form>
      </RelacionCard>
      <RelacionCard titulo="Bitácora" descripcion="Entradas de investigación asociadas a esta persona.">
        {persona.entradas_bitacora.length === 0 ? <p className="text-sm text-ink/45">No hay entradas asociadas todavía.</p> : <ul className="divide-y divide-border">{persona.entradas_bitacora.map((entrada) => <li key={entrada.id} className="py-3 first:pt-0"><p className="text-xs font-medium uppercase tracking-wide text-velvet/70">{entrada.tipo.replaceAll("_", " ")}</p><p className="mt-1 line-clamp-2 text-sm text-ink/70">{entrada.contenido}</p></li>)}</ul>}
        <Link href="/bitacora" className="mt-4 inline-flex text-sm text-velvet underline underline-offset-4">Abrir Bitácora</Link>
      </RelacionCard>
      <section className="mt-8 border-t border-border pt-6">
        <h2 className="font-display text-lg text-velvet">Eliminar persona</h2>
        <p className="mt-1 text-sm leading-6 text-ink/60">La eliminación habitual se bloquea si hay vínculos o documentos. Podés revisar la advertencia y decidir si querés continuar de forma forzada.</p>
        <button type="button" disabled={pendiente} onClick={() => setConfirmacion({ titulo: "Eliminar persona", descripcion: `¿Querés eliminar definitivamente a ${nombreCompleto(persona)}?`, confirmar: "Eliminar persona", tarea: () => eliminarPersona(persona.id), alExito: () => { if (enDrawer) onCerrar?.(); router.push("/archivo"); } })} className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-estado-incompleta/35 px-3 py-2 text-sm font-medium text-estado-incompleta transition-colors hover:bg-estado-incompleta/10 disabled:opacity-50"><Trash2 size={16} />Eliminar</button>
      </section>
      {confirmacion && <ConfirmDialog abierto titulo={confirmacion.titulo} descripcion={confirmacion.descripcion} confirmar={confirmacion.confirmar} pendiente={pendiente} onCancelar={() => setConfirmacion(null)} onConfirmar={confirmarEliminacion} />}
      {aviso && <NoticeDialog abierto titulo={aviso.titulo} mensaje={aviso.mensaje} pendiente={pendiente} onCerrar={() => setAviso(null)} accionDestructiva={aviso.permiteEliminacionForzada ? { etiqueta: "Eliminar", onAccionar: confirmarEliminacionForzada } : undefined} />}
      {editandoDatos && <PersonaModal persona={persona} onCerrar={() => setEditandoDatos(false)} onGuardado={() => { router.refresh(); void onActualizarFicha?.(); }} />}
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return <div><p className="text-xs uppercase tracking-wide text-ink/45">{etiqueta}</p><p className="mt-1">{valor || "Sin datos"}</p></div>;
}

function RelacionCard({ titulo, descripcion, children }: { titulo: string; descripcion: string; children: React.ReactNode }) {
  return <section className="mt-4 rounded-2xl border border-border bg-sakura-paper p-5 shadow-soft"><h2 className="font-display text-lg text-velvet">{titulo}</h2><p className="mt-1 text-xs leading-5 text-ink/55">{descripcion}</p><div className="mt-4">{children}</div></section>;
}

function ListaVinculos({ vinculos, onEliminar }: { vinculos: PersonaFicha["padres"]; onEliminar: (vinculo: PersonaFicha["padres"][number]) => void }) {
  return <ul className="mb-4 divide-y divide-border">{vinculos.map((vinculo) => <li key={vinculo.id} className="flex items-center justify-between gap-3 py-2 first:pt-0"><Link href={`/archivo/${vinculo.persona.id}`} className="text-sm text-ink hover:text-velvet hover:underline">{nombreCompleto(vinculo.persona)}</Link><button type="button" onClick={() => onEliminar(vinculo)} className="rounded-lg p-1 text-ink/40 hover:bg-estado-incompleta/10 hover:text-estado-incompleta" aria-label={`Eliminar vínculo con ${nombreCompleto(vinculo.persona)}`}><Trash2 size={16} /></button></li>)}{vinculos.length === 0 && <li className="pb-3 text-sm text-ink/45">Todavía no hay vínculos cargados.</li>}</ul>;
}

function FormularioPersona({ valor, onCambio, opciones, etiqueta, pendiente, onAgregar }: { valor: string; onCambio: (valor: string) => void; opciones: PersonaConNivel[]; etiqueta: string; pendiente: boolean; onAgregar: () => void }) {
  return <div className="flex gap-2"><select value={valor} onChange={(event) => onCambio(event.target.value)} className="campo min-w-0 flex-1" aria-label={etiqueta}><option value="">Elegir persona</option>{opciones.map((opcion) => <option key={opcion.id} value={opcion.id}>{nombreCompleto(opcion)}</option>)}</select><button type="button" disabled={!valor || pendiente} onClick={onAgregar} className="boton-secundario shrink-0" aria-label={etiqueta}><Plus size={15} /><span className="hidden sm:inline">Agregar</span></button></div>;
}

function ListaDocumentos({ documentos, pendiente, onAbrir, onDescargar, onEliminar }: { documentos: Documento[]; pendiente: boolean; onAbrir: (documento: Documento) => void; onDescargar: (documento: Documento) => void; onEliminar: (documento: Documento) => void }) {
  if (documentos.length === 0) return <p className="text-sm text-ink/45">No hay documentos asociados todavía.</p>;

  return <ul className="divide-y divide-border">
    {documentos.map((documento) => (
      <li key={documento.id} className="flex items-center justify-between gap-3 py-3 first:pt-0">
        <div className="flex min-w-0 items-center gap-2.5">
          <FileText size={18} className="shrink-0 text-velvet/65" aria-hidden="true" />
          <div className="min-w-0"><p className="truncate text-sm text-ink">{documento.titulo}</p><p className="mt-0.5 text-xs text-ink/50">{etiquetasDocumento[documento.tipo]}</p></div>
        </div>
        <div className="flex shrink-0 gap-1">
          <button type="button" disabled={pendiente} onClick={() => onAbrir(documento)} className="rounded-lg p-1.5 text-ink/45 hover:bg-lavender/30 hover:text-velvet disabled:opacity-50" aria-label={`Ver ${documento.titulo}`}><Eye size={16} /></button>
          <button type="button" disabled={pendiente} onClick={() => onDescargar(documento)} className="rounded-lg p-1.5 text-ink/45 hover:bg-lavender/30 hover:text-velvet disabled:opacity-50" aria-label={`Descargar ${documento.titulo}`}><Download size={16} /></button>
          <button type="button" disabled={pendiente} onClick={() => onEliminar(documento)} className="rounded-lg p-1.5 text-ink/45 hover:bg-estado-incompleta/10 hover:text-estado-incompleta disabled:opacity-50" aria-label={`Eliminar ${documento.titulo}`}><Trash2 size={16} /></button>
        </div>
      </li>
    ))}
  </ul>;
}
