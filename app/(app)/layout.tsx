import { AppShell } from "@/components/nav/app-shell";
import { requerirUsuarioAutenticado } from "@/lib/supabase/auth";

export default async function AuthenticatedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requerirUsuarioAutenticado();

  return <AppShell>{children}</AppShell>;
}
