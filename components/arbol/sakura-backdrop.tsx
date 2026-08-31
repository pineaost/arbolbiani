"use client";

// árbol-biani:sakura-backdrop-depth-v3
// v3 suma una atmósfera radial muy sutil detrás de las flores y una
// deriva propia (CSS, no JS) por flor: un movimiento mínimo e
// independiente del zoom que sólo sugiere que el fondo "respira". La
// reacción al zoom (deltaZoom / FACTOR_PROFUNDIDAD) sigue intacta.
// Fondo decorativo del Árbol. Mantiene la forma aprobada de cinco círculos
// (sin curvas, degradados ni blur) y suma variedad orgánica de tamaño,
// color y profundidad. La reacción al zoom es deliberadamente mínima: sólo
// sugiere que las flores viven en un plano mucho más lejano que las
// fichas, nunca un efecto de parallax evidente.

import { useEffect, useRef, useState } from "react";

type ColorFlor = "bloom" | "bloomBlush" | "rose" | "lavender";

interface Flor {
  izquierda: string;
  arriba: string;
  tamano: number;
  opacidad: number;
  rotacion: number;
  color: ColorFlor;
  // Capa de profundidad simulada: 1 = plano más lejano, 3 = plano más
  // cercano. Sólo determina cuánto reacciona la flor al zoom del árbol.
  capa: 1 | 2 | 3;
}

const CLASE_COLOR: Record<ColorFlor, string> = {
  bloom: "text-sakura-bloom",
  bloomBlush: "text-sakura-blush",
  rose: "text-sakura-rose",
  lavender: "text-sakura-lavender",
};

// Cuánto se le permite crecer o encogerse a cada capa por cada unidad de
// zoom que gana o pierde el árbol. Deliberadamente pequeño: incluso la
// capa más "cercana" se mueve una fracción de lo que se mueve el mapa.
const FACTOR_PROFUNDIDAD: Record<Flor["capa"], number> = {
  1: 0.026,
  2: 0.046,
  3: 0.072,
};

const flores: Flor[] = [
  { izquierda: "6%", arriba: "10%", tamano: 20, opacidad: 0.2, rotacion: -8, color: "bloom", capa: 2 },
  { izquierda: "18%", arriba: "28%", tamano: 14, opacidad: 0.16, rotacion: 12, color: "bloomBlush", capa: 1 },
  { izquierda: "34%", arriba: "8%", tamano: 22, opacidad: 0.14, rotacion: -20, color: "lavender", capa: 1 },
  { izquierda: "47%", arriba: "22%", tamano: 16, opacidad: 0.22, rotacion: 6, color: "bloom", capa: 2 },
  { izquierda: "60%", arriba: "6%", tamano: 26, opacidad: 0.18, rotacion: -4, color: "bloomBlush", capa: 2 },
  { izquierda: "74%", arriba: "18%", tamano: 24, opacidad: 0.24, rotacion: 16, color: "bloom", capa: 3 },
  { izquierda: "90%", arriba: "12%", tamano: 18, opacidad: 0.15, rotacion: -12, color: "lavender", capa: 1 },
  { izquierda: "10%", arriba: "46%", tamano: 15, opacidad: 0.13, rotacion: 20, color: "rose", capa: 1 },
  { izquierda: "26%", arriba: "58%", tamano: 28, opacidad: 0.3, rotacion: -6, color: "bloom", capa: 3 },
  { izquierda: "40%", arriba: "42%", tamano: 17, opacidad: 0.17, rotacion: 10, color: "bloomBlush", capa: 2 },
  { izquierda: "54%", arriba: "52%", tamano: 21, opacidad: 0.19, rotacion: -14, color: "rose", capa: 2 },
  { izquierda: "68%", arriba: "40%", tamano: 15, opacidad: 0.21, rotacion: 4, color: "lavender", capa: 1 },
  { izquierda: "82%", arriba: "56%", tamano: 27, opacidad: 0.26, rotacion: -18, color: "bloom", capa: 3 },
  { izquierda: "15%", arriba: "78%", tamano: 19, opacidad: 0.28, rotacion: 8, color: "bloomBlush", capa: 2 },
  { izquierda: "30%", arriba: "88%", tamano: 14, opacidad: 0.14, rotacion: -10, color: "lavender", capa: 1 },
  { izquierda: "48%", arriba: "74%", tamano: 23, opacidad: 0.2, rotacion: 18, color: "bloom", capa: 2 },
  { izquierda: "64%", arriba: "84%", tamano: 16, opacidad: 0.15, rotacion: -6, color: "rose", capa: 1 },
  { izquierda: "88%", arriba: "76%", tamano: 20, opacidad: 0.24, rotacion: 12, color: "bloomBlush", capa: 3 },
];

function limitar(valor: number, minimo: number, maximo: number) {
  return Math.min(maximo, Math.max(minimo, valor));
}

interface SakuraBackdropProps {
  // Escala actual de zoom del árbol (el `k` que ya lee arbol-client.tsx
  // del chart). `null` mientras el árbol todavía no reportó una lectura o
  // se está volviendo a montar; en ese caso el fondo no reacciona.
  escala?: number | null;
}

export function SakuraBackdrop({ escala = null }: SakuraBackdropProps) {
  const escalaBaseRef = useRef<number | null>(null);
  const [deltaZoom, setDeltaZoom] = useState(0);

  useEffect(() => {
    if (escala == null) {
      // El árbol se está (re)montando: la próxima lectura vuelve a ser la
      // referencia, para no arrastrar la escala de un árbol anterior.
      escalaBaseRef.current = null;
      setDeltaZoom(0);
      return;
    }
    if (escalaBaseRef.current == null) {
      escalaBaseRef.current = escala;
      setDeltaZoom(0);
      return;
    }
    setDeltaZoom(limitar(escala - escalaBaseRef.current, -1.4, 2.6));
  }, [escala]);

  return (
    <div className="sakura-backdrop-atmosfera pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
      {flores.map((flor, indice) => {
        const escalaFlor = limitar(1 + deltaZoom * FACTOR_PROFUNDIDAD[flor.capa], 0.9, 1.14);
        // Duración/demora determinísticas (no aleatorias) según el índice,
        // para que cada flor derive a su propio ritmo sin sincronizarse con
        // las demás. Sólo mueve la envoltura; el <svg> interno conserva su
        // propio transform para la reacción al zoom, sin conflicto entre los dos.
        const duracionDeriva = 13 + (indice % 5) * 2.4;
        const demoraDeriva = -(indice % 7) * 1.7;
        return (
          <div
            key={indice}
            className="sakura-flor-deriva absolute"
            style={{
              left: flor.izquierda,
              top: flor.arriba,
              width: flor.tamano,
              height: flor.tamano,
              animationDuration: `${duracionDeriva}s`,
              animationDelay: `${demoraDeriva}s`,
            }}
          >
            <svg
              viewBox="0 0 40 40"
              className={CLASE_COLOR[flor.color]}
              style={{
                width: "100%",
                height: "100%",
                opacity: flor.opacidad,
                transform: `rotate(${flor.rotacion}deg) scale(${escalaFlor})`,
                transition: "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            >
              <g fill="currentColor">
                <circle cx="20" cy="10" r="8" />
                <circle cx="28" cy="16" r="8" />
                <circle cx="25" cy="26" r="8" />
                <circle cx="15" cy="26" r="8" />
                <circle cx="12" cy="16" r="8" />
              </g>
            </svg>
          </div>
        );
      })}
    </div>
  );
}
