import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ conversations: [] }, { status: 401 });
  }

  const { data: account } = await supabase
    .from("accounts")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!account) {
    return NextResponse.json({ conversations: [] });
  }

  const { data, error } = await supabase
    .from("conversations")
    .select("id, title, created_at, updated_at")
    .eq("account_id", account.id)
    .order("updated_at", { ascending: false })
    .limit(12);

  if (error) {
    return NextResponse.json(
      { error: error.message, conversations: [] },
      { status: 500 },
    );
  }

  const conversationIds = (data ?? []).map((row) => row.id as string);
  const pendingIds = new Set<string>();
  if (conversationIds.length > 0) {
    const { data: pendings } = await supabase
      .from("pending_actions")
      .select("conversation_id")
      .eq("account_id", account.id)
      .eq("status", "pending")
      .in("conversation_id", conversationIds);
    for (const row of pendings ?? []) {
      if (row.conversation_id) pendingIds.add(row.conversation_id as string);
    }
  }

  return NextResponse.json({
    conversations: (data ?? []).map((row) => {
      const raw = (row.title as string | null)?.trim() || "Nova conversa";
      const title = raw.length > 32 ? `${raw.slice(0, 31)}…` : raw;
      return {
        id: row.id as string,
        title,
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
        hasPendingAction: pendingIds.has(row.id as string),
      };
    }),
  });
}
