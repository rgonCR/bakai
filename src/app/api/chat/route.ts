import { NextResponse } from "next/server";
import { decryptAsaasKey } from "@/lib/crypto/asaas-key";
import type { AsaasEnv } from "@/lib/asaas/client";
import { runAgentTurn } from "@/lib/agent/run-agent";
import type { StoredMessage } from "@/lib/chat/hydrate-messages";
import { toModelMessages } from "@/lib/chat/to-model-messages";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Body = {
  message?: string;
  conversationId?: string;
};

type SseEvent =
  | { type: "status"; label: string }
  | { type: "message"; role: "assistant"; content: string; parts: unknown[] }
  | { type: "conversation"; id: string }
  | { type: "error"; message: string }
  | { type: "done" };

function encodeSse(event: SseEvent) {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(request: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: SseEvent) => {
        controller.enqueue(encoder.encode(encodeSse(event)));
      };

      try {
        const body = (await request.json()) as Body;
        const message = body.message?.trim();
        if (!message) {
          send({ type: "error", message: "Mensagem vazia." });
          send({ type: "done" });
          controller.close();
          return;
        }

        const supabase = await createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          send({ type: "error", message: "Sessão ausente." });
          send({ type: "done" });
          controller.close();
          return;
        }

        const { data: account } = await supabase
          .from("accounts")
          .select("id, env, nome, asaas_key_enc")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!account?.asaas_key_enc) {
          send({
            type: "error",
            message: "Conecte sua API key do Asaas sandbox primeiro.",
          });
          send({ type: "done" });
          controller.close();
          return;
        }

        let conversationId = body.conversationId ?? null;
        if (!conversationId) {
          const { data: conv, error } = await supabase
            .from("conversations")
            .insert({
              account_id: account.id,
              title: message.slice(0, 80),
            })
            .select("id")
            .single();
          if (error || !conv) throw error ?? new Error("Falha ao criar conversa");
          conversationId = conv.id as string;
          send({ type: "conversation", id: conversationId });
        }

        if (!conversationId) throw new Error("Conversa inválida");

        // histórico antes da mensagem atual
        const { data: priorRows } = await supabase
          .from("messages")
          .select("id, role, parts, created_at")
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: true })
          .limit(40);

        await supabase.from("messages").insert({
          conversation_id: conversationId,
          role: "user",
          parts: [{ type: "text", text: message }],
        });

        const history = [
          ...toModelMessages((priorRows ?? []) as StoredMessage[], {
            limit: 18,
          }),
          { role: "user" as const, content: message },
        ];

        const apiKey = decryptAsaasKey(account.asaas_key_enc);
        const env = (account.env as AsaasEnv) || "sandbox";
        const started = Date.now();
        const firstName =
          account.nome?.trim().split(/\s+/)[0] ||
          user.email?.split("@")[0] ||
          "você";

        const { reply, results, model } = await runAgentTurn({
          message,
          history,
          asaasApiKey: apiKey,
          asaasEnv: env,
          userName: firstName,
          empresa: account.nome || "sua empresa",
          accountId: account.id as string,
          conversationId,
          supabase,
          onStatus: (label) => send({ type: "status", label }),
        });

        for (const result of results) {
          const toolName =
            result.ui?.type === "saldo"
              ? "get_saldo"
              : result.ui?.type === "extrato"
                ? "get_extrato"
                : result.ui?.type === "dados_conta"
                  ? "get_dados_conta"
                  : result.ui?.type === "task_draft"
                  ? "abrir_cobranca"
                  : result.ui?.type === "confirmacao" ||
                      result.ui?.type === "escolha"
                    ? "preparar_cobranca"
                    : result.ui?.type === "chips"
                      ? "chips"
                      : "intent";
          if (toolName === "chips") continue;
          await supabase.from("tool_logs").insert({
            account_id: account.id,
            conversation_id: conversationId,
            tool_name: toolName,
            request: { message, model },
            response: result.ok ? result.data : result.error,
            latency_ms: Date.now() - started,
            error: result.ok ? null : result.error?.message_humana,
          });
        }

        const parts = [
          { type: "text", text: reply },
          ...results
            .filter((r) => r.ui)
            .map((r) => ({ type: "ui", ui: r.ui })),
        ];

        await supabase.from("messages").insert({
          conversation_id: conversationId,
          role: "assistant",
          parts,
        });

        await supabase
          .from("conversations")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", conversationId);

        send({
          type: "message",
          role: "assistant",
          content: reply,
          parts,
        });
        send({ type: "done" });
        controller.close();
      } catch (error) {
        const raw =
          error instanceof Error ? error.message : "Erro no chat";
        const message = /quota|rate.?limit|RESOURCE_EXHAUSTED|exceeded your current quota/i.test(
          raw,
        )
          ? "A cota free do Gemini desta API key esgotou. O saldo pago precisa estar no mesmo projeto da chave em AI Studio → Billing. Gere uma key no projeto pago, atualize GEMINI_API_KEY no .env.local e reinicie o dev server."
          : raw;
        send({ type: "error", message });
        send({ type: "done" });
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
