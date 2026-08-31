// Fondo decorativo y completamente estático del Árbol. Flores y pétalos
// quedan fuera del SVG que recibe zoom/pan para no moverse con el mapa.
type ColorSakura = "bloom" | "blush" | "rose" | "lavender";

interface MotivoSakura {
  izquierda: string;
  arriba: string;
  tamano: number;
  opacidad: number;
  rotacion: number;
  color: ColorSakura;
}

const CLASE_COLOR: Record<ColorSakura, string> = {
  bloom: "text-sakura-bloom",
  blush: "text-sakura-blush",
  rose: "text-sakura-rose",
  lavender: "text-sakura-lavender",
};

const flores: MotivoSakura[] = [
  { izquierda: "4%", arriba: "9%", tamano: 20, opacidad: 0.2, rotacion: -8, color: "bloom" },
  { izquierda: "16%", arriba: "25%", tamano: 14, opacidad: 0.14, rotacion: 12, color: "blush" },
  { izquierda: "31%", arriba: "7%", tamano: 21, opacidad: 0.14, rotacion: -20, color: "lavender" },
  { izquierda: "46%", arriba: "19%", tamano: 16, opacidad: 0.18, rotacion: 6, color: "bloom" },
  { izquierda: "61%", arriba: "5%", tamano: 24, opacidad: 0.15, rotacion: -4, color: "blush" },
  { izquierda: "76%", arriba: "16%", tamano: 22, opacidad: 0.2, rotacion: 16, color: "bloom" },
  { izquierda: "91%", arriba: "9%", tamano: 17, opacidad: 0.14, rotacion: -12, color: "lavender" },
  { izquierda: "7%", arriba: "43%", tamano: 15, opacidad: 0.12, rotacion: 20, color: "rose" },
  { izquierda: "21%", arriba: "55%", tamano: 25, opacidad: 0.2, rotacion: -6, color: "bloom" },
  { izquierda: "36%", arriba: "39%", tamano: 17, opacidad: 0.14, rotacion: 10, color: "blush" },
  { izquierda: "54%", arriba: "51%", tamano: 20, opacidad: 0.15, rotacion: -14, color: "rose" },
  { izquierda: "69%", arriba: "36%", tamano: 15, opacidad: 0.17, rotacion: 4, color: "lavender" },
  { izquierda: "84%", arriba: "51%", tamano: 25, opacidad: 0.2, rotacion: -18, color: "bloom" },
  { izquierda: "95%", arriba: "35%", tamano: 13, opacidad: 0.11, rotacion: 9, color: "blush" },
  { izquierda: "9%", arriba: "78%", tamano: 18, opacidad: 0.19, rotacion: 8, color: "blush" },
  { izquierda: "27%", arriba: "88%", tamano: 14, opacidad: 0.13, rotacion: -10, color: "lavender" },
  { izquierda: "45%", arriba: "72%", tamano: 22, opacidad: 0.17, rotacion: 18, color: "bloom" },
  { izquierda: "63%", arriba: "86%", tamano: 16, opacidad: 0.13, rotacion: -6, color: "rose" },
  { izquierda: "81%", arriba: "75%", tamano: 19, opacidad: 0.18, rotacion: 12, color: "blush" },
  { izquierda: "94%", arriba: "91%", tamano: 15, opacidad: 0.14, rotacion: -15, color: "lavender" },
];

const petalos: MotivoSakura[] = [
  { izquierda: "12%", arriba: "14%", tamano: 10, opacidad: 0.18, rotacion: 32, color: "rose" },
  { izquierda: "24%", arriba: "43%", tamano: 8, opacidad: 0.14, rotacion: -28, color: "lavender" },
  { izquierda: "39%", arriba: "28%", tamano: 9, opacidad: 0.16, rotacion: 18, color: "bloom" },
  { izquierda: "51%", arriba: "10%", tamano: 7, opacidad: 0.13, rotacion: -34, color: "rose" },
  { izquierda: "59%", arriba: "63%", tamano: 10, opacidad: 0.15, rotacion: 40, color: "blush" },
  { izquierda: "72%", arriba: "25%", tamano: 8, opacidad: 0.15, rotacion: -18, color: "lavender" },
  { izquierda: "79%", arriba: "62%", tamano: 9, opacidad: 0.17, rotacion: 26, color: "rose" },
  { izquierda: "90%", arriba: "28%", tamano: 7, opacidad: 0.13, rotacion: -42, color: "bloom" },
  { izquierda: "17%", arriba: "69%", tamano: 8, opacidad: 0.14, rotacion: 36, color: "lavender" },
  { izquierda: "35%", arriba: "81%", tamano: 10, opacidad: 0.16, rotacion: -22, color: "bloom" },
  { izquierda: "69%", arriba: "77%", tamano: 7, opacidad: 0.12, rotacion: 30, color: "rose" },
  { izquierda: "88%", arriba: "86%", tamano: 9, opacidad: 0.15, rotacion: -30, color: "lavender" },
];

export function SakuraBackdrop() {
  return (
    <div className="sakura-backdrop-atmosfera pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
      {flores.map((flor, indice) => {
        return (
          <svg
            key={indice}
            viewBox="0 0 40 40"
            className={`absolute ${CLASE_COLOR[flor.color]}`}
            style={{
              left: flor.izquierda,
              top: flor.arriba,
              width: flor.tamano,
              height: flor.tamano,
              opacity: flor.opacidad,
              transform: `rotate(${flor.rotacion}deg)`,
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
        );
      })}
      {petalos.map((petalo, indice) => (
        <svg
          key={`petalo-${indice}`}
          viewBox="0 0 18 28"
          className={`absolute ${CLASE_COLOR[petalo.color]}`}
          style={{
            left: petalo.izquierda,
            top: petalo.arriba,
            width: petalo.tamano,
            height: petalo.tamano * 1.45,
            opacity: petalo.opacidad,
            transform: `rotate(${petalo.rotacion}deg)`,
          }}
        >
          <ellipse cx="9" cy="14" rx="5.5" ry="11" fill="currentColor" />
        </svg>
      ))}
    </div>
  );
}
