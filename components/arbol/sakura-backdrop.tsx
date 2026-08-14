const flores = [
  { izquierda: "8%", arriba: "12%", tamano: 18, opacidad: 0.18 },
  { izquierda: "77%", arriba: "16%", tamano: 24, opacidad: 0.24 },
  { izquierda: "21%", arriba: "72%", tamano: 20, opacidad: 0.31 },
  { izquierda: "63%", arriba: "64%", tamano: 28, opacidad: 0.16 },
  { izquierda: "86%", arriba: "80%", tamano: 16, opacidad: 0.28 },
];

export function SakuraBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
      {flores.map((flor, indice) => (
        <svg
          key={indice}
          viewBox="0 0 40 40"
          className="absolute text-sakura-bloom"
          style={{ left: flor.izquierda, top: flor.arriba, width: flor.tamano, height: flor.tamano, opacity: flor.opacidad }}
        >
          <g fill="currentColor">
            <circle cx="20" cy="10" r="8" />
            <circle cx="28" cy="16" r="8" />
            <circle cx="25" cy="26" r="8" />
            <circle cx="15" cy="26" r="8" />
            <circle cx="12" cy="16" r="8" />
          </g>
        </svg>
      ))}
    </div>
  );
}
