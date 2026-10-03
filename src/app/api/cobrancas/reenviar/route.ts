import { NextResponse } from "next/server";
import { prepararReenviarCobrancas } from "@/lib/pending/reenviar";
import { createClient } from "@/lib/supabase/server";

type Body = {
  conversationId?: string;
  cobranca_ids?: string[];
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const ids = (body.cobranca_ids ?? []).map((id) => id.trim()).filter(Boolean);
    if (ids.length === 0) {
      return NextResponse.json(
        { error: "Informe ao menos uma cobrança." },
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
      .select("id, asaas_key_enc")
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
          title: "Reenviar cobranças",
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

    const result = await prepararReenviarCobrancas({
      supabase,
      accountId: account.id as string,
      conversationId,
      input: { cobranca_ids: ids },
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error?.message_humana || "Falha ao preparar." },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      conversationId,
      ui: result.ui,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro ao preparar reenvio.",
      },
      { status: 500 },
    );
  }
}
