import type { ModelMessage } from "ai";
import type { StoredMessage } from "./hydrate-messages";

/** Extrai texto de parts jsonb para o histórico do LLM. */
export function toModelMessages(
  rows: StoredMessage[],
  opts?: { limit?: number },
): ModelMessage[] {
  const limit = opts?.limit ?? 20;
  const out: ModelMessage[] = [];

  for (const row of rows) {
    if (row.role !== "user" && row.role !== "assistant") continue;
    const parts = Array.isArray(row.parts) ? row.parts : [];
    const text = parts
      .filter((p) => p.type === "text" && typeof p.text === "string")
      .map((p) => p.text!)
      .join("\n")
      .trim();
    if (!text) continue;
    out.push({ role: row.role, content: text });
  }

  return out.slice(-limit);
}
