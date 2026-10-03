import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  hydrateChatMessages,
  type StoredMessage,
} from "@/lib/chat/hydrate-messages";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sessão ausente." }, { status: 401 });
  }

  const { data: conversation, error: convError } = await supabase
    .from("conversations")
    .select("id, title, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (convError) {
    return NextResponse.json({ error: convError.message }, { status: 500 });
  }
  if (!conversation) {
    return NextResponse.json(
      { error: "Conversa não encontrada." },
      { status: 404 },
    );
  }

  const { data: rows, error: msgError } = await supabase
    .from("messages")
    .select("id, role, parts, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  if (msgError) {
    return NextResponse.json({ error: msgError.message }, { status: 500 });
  }

  const messages = hydrateChatMessages((rows ?? []) as StoredMessage[]);

  return NextResponse.json({
    conversation: {
      id: conversation.id as string,
      title: (conversation.title as string | null)?.trim() || "Nova conversa",
      createdAt: conversation.created_at as string,
      updatedAt: conversation.updated_at as string,
    },
    messages,
  });
}
