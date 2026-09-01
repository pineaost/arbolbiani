"use client";

import { useFormState, useFormStatus } from "react-dom";
import { iniciarSesion } from "@/app/login/actions";

const estadoInicial = { error: null as string | null };

export function LoginForm() {
  const [estado, accion] = useFormState(iniciarSesion, estadoInicial);

  return (
    <form
      action={accion}
      className="flex flex-col gap-4 rounded-2xl border border-border bg-sakura-paper p-6 shadow-sakura-float"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm text-ink/70">
          Correo electrónico
        </label>

        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-ink outline-none focus:border-velvet transition-colors"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm text-ink/70">
          Contraseña
        </label>

        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-ink outline-none focus:border-velvet transition-colors"
        />
      </div>

      {estado.error && (
        <p className="text-xs text-estado-incompleta" role="alert" aria-live="polite">
          {estado.error}
        </p>
      )}

      <BotonEntrar />
    </form>
  );
}

function BotonEntrar() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="mt-2 rounded-xl bg-velvet px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "Entrando..." : "Entrar"}
    </button>
  );
}
