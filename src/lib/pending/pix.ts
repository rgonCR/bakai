import { randomUUID } from "crypto";
import { z } from "zod";
import type { AsaasEnv } from "@/lib/asaas/client";
import { asaasFetch, type AsaasBalance } from "@/lib/asaas/client";
import {
  createPixTransfer,
  inferPixKeyType,
  type PixKeyType,
} from "@/lib/asaas/transfers";
import {
  isSandboxPixDestino,
  SANDBOX_PIX_CHAVE_PADRAO,
} from "@/lib/asaas/sandbox-pix";
import {
  asaasErrorMessage,
  insufficientBalanceMessage,
  mapAsaasError,
} from "@/lib/asaas/asaas-errors";
import type { ToolResult, UICard } from "@/lib/agent/types";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export const prepararPixInputSchema = z.object({
  chave: z.string().min(3).describe("Chave Pix do destinatário"),
  tipo_chave: z
    .enum(["CPF", "CNPJ", "EMAIL", "PHONE", "EVP"])
    .optional()
    .describe("Tipo da chave; se omitido, infere"),
  valor: z.number().positive().describe("Valor em reais"),
  descricao: z.string().optional(),
  agendar_para: z
    .string()
    .optional()
    .describe("YYYY-MM-DD para agendar (opcional)"),
});

export type PrepararPixInput = z.infer<typeof prepararPixInputSchema>;

export type PixPayload = {
  chave: string;
  tipo_chave: PixKeyType;
  valor: number;
  descricao?: string;
  agendar_para?: string;
  editaveis: string[];
};

function brl(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDateBr(ymd: string) {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return ymd;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export async function prepararPix(opts: {
  supabase: Supabase;
  accountId: string;
  conversationId: string;
  apiKey: string;
  env: AsaasEnv;
  input: PrepararPixInput;
}): Promise<ToolResult> {
  const chave = opts.input.chave.trim();
  // Chaves BACEN de homologação são e-mail (@pix.bcb.gov.br)
  const tipo: PixKeyType | undefined =
    opts.input.tipo_chave ??
    (isSandboxPixDestino(chave) && chave.includes("@")
      ? "EMAIL"
      : isSandboxPixDestino(chave)
        ? "CPF"
        : (inferPixKeyType(chave) ?? undefined));

  if (!tipo) {
    return {
      ok: false,
      error: {
        code: "VALIDATION",
        message_humana:
          opts.env === "sandbox"
            ? `Não reconheci a chave Pix. No sandbox, teste com ${SANDBOX_PIX_CHAVE_PADRAO}.`
            : "Não reconheci o tipo da chave Pix. Me diga se é CPF, CNPJ, e-mail, telefone ou aleatória.",
      },
    };
  }

  if (!(opts.input.valor > 0)) {
    return {
      ok: false,
      error: {
        code: "VALIDATION",
        message_humana: "Informe um valor maior que zero.",
      },
    };
  }

  try {
    const balance = await asaasFetch<AsaasBalance>(
      opts.apiKey,
      opts.env,
      "/finance/balance",
    );
    if (balance.balance < opts.input.valor) {
      return {
        ok: false,
        error: insufficientBalanceMessage(balance.balance, opts.input.valor),
      };
    }
  } catch {
    // segue — execute valida de novo
  }

  const payload: PixPayload = {
    chave,
    tipo_chave: tipo,
    valor: opts.input.valor,
    descricao: opts.input.descricao?.trim() || undefined,
    agendar_para: opts.input.agendar_para?.trim() || undefined,
    editaveis: ["valor"],
  };

  await opts.supabase
    .from("pending_actions")
    .update({ status: "cancelled" })
    .eq("conversation_id", opts.conversationId)
    .eq("type", "preparar_pix")
    .eq("status", "pending");

  const { data: pending, error } = await opts.supabase
    .from("pending_actions")
    .insert({
      account_id: opts.accountId,
      conversation_id: opts.conversationId,
      type: "preparar_pix",
      payload,
      status: "pending",
      idempotency_key: `pix:${opts.accountId}:${opts.conversationId}:${randomUUID()}`,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    })
    .select("id")
    .single();

  if (error || !pending) {
    return {
      ok: false,
      error: {
        code: "ASAAS_ERROR",
        message_humana: "Não consegui preparar o Pix. Tente de novo.",
      },
    };
  }

  const ui: UICard = {
    type: "confirmacao",
    props: {
      pending_action_id: pending.id as string,
      titulo: "Enviar Pix",
      linhas: [
        { label: "Chave", valor: chave },
        { label: "Tipo", valor: tipo },
        { label: "Valor", valor: brl(payload.valor) },
        ...(payload.agendar_para
          ? [
              {
                label: "Agendado para",
                valor: formatDateBr(payload.agendar_para),
              },
            ]
          : []),
        ...(payload.descricao
          ? [{ label: "Descrição", valor: payload.descricao }]
          : []),
      ],
      editaveis: payload.editaveis,
      cta: `Confirmar Pix de ${brl(payload.valor)}`,
    },
  };

  return {
    ok: true,
    data: { pending_action_id: pending.id, payload },
    ui,
  };
}

function sucessoPixUi(opts: {
  id: string;
  valor: number;
  status: string;
  chave: string;
  simulado?: boolean;
}): UICard {
  return {
    type: "sucesso",
    props: {
      titulo: opts.simulado ? "Pix simulado (sandbox)" : "Pix enviado",
      linhas: [
        { label: "ID", valor: opts.id },
        { label: "Valor", valor: brl(opts.valor) },
        { label: "Status", valor: opts.status },
        { label: "Chave", valor: opts.chave },
        ...(opts.simulado
          ? [
              {
                label: "Obs",
                valor:
                  "Asaas Pix out indisponível — fluxo confirmado só no bank.ai (saldo Asaas não debitado).",
              },
            ]
          : []),
      ],
    },
  };
}

export async function executePix(opts: {
  apiKey: string;
  env: AsaasEnv;
  payload: PixPayload;
}): Promise<
  { ok: true; ui: UICard; result: unknown } | { ok: false; message: string }
> {
  try {
    const transfer = await createPixTransfer(opts.apiKey, opts.env, {
      value: opts.payload.valor,
      pixAddressKey: opts.payload.chave,
      pixAddressKeyType: opts.payload.tipo_chave,
      description: opts.payload.descricao,
      scheduleDate: opts.payload.agendar_para,
    });

    return {
      ok: true,
      ui: sucessoPixUi({
        id: transfer.id,
        valor: transfer.value,
        status: transfer.status,
        chave: opts.payload.chave,
      }),
      result: transfer,
    };
  } catch (error) {
    const mapped = mapAsaasError(error, "pix");
    if (mapped.code === "INSUFFICIENT_BALANCE") {
      return { ok: false, message: mapped.message_humana };
    }

    // Sandbox Asaas tem recusado Pix out (400 genérico) mesmo com chaves BACEN.
    // Mantém o fluxo do MVP demonstrável sem inventar débito no Asaas.
    if (opts.env === "sandbox") {
      try {
        const balance = await asaasFetch<AsaasBalance>(
          opts.apiKey,
          opts.env,
          "/finance/balance",
        );
        if (balance.balance < opts.payload.valor) {
          return {
            ok: false,
            message: insufficientBalanceMessage(
              balance.balance,
              opts.payload.valor,
            ).message_humana,
          };
        }
      } catch {
        // segue com simulação
      }

      const message = asaasErrorMessage(error, "pix");
      const simId = `sim_pix_${Date.now().toString(36)}`;
      const result = {
        id: simId,
        value: opts.payload.valor,
        status: "DONE",
        simulated: true,
        pixAddressKey: opts.payload.chave,
        asaas_error: message,
      };
      return {
        ok: true,
        ui: sucessoPixUi({
          id: simId,
          valor: opts.payload.valor,
          status: "DONE (simulado)",
          chave: opts.payload.chave,
          simulado: true,
        }),
        result,
      };
    }

    return { ok: false, message: mapped.message_humana };
  }
}
