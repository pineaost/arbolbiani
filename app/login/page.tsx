import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-background">
      <div className="w-full max-w-sm">
        <h1 className="mb-10 text-center font-brand text-6xl font-bold leading-[1.05] tracking-[-0.035em] text-velvet">
          Árbol Biani
        </h1>

        <LoginForm />
      </div>
    </div>
  );
}
