import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Layouts y páginas de un mismo render pueden pedir la autenticación en
// paralelo. React.cache hace que compartan una sola verificación por request.
const obtenerAutenticacion = cache(async () => {
  const supabase = await createClient();

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    return { supabase, user, error };
  } catch (error) {
    // El middleware normalmente intercepta cookies inválidas. Esta defensa
    // evita que una ejecución directa del Server Component termine en un 500.
    console.error("No se pudo validar la sesión de Supabase:", error);
    return { supabase, user: null, error };
  }
});

export async function requerirUsuarioAutenticado() {
  const autenticacion = await obtenerAutenticacion();

  if (autenticacion.error || !autenticacion.user) {
    redirect("/login");
  }

  return {
    supabase: autenticacion.supabase,
    user: autenticacion.user,
  };
}
