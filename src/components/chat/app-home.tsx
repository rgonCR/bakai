"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ensureSession } from "@/lib/auth/ensure-session";
import { AsaasOnboarding } from "@/components/onboarding/asaas-onboarding";
import { BankChat } from "@/components/chat/bank-chat";
import { GenerationStatus } from "@/components/chat/generation-status";

type AccountInfo = {
  id: string;
  nome: string | null;
  env: string;
  hasAsaasKey: boolean;
};

function AppHomeInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeConversationId = searchParams.get("c");
  const [booting, setBooting] = useState(true);
  const [bootError, setBootError] = useState<string>();
  const [account, setAccount] = useState<AccountInfo | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      setBooting(true);
      setBootError(undefined);
      try {
        await ensureSession();
        const res = await fetch("/api/account");
        if (res.status === 401) {
          router.replace("/login");
          return;
        }
        if (!res.ok) throw new Error("Não foi possível carregar a conta");
        const json = (await res.json()) as { account: AccountInfo | null };
        if (!cancelled) setAccount(json.account);
      } catch (error) {
        if (error instanceof Error && error.message === "NO_SESSION") {
          router.replace("/login");
          return;
        }
        if (!cancelled) {
          setBootError(
            error instanceof Error ? error.message : "Falha ao iniciar sessão",
          );
        }
      } finally {
        if (!cancelled) setBooting(false);
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, [router]);

  function handleConversationIdChange(id: string | undefined) {
    if (id) {
      router.replace(`/?c=${id}`, { scroll: false });
      return;
    }
    router.replace("/", { scroll: false });
  }

  if (booting) {
    return (
      <div className="flex h-full items-center justify-center bg-white">
        <GenerationStatus label="Preparando bank.ai" status="thinking" />
      </div>
    );
  }

  if (bootError) {
    return (
      <div className="flex h-full items-center justify-center bg-white px-6">
        <div className="max-w-md rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-medium">Não deu para iniciar</p>
          <p className="mt-2">{bootError}</p>
          <button
            type="button"
            className="mt-4 rounded-xl bg-ia-primary px-4 py-2 text-sm font-semibold text-white"
            onClick={() => router.replace("/login")}
          >
            Ir para login
          </button>
        </div>
      </div>
    );
  }

  if (!account?.hasAsaasKey) {
    return (
      <AsaasOnboarding
        onConnected={(next) =>
          setAccount({
            id: next.id,
            nome: next.nome,
            env: next.env,
            hasAsaasKey: true,
          })
        }
      />
    );
  }

  const firstName = account.nome?.trim().split(/\s+/)[0] || "Rafa";

  return (
    <BankChat
      userName={firstName}
      live
      activeConversationId={activeConversationId}
      onConversationIdChange={handleConversationIdChange}
    />
  );
}

export function AppHome() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center bg-white">
          <GenerationStatus label="Preparando bank.ai" status="thinking" />
        </div>
      }
    >
      <AppHomeInner />
    </Suspense>
  );
}
