import type { UICard } from "@/lib/agent/types";
import { chatEndpoint } from "./agent-endpoints";
import { agentAuthHeaders } from "./auth-headers";
import type { ChatMessage } from "./types";

type SseEvent =
  | { type: "status"; label: string }
  | {
      type: "message";
      role: "assistant";
      content: string;
      parts: Array<{ type: string; text?: string; ui?: UICard }>;
    }
  | { type: "conversation"; id: string }
  | { type: "error"; message: string }
  | { type: "done" };

export async function streamChatMessage(opts: {
  message: string;
  conversationId?: string;
  onStatus?: (label: string) => void;
  onConversation?: (id: string) => void;
}): Promise<ChatMessage> {
  const headers = await agentAuthHeaders();
  const res = await fetch(chatEndpoint(), {
    method: "POST",
    headers,
    body: JSON.stringify({
      message: opts.message,
      conversationId: opts.conversationId,
    }),
  });

  if (!res.ok || !res.body) {
    const text = await res.text();
    throw new Error(text || `Chat HTTP ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let assistant: ChatMessage | null = null;
  let errorMessage: string | undefined;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";

    for (const chunk of chunks) {
      const line = chunk.split("\n").find((l) => l.startsWith("data: "));
      if (!line) continue;
      const event = JSON.parse(line.slice(6)) as SseEvent;

      if (event.type === "status") opts.onStatus?.(event.label);
      if (event.type === "conversation") opts.onConversation?.(event.id);
      if (event.type === "error") errorMessage = event.message;
      if (event.type === "message") {
        const cards: UICard[] = [];
        const chipOptions: string[] = [];

        for (const part of event.parts) {
          if (part.type !== "ui" || !part.ui) continue;
          if (part.ui.type === "chips") {
            for (const opt of part.ui.props.options) {
              if (!chipOptions.includes(opt)) chipOptions.push(opt);
            }
            continue;
          }
          cards.push(part.ui);
        }

        assistant = {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: event.content,
          cards,
          chips: chipOptions.length ? chipOptions : undefined,
          questions: chipOptions.length
            ? [{ campo: "atalho", texto: "Sugestões", opcoes: chipOptions }]
            : undefined,
        };
      }
    }
  }

  if (errorMessage) throw new Error(errorMessage);
  if (!assistant) throw new Error("Resposta vazia do agente");
  return assistant;
}
