"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface EstadoLogin {
  error: string | null;
}

export async function iniciarSesion(
  _estadoAnterior: EstadoLogin,
  formData: FormData
): Promise<EstadoLogin> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Ingresá tu correo y contraseña." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session) {
    return { error: "Correo o contraseña incorrectos." };
  }

  // La Server Action escribe primero las cookies de Supabase en la respuesta.
  // Recién entonces invalida el árbol de layouts y emite el redirect 303.
  revalidatePath("/", "layout");
  redirect("/arbol");
}
