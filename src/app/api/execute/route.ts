import { NextResponse } from "next/server";
import { decryptAsaasKey } from "@/lib/crypto/asaas-key";
import type { AsaasEnv } from "@/lib/asaas/client";
import { invalidateReadCaches } from "@/lib/asaas/tool-runtime";
import {
  executeCobranca,
  type CobrancaPayload,
  type ExecuteEdits,
} from "@/lib/pending/cobranca";
import {
  executePagamentoBoleto,
  type BoletoPayload,
} from "@/lib/pending/boleto";
import { executePix, type PixPayload } from "@/lib/pending/pix";
import {
  executeReenviarCobrancas,
  type ReenviarPayload,
} from "@/lib/pending/reenviar";
import { createClientFromRequest } from "@/lib/supabase/request-client";
import type { createClient } from "@/lib/supabase/server";

type Body = {
  pending_action_id?: string;
  edits?: ExecuteEdits;
  action?: "confirm" | "cancel";
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const pendingId = body.pending_action_id?.trim();
    if (!pendingId) {
      return NextResponse.json(
        { error: "pending_action_id ausente." },
        { status: 400 },
      );
    }

    const action = body.action ?? "confirm";
    const supabase = await createClientFromRequest(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Sessão ausente." }, { status: 401 });
    }

    const { data: account } = await supabase
      .from("accounts")
      .select("id, env, asaas_key_enc")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!account?.asaas_key_enc) {
      return NextResponse.json(
        { error: "Conta Asaas não conectada." },
        { status: 400 },
      );
    }

    const { data: pending, error: pendingError } = await supabase
      .from("pending_actions")
      .select("*")
      .eq("id", pendingId)
      .eq("account_id", account.id)
      .maybeSingle();

    if (pendingError || !pending) {
      return NextResponse.json(
        { error: "Ação não encontrada." },
        { status: 404 },
      );
    }

    if (pending.status !== "pending") {
      return NextResponse.json(
        {
          error: `Essa ação já está como ${pending.status}.`,
          status: pending.status,
          result: pending.result,
        },
        { status: 409 },
      );
    }

    if (new Date(pending.expires_at as string).getTime() < Date.now()) {
      await supabase
        .from("pending_actions")
        .update({ status: "expired" })
        .eq("id", pendingId);
      return NextResponse.json(
        { error: "Essa confirmação expirou. Peça para preparar de novo." },
        { status: 410 },
      );
    }

    if (action === "cancel") {
      await supabase
        .from("pending_actions")
        .update({ status: "cancelled" })
        .eq("id", pendingId);

      if (pending.conversation_id) {
        await supabase.from("messages").insert({
          conversation_id: pending.conversation_id,
          role: "system",
          parts: [
            {
              type: "acao_executada",
              tipo: pending.type,
              resultado: { status: "cancelled" },
            },
          ],
        });
      }

      const cancelReply =
        pending.type === "preparar_pix"
          ? "Cancelei o Pix — nada foi enviado."
          : pending.type === "preparar_pagamento_boleto"
            ? "Cancelei o pagamento do boleto — nada foi pago."
            : pending.type === "reenviar_cobrancas"
              ? "Cancelei o reenvio — nenhuma notificação foi mandada."
              : "Descarti o rascunho — nada foi cobrado no Asaas.";

      return NextResponse.json({
        ok: true,
        status: "cancelled",
        reply: cancelReply,
      });
    }

    const apiKey = decryptAsaasKey(account.asaas_key_enc as string);
    const env = (account.env as AsaasEnv) || "sandbox";
    const type = pending.type as string;

    let outcome:
      | { ok: true; ui: import("@/lib/agent/types").UICard; result: unknown }
      | { ok: false; message: string };

    if (type === "preparar_cobranca") {
      const payload = pending.payload as CobrancaPayload;
      const allowed = new Set(payload.editaveis ?? []);
      const edits: ExecuteEdits = {};
      if (body.edits?.valor != null && allowed.has("valor")) {
        edits.valor = body.edits.valor;
      }
      if (body.edits?.vencimento && allowed.has("vencimento")) {
        edits.vencimento = body.edits.vencimento;
      }
      if (body.edits?.forma && allowed.has("forma")) {
        edits.forma = body.edits.forma;
      }
      outcome = await executeCobranca({ apiKey, env, payload, edits });
      if (!outcome.ok) {
        await markFailed(supabase, pendingId, pending, outcome.message);
        return NextResponse.json(
          { ok: false, error: outcome.message, status: "failed" },
          { status: 502 },
        );
      }
    } else if (type === "reenviar_cobrancas") {
      outcome = await executeReenviarCobrancas({
        apiKey,
        env,
        payload: pending.payload as ReenviarPayload,
      });
    } else if (type === "preparar_pix") {
      outcome = await executePix({
        apiKey,
        env,
        payload: pending.payload as PixPayload,
      });
    } else if (type === "preparar_pagamento_boleto") {
      outcome = await executePagamentoBoleto({
        apiKey,
        env,
        payload: pending.payload as BoletoPayload,
      });
    } else {
      return NextResponse.json(
        { error: `Tipo ${type} ainda não suportado no execute.` },
        { status: 400 },
      );
    }

    if (!outcome.ok) {
      await supabase
        .from("pending_actions")
        .update({
          status: "failed",
          result: { error: outcome.message },
          executed_at: new Date().toISOString(),
        })
        .eq("id", pendingId);
      return NextResponse.json(
        { ok: false, error: outcome.message, status: "failed" },
        { status: 400 },
      );
    }

    await supabase
      .from("pending_actions")
      .update({
        status: "executed",
        result: outcome.result,
        executed_at: new Date().toISOString(),
      })
      .eq("id", pendingId);

    invalidateReadCaches(account.id as string);

    const reply =
      type === "preparar_pix"
        ? "Pix confirmado:"
        : type === "preparar_pagamento_boleto"
          ? "Pagamento de boleto confirmado:"
          : type === "reenviar_cobrancas"
            ? "Reenvio concluído:"
            : "Cobrança confirmada. Confira o comprovante:";

    if (pending.conversation_id) {
      await supabase.from("messages").insert({
        conversation_id: pending.conversation_id,
        role: "system",
        parts: [
          {
            type: "acao_executada",
            tipo: pending.type,
            resultado: { status: "executed", data: outcome.result },
          },
        ],
      });
      await supabase.from("messages").insert({
        conversation_id: pending.conversation_id,
        role: "assistant",
        parts: [
          { type: "text", text: reply },
          { type: "ui", ui: outcome.ui },
        ],
      });
    }

    return NextResponse.json({
      ok: true,
      status: "executed",
      reply,
      ui: outcome.ui,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Erro ao executar ação.",
      },
      { status: 500 },
    );
  }
}

async function markFailed(
  supabase: Awaited<ReturnType<typeof createClient>>,
  pendingId: string,
  pending: { conversation_id?: string | null; type?: string },
  message: string,
) {
  await supabase
    .from("pending_actions")
    .update({
      status: "failed",
      result: { error: message },
      executed_at: new Date().toISOString(),
    })
    .eq("id", pendingId);

  if (pending.conversation_id) {
    await supabase.from("messages").insert({
      conversation_id: pending.conversation_id,
      role: "system",
      parts: [
        {
          type: "acao_executada",
          tipo: pending.type,
          resultado: { status: "failed", error: message },
        },
      ],
    });
  }
}
