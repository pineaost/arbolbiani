"use server";

import { createClient } from "@/lib/supabase/server";

export interface EstadoLogin {
  error: string | null;
  autenticado: boolean;
}

export async function iniciarSesion(
  _estadoAnterior: EstadoLogin,
  formData: FormData
): Promise<EstadoLogin> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return {
      error: "Ingresá tu correo y contraseña.",
      autenticado: false,
    };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user || !data.session) {
      return {
        error: "Correo o contraseña incorrectos.",
        autenticado: false,
      };
    }

    // No redirigir desde esta Server Action. En Next 14, redirect() intenta
    // obtener el RSC de destino dentro de la misma respuesta de la acción. Al
    // devolver primero, el navegador aplica Set-Cookie antes de que el cliente
    // solicite /arbol.
    return { error: null, autenticado: true };
  } catch (error) {
    console.error("Error inesperado al iniciar sesión:", error);
    return {
      error: "No se pudo iniciar sesión. Intentá nuevamente.",
      autenticado: false,
    };
  }
}
