import { Sidebar } from "./sidebar";
import { BottomNav } from "./bottom-nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Sidebar />
      <main className="md:pl-56 pb-16 md:pb-0 min-h-screen">{children}</main>
      <BottomNav />
    </>
  );
}
