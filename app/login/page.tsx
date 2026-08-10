import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-background">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-2xl text-velvet text-center mb-8">
          Árbol Biani
        </h1>

        <LoginForm />
      </div>
    </div>
  );
}
