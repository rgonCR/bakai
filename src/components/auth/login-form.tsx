"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  FormError,
  FormFieldBlock,
  FormShell,
  formInputClass,
} from "@/components/ui/form-shell";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("regdsdesign@gmail.com");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(undefined);
    try {
      const supabase = createClient();
      const { error: signError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signError) throw signError;
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <FormShell
      title="Entrar no bank.ai"
      subtitle="Usuário master de desenvolvimento (sandbox)."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormFieldBlock id="email" label="E-mail">
          <input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={formInputClass}
            disabled={loading}
            required
          />
        </FormFieldBlock>
        <FormFieldBlock id="password" label="Senha">
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={formInputClass}
            disabled={loading}
            required
          />
        </FormFieldBlock>
        {error ? <FormError message={error} /> : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-ia-primary px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </FormShell>
  );
}
