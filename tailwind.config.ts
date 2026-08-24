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
        // Identidad visual Sakura: los valores viven sólo en :root de
        // globals.css; Tailwind sólo expone sus roles semánticos.
        sakura: {
          canvas: "rgb(var(--sakura-canvas) / <alpha-value>)",
          paper: "rgb(var(--sakura-paper) / <alpha-value>)",
          petal: "rgb(var(--sakura-petal) / <alpha-value>)",
          bloom: "rgb(var(--sakura-bloom) / <alpha-value>)",
          rose: "rgb(var(--sakura-rose) / <alpha-value>)",
          lavender: "rgb(var(--sakura-lavender) / <alpha-value>)",
          plum: "rgb(var(--sakura-plum) / <alpha-value>)",
          ink: "rgb(var(--sakura-ink) / <alpha-value>)",
          muted: "rgb(var(--sakura-muted) / <alpha-value>)",
          line: "rgb(var(--sakura-line) / <alpha-value>)",
          branch: "rgb(var(--sakura-branch) / <alpha-value>)",
        },
        lavender: "rgb(var(--sakura-lavender) / <alpha-value>)",
        velvet: "rgb(var(--sakura-plum) / <alpha-value>)",
        background: "rgb(var(--sakura-canvas) / <alpha-value>)",
        ink: "rgb(var(--sakura-ink) / <alpha-value>)",
        muted: "rgb(var(--sakura-muted) / <alpha-value>)",
        border: "rgb(var(--sakura-line) / <alpha-value>)",
        genero: {
          masculino: "rgb(var(--sakura-masculino) / <alpha-value>)",
          femenino: "rgb(var(--sakura-femenino) / <alpha-value>)",
          indefinido: "rgb(var(--sakura-indefinido) / <alpha-value>)",
        },
        estado: {
          confirmada: "rgb(var(--sakura-confirmada) / <alpha-value>)",
          pendiente: "rgb(var(--sakura-pendiente) / <alpha-value>)",
          incompleta: "rgb(var(--sakura-incompleta) / <alpha-value>)",
        },
      },
      fontFamily: {
        brand: ["var(--font-brand)", "cursive"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
      },
      boxShadow: {
        soft: "var(--sakura-shadow-soft)",
        "sakura-panel": "var(--sakura-shadow-panel)",
        "sakura-card": "var(--sakura-shadow-card)",
        "sakura-card-hover": "var(--sakura-shadow-card-hover)",
        "sakura-float": "var(--sakura-shadow-float)",
        "sakura-drawer": "var(--sakura-shadow-drawer)",
      },
    },
  },
  plugins: [],
};

export default config;
