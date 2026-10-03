import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string }> };

type Body = {
  role?: "user" | "assistant" | "system";
  parts?: unknown[];
  text?: string;
};

/** Append de mensagem para auditoria (wizard / confirmação) sem passar pelo LLM. */
export async function POST(request: Request, { params }: Params) {
  try {
    const { id: conversationId } = await params;
    const body = (await request.json()) as Body;
    const role = body.role ?? "user";
    const parts =
      body.parts ??
      (body.text?.trim()
        ? [{ type: "text", text: body.text.trim() }]
        : null);

    if (!parts || !Array.isArray(parts) || parts.length === 0) {
      return NextResponse.json(
        { error: "Mensagem vazia." },
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

    const { data: conversation } = await supabase
      .from("conversations")
      .select("id, account_id")
      .eq("id", conversationId)
      .maybeSingle();

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversa não encontrada." },
        { status: 404 },
      );
    }

    const { data: account } = await supabase
      .from("accounts")
      .select("id")
      .eq("id", conversation.account_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!account) {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }

    const { data: row, error } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        role,
        parts,
      })
      .select("id, role, parts, created_at")
      .single();

    if (error || !row) {
      return NextResponse.json(
        { error: error?.message || "Falha ao gravar mensagem." },
        { status: 500 },
      );
    }

    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId);

    return NextResponse.json({
      ok: true,
      message: {
        id: row.id as string,
        role: row.role as string,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Erro ao gravar mensagem.",
      },
      { status: 500 },
    );
  }
}
