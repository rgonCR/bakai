import type { UICard } from "@/lib/agent/types";
import type { ChatMessage } from "./types";

type StoredPart = {
  type: string;
  text?: string;
  ui?: UICard;
};

export type StoredMessage = {
  id: string;
  role: string;
  parts: StoredPart[] | null;
  created_at?: string;
};

export function hydrateChatMessages(rows: StoredMessage[]): ChatMessage[] {
  const out: ChatMessage[] = [];

  for (const row of rows) {
    if (row.role !== "user" && row.role !== "assistant") continue;
    const parts = Array.isArray(row.parts) ? row.parts : [];
    const text = parts
      .filter((p) => p.type === "text" && typeof p.text === "string")
      .map((p) => p.text!)
      .join("\n")
      .trim();

    const cards: UICard[] = [];
    const chipOptions: string[] = [];

    for (const part of parts) {
      if (part.type !== "ui" || !part.ui) continue;
      if (part.ui.type === "chips") {
        for (const opt of part.ui.props.options) {
          if (!chipOptions.includes(opt)) chipOptions.push(opt);
        }
        continue;
      }
      cards.push(part.ui);
    }

    out.push({
      id: row.id,
      role: row.role,
      content: text,
      cards: cards.length ? cards : undefined,
      chips: chipOptions.length ? chipOptions : undefined,
      questions: chipOptions.length
        ? [{ campo: "atalho", texto: "Sugestões", opcoes: chipOptions }]
        : undefined,
    });
  }

  return out;
}
