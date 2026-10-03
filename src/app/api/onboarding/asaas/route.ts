import { NextResponse } from "next/server";
import { encryptAsaasKey } from "@/lib/crypto/asaas-key";
import { asaasFetch, type AsaasAccount, type AsaasEnv } from "@/lib/asaas/client";
import { createClient } from "@/lib/supabase/server";

type Body = {
  apiKey?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const apiKey = body.apiKey?.trim();
    if (!apiKey) {
      return NextResponse.json({ error: "Informe a API key do Asaas." }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Sessão ausente. Recarregue a página." }, { status: 401 });
    }

    let env: AsaasEnv = "sandbox";
    let account: AsaasAccount;

    try {
      account = await asaasFetch<AsaasAccount>(apiKey, "sandbox", "/myAccount");
      env = "sandbox";
    } catch {
      account = await asaasFetch<AsaasAccount>(apiKey, "production", "/myAccount");
      env = "production";
    }

    if (env === "production") {
      return NextResponse.json(
        {
          error:
            "Este MVP aceita só sandbox. Gere uma chave em https://sandbox.asaas.com e tente de novo.",
        },
        { status: 400 },
      );
    }

    const enc = encryptAsaasKey(apiKey);

    const { data, error } = await supabase
      .from("accounts")
      .upsert(
        {
          user_id: user.id,
          asaas_key_enc: enc,
          env,
          wallet_id: account.walletId ?? null,
          nome: account.name ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      )
      .select("id, env, nome, wallet_id")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      account: {
        id: data.id,
        env: data.env,
        nome: data.nome,
        walletId: data.wallet_id,
        hasAsaasKey: true,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha ao validar a chave Asaas";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
