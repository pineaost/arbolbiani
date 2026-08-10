import type { NivelInformacion } from "@/lib/supabase/types";

const estilos: Record<NivelInformacion, string> = {
  bajo: "bg-ink/5 text-ink/55",
  medio: "bg-lavender/40 text-velvet",
  alto: "bg-estado-confirmada/10 text-estado-confirmada",
};

export function NivelInformacionBadge({ nivel }: { nivel: NivelInformacion }) {
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${estilos[nivel]}`}>
      Información {nivel}
    </span>
  );
}
