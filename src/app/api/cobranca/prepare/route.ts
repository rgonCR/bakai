import { NextResponse } from "next/server";
import { decryptAsaasKey } from "@/lib/crypto/asaas-key";
import type { AsaasEnv } from "@/lib/asaas/client";
import {
  prepararCobranca,
  type PrepararCobrancaInput,
} from "@/lib/pending/cobranca";
import { createClient } from "@/lib/supabase/server";

type Body = {
  conversationId?: string;
  cliente?: string;
  cliente_id?: string;
  cpf_cnpj?: string;
  criar_cliente?: boolean;
  valor?: number;
  vencimento?: string;
  forma?: PrepararCobrancaInput["forma"];
  email?: string;
  telefone?: string;
  descricao?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    if (!body.cliente?.trim() && !body.cliente_id?.trim()) {
      return NextResponse.json(
        { error: "Cliente é obrigatório." },
        { status: 400 },
      );
    }
    if (!(typeof body.valor === "number" && body.valor > 0)) {
      return NextResponse.json(
        { error: "Valor é obrigatório." },
        { status: 400 },
      );
    }
    if (!body.vencimento?.trim()) {
      return NextResponse.json(
        { error: "Vencimento é obrigatório." },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Sessão ausente." }, { status: 401 });
    }

    const { data: account } = await supabase
      .from("accounts")
      .select("id, env, asaas_key_enc")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!account?.asaas_key_enc) {
      return NextResponse.json(
        { error: "Conta Asaas não conectada." },
        { status: 400 },
      );
    }

    let conversationId = body.conversationId ?? null;
    if (!conversationId) {
      const { data: conv, error } = await supabase
        .from("conversations")
        .insert({
          account_id: account.id,
          title: `Cobrança ${body.cliente ?? ""}`.slice(0, 80),
        })
        .select("id")
        .single();
      if (error || !conv) {
        return NextResponse.json(
          { error: "Falha ao criar conversa." },
          { status: 500 },
        );
      }
      conversationId = conv.id as string;
    }

    const apiKey = decryptAsaasKey(account.asaas_key_enc as string);
    const env = (account.env as AsaasEnv) || "sandbox";

    const result = await prepararCobranca({
      supabase,
      accountId: account.id as string,
      conversationId,
      apiKey,
      env,
      input: {
        cliente: body.cliente?.trim() || "Cliente",
        cliente_id: body.cliente_id,
        cpf_cnpj: body.cpf_cnpj,
        criar_cliente: body.criar_cliente,
        valor: body.valor,
        vencimento: body.vencimento,
        tipo: "avulsa",
        forma: body.forma ?? "UNDEFINED",
        email: body.email,
        telefone: body.telefone,
        descricao: body.descricao,
      },
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error?.message_humana || "Falha ao preparar." },
        { status: 400 },
      );
    }

    if (result.ui?.type === "escolha") {
      return NextResponse.json(
        {
          ok: false,
          error: "Há mais de um cliente com esse nome. Escolha no chat.",
          ui: result.ui,
        },
        { status: 409 },
      );
    }

    const pendingId =
      result.data &&
      typeof result.data === "object" &&
      "pending_action_id" in result.data
        ? String(
            (result.data as { pending_action_id: string }).pending_action_id,
          )
        : undefined;

    if (!pendingId) {
      return NextResponse.json(
        { error: "Pending action não criada." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      pending_action_id: pendingId,
      conversationId,
      ui: result.ui,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Erro ao preparar cobrança.",
      },
      { status: 500 },
    );
  }
}
