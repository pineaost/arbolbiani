"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setError(null);
    setCargando(true);

    const supabase = createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setCargando(false);

    if (error) {
      setError("Correo o contraseña incorrectos.");
      return;
    }

    router.replace("/arbol");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-2xl border border-border bg-sakura-paper p-6 shadow-sakura-float"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm text-ink/70">
          Correo electrónico
        </label>

        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-ink outline-none focus:border-velvet transition-colors"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm text-ink/70">
          Contraseña
        </label>

        <input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-ink outline-none focus:border-velvet transition-colors"
        />
      </div>

      {error && (
        <p className="text-xs text-estado-incompleta">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={cargando}
        className="mt-2 rounded-xl bg-velvet px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {cargando ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
