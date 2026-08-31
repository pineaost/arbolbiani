import { CalendarDays, MapPin } from "lucide-react";
import type { PersonaConNivel } from "@/lib/supabase/types";

interface PersonaListItemProps { persona: PersonaConNivel; onAbrir: (personaId: string) => void; }

export function PersonaListItem({ persona, onAbrir }: PersonaListItemProps) {
  const acentoGenero = { masculino: "bg-genero-masculino", femenino: "bg-genero-femenino", no_definido: "bg-genero-indefinido" }[persona.genero];
  const fechas = [persona.fecha_nacimiento?.slice(0, 4), persona.fecha_fallecimiento?.slice(0, 4)].filter(Boolean);
  const lugar = persona.lugar_nacimiento ?? persona.lugar_fallecimiento;

  return <li className="group relative min-w-0 overflow-hidden rounded-2xl border border-sakura-line bg-sakura-paper shadow-sakura-card transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-sakura-bloom hover:shadow-sakura-card-hover focus-within:border-sakura-bloom focus-within:shadow-sakura-card-hover"><span className={`absolute inset-y-3 left-2 w-1.5 rounded-full shadow-sm ${acentoGenero}`} aria-hidden="true" /><button type="button" onClick={() => onAbrir(persona.id)} className="block min-h-36 w-full py-4 pl-8 pr-5 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sakura-plum" aria-label={`Abrir ficha de ${persona.nombre} ${persona.apellido}`}><span className="block min-w-0"><span className="line-clamp-2 font-display text-lg font-semibold leading-snug text-sakura-plum">{persona.nombre} {persona.apellido}</span></span><span className="mt-5 block space-y-1.5 text-xs text-sakura-muted">{fechas.length > 0 && <span className="flex items-center gap-1.5"><CalendarDays size={14} aria-hidden="true" />{fechas.join(" — ")}</span>}{lugar && <span className="flex items-center gap-1.5 truncate" title={lugar}><MapPin size={14} className="shrink-0" aria-hidden="true" /><span className="truncate">{lugar}</span></span>}{!fechas.length && !lugar && <span className="text-sakura-muted">Sin fechas ni lugares registrados</span>}</span></button></li>;
}
