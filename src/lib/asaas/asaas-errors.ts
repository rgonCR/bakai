import type { ToolErrorCode, ToolResult } from "@/lib/agent/types";
import { AsaasError } from "./client";

export type MappedAsaasError = {
  code: ToolErrorCode;
  message_humana: string;
};

const FALLBACKS: Record<string, string> = {
  saldo: "Não consegui consultar o saldo agora.",
  extrato: "Não consegui carregar o extrato agora.",
  conta: "Não consegui consultar os dados da conta agora.",
  cobrancas: "Não consegui listar as cobranças agora.",
  cobranca: "Não consegui preparar a cobrança. Tente de novo.",
  pix: "Não consegui preparar o Pix. Tente de novo.",
  boleto: "Não consegui simular este boleto no Asaas.",
  pagamento_boleto: "Não consegui preparar o pagamento. Tente de novo.",
  reenviar: "Não consegui preparar o reenvio. Tente de novo.",
  cliente: "Não consegui buscar o cliente agora.",
  relatorio: "Não consegui montar o relatório agora.",
  generico: "Algo deu errado no Asaas. Tente de novo em instantes.",
};

function extractAsaasDescriptions(body: unknown): string[] {
  if (!body || typeof body !== "object") return [];
  const errors = (body as { errors?: Array<{ code?: string; description?: string }> })
    .errors;
  if (!Array.isArray(errors)) return [];
  return errors
    .map((e) => e.description?.trim())
    .filter((d): d is string => Boolean(d));
}

function extractAsaasCodes(body: unknown): string[] {
  if (!body || typeof body !== "object") return [];
  const errors = (body as { errors?: Array<{ code?: string }> }).errors;
  if (!Array.isArray(errors)) return [];
  return errors
    .map((e) => e.code?.trim())
    .filter((c): c is string => Boolean(c));
}

/**
 * Mapeia erros da API Asaas (ou genéricos) para `{ code, message_humana }`.
 * Prefira sempre esta função em catch de tools/pending/execute.
 */
export function mapAsaasError(
  error: unknown,
  fallbackKey: keyof typeof FALLBACKS = "generico",
): MappedAsaasError {
  const fallback = FALLBACKS[fallbackKey] ?? FALLBACKS.generico;

  if (error instanceof AsaasError) {
    const status = error.status;
    const descriptions = extractAsaasDescriptions(error.body);
    const codes = extractAsaasCodes(error.body);
    const raw = descriptions.join("; ") || error.message;

    if (status === 429) {
      return {
        code: "RATE_LIMIT",
        message_humana:
          "O Asaas está pedindo um pouco de calma. Tente de novo em alguns segundos.",
      };
    }

    if (
      status === 404 ||
      codes.some((c) => /not[_]?found|does_not_exist/i.test(c)) ||
      /não encontrad|not found|does not exist/i.test(raw)
    ) {
      return {
        code: "NOT_FOUND",
        message_humana: "Não encontrei esse registro no Asaas.",
      };
    }

    if (
      codes.some((c) => /insufficient|balance|saldo/i.test(c)) ||
      /saldo insuficiente|insufficient.?balance|balance.?insufficient/i.test(
        raw,
      )
    ) {
      return {
        code: "INSUFFICIENT_BALANCE",
        message_humana:
          "Saldo insuficiente para concluir esta operação.",
      };
    }

    if (
      status === 400 ||
      status === 422 ||
      codes.some((c) => /invalid|validation|required/i.test(c))
    ) {
      // Mensagens Asaas de validação costumam ser legíveis; limpa jargão óbvio
      const humana = humanizeAsaasDescription(raw) || fallback;
      return { code: "VALIDATION", message_humana: humana };
    }

    return {
      code: "ASAAS_ERROR",
      message_humana: humanizeAsaasDescription(raw) || fallback,
    };
  }

  if (error instanceof Error) {
    const msg = error.message;
    if (/saldo insuficiente|insufficient.?balance/i.test(msg)) {
      return {
        code: "INSUFFICIENT_BALANCE",
        message_humana: "Saldo insuficiente para concluir esta operação.",
      };
    }
    if (/rate.?limit|429|too many/i.test(msg)) {
      return {
        code: "RATE_LIMIT",
        message_humana:
          "O Asaas está pedindo um pouco de calma. Tente de novo em alguns segundos.",
      };
    }
    // Evita vazar stack/URLs; mensagens curtas do AsaasError já passam acima
    if (msg && msg.length < 200 && !msg.includes(" at ")) {
      return {
        code: "ASAAS_ERROR",
        message_humana: humanizeAsaasDescription(msg) || fallback,
      };
    }
  }

  return { code: "ASAAS_ERROR", message_humana: fallback };
}

function humanizeAsaasDescription(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  // Alguns códigos genéricos do sandbox
  if (/^error$/i.test(t) || t === "Asaas HTTP 400") {
    return "O Asaas recusou a operação. Revise os dados e tente de novo.";
  }
  if (/^Asaas HTTP \d+$/i.test(t)) {
    return "O Asaas não respondeu como esperado. Tente de novo em instantes.";
  }
  return t;
}

/** Atalho para ToolResult de erro. */
export function toolErrorFromAsaas<T = unknown>(
  error: unknown,
  fallbackKey: keyof typeof FALLBACKS = "generico",
): ToolResult<T> {
  return { ok: false, error: mapAsaasError(error, fallbackKey) };
}

/** Mensagem humana para rotas /execute que devolvem `{ ok: false, message }`. */
export function asaasErrorMessage(
  error: unknown,
  fallbackKey: keyof typeof FALLBACKS = "generico",
): string {
  return mapAsaasError(error, fallbackKey).message_humana;
}

export function insufficientBalanceMessage(
  saldo: number,
  pedido: number,
): MappedAsaasError {
  const brl = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  return {
    code: "INSUFFICIENT_BALANCE",
    message_humana: `Saldo insuficiente. Você tem ${brl(saldo)} e pediu ${brl(pedido)}.`,
  };
}
