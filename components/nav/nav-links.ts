import type { LucideIcon } from "lucide-react";
import { TreeDeciduous, FolderOpen, NotebookText } from "lucide-react";

export interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
  // El Árbol tiene siempre mayor jerarquía visual (ver Navegación general).
  principal?: boolean;
}

export const navLinks: NavLink[] = [
  { href: "/arbol", label: "Árbol", icon: TreeDeciduous, principal: true },
  { href: "/archivo", label: "Archivo Familiar", icon: FolderOpen },
  { href: "/bitacora", label: "Bitácora", icon: NotebookText },
];
