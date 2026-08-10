import { redirect } from "next/navigation";

export default function Home() {
  // El Árbol es la pantalla principal: "la mejor forma de navegar
  // toda la información" (Especificación Funcional, sección Árbol).
  redirect("/arbol");
}
