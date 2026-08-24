import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-background">
      <div className="w-full max-w-sm">
        <h1 className="mb-8 text-center font-brand text-3xl font-bold leading-none text-velvet">
          Árbol Biani
        </h1>

        <LoginForm />
      </div>
    </div>
  );
}
