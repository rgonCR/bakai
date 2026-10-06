import type { AsaasEnv } from "./client";
import { decryptAsaasKey } from "@/lib/crypto/asaas-key";
import { createClient } from "@/lib/supabase/server";

/** Resolve conta + chave Asaas do usuário autenticado. */
export async function requireAsaasAccount() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Sessão ausente." as const, status: 401 as const };
  }

  const { data: account } = await supabase
    .from("accounts")
    .select("id, env, asaas_key_enc")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!account?.asaas_key_enc) {
    return {
      error: "Conta Asaas não conectada." as const,
      status: 400 as const,
    };
  }

  return {
    user,
    accountId: account.id as string,
    env: ((account.env as AsaasEnv) || "sandbox") as AsaasEnv,
    apiKey: decryptAsaasKey(account.asaas_key_enc as string),
  };
}
