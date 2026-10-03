import { randomUUID } from "crypto";
import { z } from "zod";
import type { AsaasEnv } from "@/lib/asaas/client";
import {
  createBillPayment,
  normalizeLinhaDigitavel,
  simulateBill,
} from "@/lib/asaas/bills";
import type { ToolResult, UICard } from "@/lib/agent/types";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export const prepararPagamentoBoletoInputSchema = z.object({
  linha_digitavel: z
    .string()
    .min(10)
    .describe("Linha digitável ou código de barras do boleto"),
  agendar_para: z
    .string()
    .optional()
    .describe("YYYY-MM-DD opcional para agendar"),
  descricao: z.string().optional(),
});

export type PrepararPagamentoBoletoInput = z.infer<
  typeof prepararPagamentoBoletoInputSchema
>;

export type BoletoPayload = {
  linha_digitavel: string;
  valor: number;
  vencimento?: string;
  beneficiario?: string;
  taxa?: number;
  juros?: number;
  multa?: number;
  agendar_para?: string;
  descricao?: string;
  editaveis: string[];
};

function brl(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDateBr(ymd?: string) {
  if (!ymd) return "—";
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return ymd;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/** Normaliza a linha; se inválida, devolve erro humano (leitor_boleto). */
export function leitorBoleto(linha: string): ToolResult<{
  linha_digitavel: string;
}> {
  const normalized = normalizeLinhaDigitavel(linha);
  if (!normalized) {
    return {
      ok: false,
      error: {
        code: "VALIDATION",
        message_humana:
          "Não reconheci a linha digitável. Cole os 47 ou 48 dígitos do boleto.",
      },
    };
  }
  return {
    ok: true,
    data: { linha_digitavel: normalized },
  };
}

export async function prepararPagamentoBoleto(opts: {
  supabase: Supabase;
  accountId: string;
  conversationId: string;
  apiKey: string;
  env: AsaasEnv;
  input: PrepararPagamentoBoletoInput;
}): Promise<ToolResult> {
  const lido = leitorBoleto(opts.input.linha_digitavel);
  if (!lido.ok || !lido.data) {
    return lido;
  }
  const linha = lido.data.linha_digitavel;

  let sim;
  try {
    sim = await simulateBill(opts.apiKey, opts.env, linha);
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "ASAAS_ERROR",
        message_humana:
          error instanceof Error
            ? error.message
            : "Não consegui simular este boleto no Asaas.",
      },
    };
  }

  const info = sim.bankSlipInfo;
  const valor = info?.value ?? info?.originalValue ?? 0;
  if (!(valor > 0)) {
    return {
      ok: false,
      error: {
        code: "VALIDATION",
        message_humana:
          "O boleto veio sem valor. Confira a linha digitável e tente de novo.",
      },
    };
  }

  const juros = info?.interestValue ?? 0;
  const multa = info?.fineValue ?? 0;
  const payload: BoletoPayload = {
    linha_digitavel: linha,
    valor,
    vencimento: info?.dueDate,
    beneficiario: info?.beneficiaryName || info?.companyName,
    taxa: sim.fee ?? 0,
    juros,
    multa,
    agendar_para: opts.input.agendar_para?.trim() || undefined,
    descricao: opts.input.descricao?.trim() || undefined,
    editaveis: [],
  };

  await opts.supabase
    .from("pending_actions")
    .update({ status: "cancelled" })
    .eq("conversation_id", opts.conversationId)
    .eq("type", "preparar_pagamento_boleto")
    .eq("status", "pending");

  const { data: pending, error } = await opts.supabase
    .from("pending_actions")
    .insert({
      account_id: opts.accountId,
      conversation_id: opts.conversationId,
      type: "preparar_pagamento_boleto",
      payload,
      status: "pending",
      idempotency_key: `boleto:${opts.accountId}:${opts.conversationId}:${randomUUID()}`,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    })
    .select("id")
    .single();

  if (error || !pending) {
    return {
      ok: false,
      error: {
        code: "ASAAS_ERROR",
        message_humana: "Não consegui preparar o pagamento. Tente de novo.",
      },
    };
  }

  const avisos: ConfirmLinhaExtra[] = [];
  if (juros > 0 || multa > 0) {
    avisos.push({
      label: "Atenção",
      valor: `Há juros/multa (${brl(juros + multa)}) — boleto pode estar vencido.`,
    });
  }

  const ui: UICard = {
    type: "confirmacao",
    props: {
      pending_action_id: pending.id as string,
      titulo: "Pagar boleto",
      linhas: [
        {
          label: "Beneficiário",
          valor: payload.beneficiario || "—",
        },
        { label: "Valor", valor: brl(valor) },
        { label: "Vencimento", valor: formatDateBr(payload.vencimento) },
        ...(payload.taxa
          ? [{ label: "Taxa Asaas", valor: brl(payload.taxa) }]
          : []),
        ...avisos,
        {
          label: "Linha",
          valor: `${linha.slice(0, 12)}…${linha.slice(-8)}`,
        },
        ...(payload.agendar_para
          ? [
              {
                label: "Agendar para",
                valor: formatDateBr(payload.agendar_para),
              },
            ]
          : []),
      ],
      editaveis: [],
      cta: `Confirmar pagamento de ${brl(valor)}`,
    },
  };

  return {
    ok: true,
    data: { pending_action_id: pending.id, payload },
    ui,
  };
}

type ConfirmLinhaExtra = { label: string; valor: string };

export async function executePagamentoBoleto(opts: {
  apiKey: string;
  env: AsaasEnv;
  payload: BoletoPayload;
}): Promise<
  { ok: true; ui: UICard; result: unknown } | { ok: false; message: string }
> {
  try {
    const bill = await createBillPayment(opts.apiKey, opts.env, {
      identificationField: opts.payload.linha_digitavel,
      scheduleDate: opts.payload.agendar_para,
      description: opts.payload.descricao,
    });

    const ui: UICard = {
      type: "sucesso",
      props: {
        titulo: "Boleto pago / agendado",
        linhas: [
          { label: "ID", valor: bill.id },
          {
            label: "Valor",
            valor: brl(bill.value ?? opts.payload.valor),
          },
          { label: "Status", valor: bill.status || "—" },
          ...(bill.scheduleDate
            ? [
                {
                  label: "Agendado",
                  valor: formatDateBr(bill.scheduleDate),
                },
              ]
            : []),
        ],
      },
    };

    return { ok: true, ui, result: bill };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Falha ao pagar o boleto no Asaas.",
    };
  }
}
