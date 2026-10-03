import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ia-canvas px-4 py-10">
      <div className="w-full max-w-md">
        <LoginForm />
      </div>
    </div>
  );
}
