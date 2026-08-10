import type { Config } from "tailwindcss";

// Paleta definida en la Especificación Funcional v1.0.
// "Estos colores deberán poder modificarse fácilmente en el futuro" — todo vive acá,
// nada de valores sueltos en los componentes.
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        lavender: "#D3C5F6",
        velvet: "#3B2A60",
        background: "#FBFAFC",
        ink: "#241A33",
        muted: "#8A7FA0",
        border: "#E7E1F3",
        genero: {
          masculino: "#4A7A9D", // celeste oscuro
          femenino: "#E8998D", // rosa salmón
          indefinido: "#A3A3A3", // gris
        },
        estado: {
          confirmada: "#5B8C6E",
          pendiente: "#C9A24B",
          incompleta: "#B0664F",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
      },
      boxShadow: {
        soft: "0 2px 12px -4px rgba(59, 42, 96, 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
