import { NextResponse } from "next/server";
import type { AsaasEnv } from "@/lib/asaas/client";
import {
  looksLikeCpfCnpj,
  searchCustomers,
} from "@/lib/asaas/customers";
import { decryptAsaasKey } from "@/lib/crypto/asaas-key";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sessão ausente." }, { status: 401 });
  }

  const { data: account } = await supabase
    .from("accounts")
    .select("env, asaas_key_enc")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!account?.asaas_key_enc) {
    return NextResponse.json(
      { error: "Conta Asaas não conectada." },
      { status: 400 },
    );
  }

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  const apiKey = decryptAsaasKey(account.asaas_key_enc as string);
  const env = (account.env as AsaasEnv) || "sandbox";

  try {
    let customers;
    if (!q) {
      customers = await searchCustomers(apiKey, env, { limit: 12 });
    } else if (looksLikeCpfCnpj(q)) {
      customers = await searchCustomers(apiKey, env, {
        cpfCnpj: q,
        limit: 12,
      });
    } else {
      customers = await searchCustomers(apiKey, env, { name: q, limit: 12 });
    }

    return NextResponse.json({
      clientes: customers.map((c) => ({
        id: c.id,
        nome: c.name || c.id,
        cpf_cnpj: c.cpfCnpj || "",
        email: c.email || "",
        telefone: c.mobilePhone || c.phone || "",
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Falha ao buscar clientes.",
        clientes: [],
      },
      { status: 502 },
    );
  }
}
