"use client";

import { useState } from "react";
import {
  FormError,
  FormFieldBlock,
  FormShell,
  FormTip,
  formInputClass,
} from "@/components/ui/form-shell";

type AsaasOnboardingProps = {
  onConnected: (account: {
    id: string;
    nome: string | null;
    env: string;
  }) => void;
};

export function AsaasOnboarding({ onConnected }: AsaasOnboardingProps) {
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(undefined);
    try {
      const res = await fetch("/api/onboarding/asaas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      const json = (await res.json()) as {
        error?: string;
        account?: { id: string; nome: string | null; env: string };
      };
      if (!res.ok || !json.account) {
        throw new Error(json.error || "Falha ao conectar");
      }
      onConnected(json.account);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao conectar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full items-center justify-center overflow-y-auto bg-white px-4 py-10">
      <div className="w-full max-w-lg">
        <FormShell
          title="Conectar Asaas sandbox"
          subtitle="Cole a API key de sandbox. Validamos com /myAccount e guardamos criptografada — ela nunca vai para o LLM."
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormTip>
              Use só sandbox neste MVP. Crie a chave em{" "}
              <a
                className="underline"
                href="https://sandbox.asaas.com"
                target="_blank"
                rel="noreferrer"
              >
                sandbox.asaas.com
              </a>
              .
            </FormTip>
            <FormFieldBlock
              id="asaas-key"
              label="API key"
              hint="Começa com $aact_… — permissões mínimas."
            >
              <input
                id="asaas-key"
                type="password"
                autoComplete="off"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="$aact_hmlg_…"
                className={formInputClass}
                disabled={loading}
              />
            </FormFieldBlock>
            {error ? <FormError message={error} /> : null}
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={loading || !apiKey.trim()}
                className="rounded-xl bg-ia-primary px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Validando…" : "Conectar e começar"}
              </button>
            </div>
          </form>
        </FormShell>
      </div>
    </div>
  );
}
