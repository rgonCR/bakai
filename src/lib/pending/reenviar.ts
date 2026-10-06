import { randomUUID } from "crypto";
import { z } from "zod";
import type { AsaasEnv } from "@/lib/asaas/client";
import { asaasErrorMessage } from "@/lib/asaas/asaas-errors";
import { resendPaymentNotification } from "@/lib/asaas/payments";
import type { ToolResult, UICard } from "@/lib/agent/types";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export const reenviarCobrancasInputSchema = z.object({
  cobranca_ids: z
    .array(z.string().min(3))
    .min(1)
    .max(50)
    .describe("IDs Asaas das cobranças a reenviar"),
});

export type ReenviarCobrancasInput = z.infer<
  typeof reenviarCobrancasInputSchema
>;

export type ReenviarPayload = {
  cobranca_ids: string[];
  editaveis: string[];
};

export async function prepararReenviarCobrancas(opts: {
  supabase: Supabase;
  accountId: string;
  conversationId: string;
  input: ReenviarCobrancasInput;
}): Promise<ToolResult> {
  const ids = [...new Set(opts.input.cobranca_ids.map((id) => id.trim()))];
  if (ids.length === 0) {
    return {
      ok: false,
      error: {
        code: "VALIDATION",
        message_humana: "Informe ao menos uma cobrança para reenviar.",
      },
    };
  }

  const payload: ReenviarPayload = {
    cobranca_ids: ids,
    editaveis: [],
  };

  await opts.supabase
    .from("pending_actions")
    .update({ status: "cancelled" })
    .eq("conversation_id", opts.conversationId)
    .eq("type", "reenviar_cobrancas")
    .eq("status", "pending");

  const { data: pending, error } = await opts.supabase
    .from("pending_actions")
    .insert({
      account_id: opts.accountId,
      conversation_id: opts.conversationId,
      type: "reenviar_cobrancas",
      payload,
      status: "pending",
      idempotency_key: `reenviar:${opts.accountId}:${opts.conversationId}:${randomUUID()}`,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    })
    .select("id")
    .single();

  if (error || !pending) {
    return {
      ok: false,
      error: {
        code: "ASAAS_ERROR",
        message_humana: "Não consegui preparar o reenvio. Tente de novo.",
      },
    };
  }

  const ui: UICard = {
    type: "confirmacao",
    props: {
      pending_action_id: pending.id as string,
      titulo: "Reenviar cobranças",
      linhas: [
        { label: "Quantidade", valor: String(ids.length) },
        {
          label: "Ação",
          valor: "Reenviar notificação de pagamento aos clientes",
        },
      ],
      editaveis: [],
      cta: `Confirmar reenvio de ${ids.length} cobrança${ids.length > 1 ? "s" : ""}`,
    },
  };

  return {
    ok: true,
    data: { pending_action_id: pending.id, payload },
    ui,
  };
}

export async function executeReenviarCobrancas(opts: {
  apiKey: string;
  env: AsaasEnv;
  payload: ReenviarPayload;
}): Promise<
  { ok: true; ui: UICard; result: unknown } | { ok: false; message: string }
> {
  const okIds: string[] = [];
  const failIds: Array<{ id: string; error: string }> = [];

  for (const id of opts.payload.cobranca_ids) {
    try {
      await resendPaymentNotification(opts.apiKey, opts.env, id);
      okIds.push(id);
    } catch (error) {
      failIds.push({
        id,
        error: asaasErrorMessage(error, "reenviar"),
      });
    }
  }

  if (okIds.length === 0) {
    return {
      ok: false,
      message:
        failIds[0]?.error ||
        "Não consegui reenviar nenhuma notificação. Tente de novo.",
    };
  }

  const ui: UICard = {
    type: "sucesso",
    props: {
      titulo: "Reenvio concluído",
      linhas: [
        { label: "Enviadas", valor: String(okIds.length) },
        ...(failIds.length
          ? [{ label: "Falhas", valor: String(failIds.length) }]
          : []),
      ],
    },
  };

  return {
    ok: true,
    ui,
    result: { okIds, failIds },
  };
}
