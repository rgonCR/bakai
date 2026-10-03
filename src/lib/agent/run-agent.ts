import { generateText, tool, stepCountIs, type ModelMessage } from "ai";
import { z } from "zod";
import type { AsaasEnv } from "@/lib/asaas/client";
import { agenteRelatorio } from "@/lib/asaas/relatorio";
import {
  getDadosConta,
  getExtrato,
  getSaldo,
  listarCobrancas,
  runReadIntent,
} from "@/lib/asaas/tools";
import type { ToolResult } from "@/lib/agent/types";
import {
  abrirCobranca,
  abrirCobrancaInputSchema,
} from "@/lib/pending/abrir-cobranca";
import {
  prepararPagamentoBoleto,
  prepararPagamentoBoletoInputSchema,
} from "@/lib/pending/boleto";
import {
  prepararPix,
  prepararPixInputSchema,
} from "@/lib/pending/pix";
import {
  prepararReenviarCobrancas,
  reenviarCobrancasInputSchema,
} from "@/lib/pending/reenviar";
import {
  resolverCliente,
  resolverClienteInputSchema,
} from "@/lib/pending/resolver-cliente";
import type { createClient } from "@/lib/supabase/server";
import { buildSystemPrompt } from "./prompt";
import { createGeminiProvider, geminiModelId, hasGemini } from "./gemini";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type AgentTurnInput = {
  message: string;
  /** Histórico já incluindo a mensagem atual do usuário (últimos N turns). */
  history?: ModelMessage[];
  asaasApiKey: string;
  asaasEnv: AsaasEnv;
  userName: string;
  empresa: string;
  accountId: string;
  conversationId: string;
  supabase: Supabase;
  onStatus?: (label: string) => void;
};

export type AgentTurnOutput = {
  reply: string;
  results: ToolResult[];
  model: string;
};

function historyText(messages: ModelMessage[]): string {
  return messages
    .map((m) => (typeof m.content === "string" ? m.content : ""))
    .join("\n")
    .toLowerCase();
}

/** Remove follow-ups e valores quando há card — o número fica no card. */
function shortenReplyForCards(
  raw: string,
  opts: { hasSaldo: boolean; hasExtrato: boolean },
): string {
  let text = raw.trim();
  // corta perguntas de follow-up no fim
  text = text
    .replace(/\s*Deseja[^.?!]*[.?!]?\s*$/iu, "")
    .replace(/\s*Quer[^.?!]*[.?!]?\s*$/iu, "")
    .replace(/\s*Gostaria[^.?!]*[.?!]?\s*$/iu, "")
    .trim();

  if (opts.hasSaldo) {
    if (!text || /r\$\s*[\d.,]+/i.test(text) || text.length > 90) {
      return "Aqui está seu saldo:";
    }
  }
  if (opts.hasExtrato) {
    if (!text || /r\$\s*[\d.,]+/i.test(text) || text.length > 120) {
      return "Separei o extrato:";
    }
  }
  return text;
}

function buildFollowUpChips(opts: {
  hasSaldoCard: boolean;
  hasExtratoCard: boolean;
  hasConfirmacao: boolean;
  sawSaldoBefore: boolean;
  sawExtratoBefore: boolean;
  noTools: boolean;
}): string[] {
  // confirmação / escolha: o CTA do card é o próximo passo
  if (opts.hasConfirmacao) return [];
  // Sem tool = pergunta de esclarecimento (ex.: "Fazer Pix" pedindo chave/valor).
  // Não reexibir o menu da home no meio do fio.
  if (opts.noTools) return [];

  const options: string[] = [];
  if (opts.hasSaldoCard && !opts.sawExtratoBefore) {
    options.push("Ver extrato");
  }
  if (opts.hasExtratoCard && !opts.sawSaldoBefore && !opts.hasSaldoCard) {
    options.push("Ver saldo");
  }
  if ((opts.hasSaldoCard || opts.hasExtratoCard) && options.length < 2) {
    options.push("Criar cobrança");
  }
  return options;
}

export async function runAgentTurn(
  input: AgentTurnInput,
): Promise<AgentTurnOutput> {
  if (!hasGemini()) {
    input.onStatus?.("Consultando…");
    const fallback = await runReadIntent(
      input.asaasApiKey,
      input.asaasEnv,
      input.message,
    );
    return { ...fallback, model: "heuristic" };
  }

  const google = createGeminiProvider();
  const modelId = geminiModelId();
  const collected: ToolResult[] = [];

  input.onStatus?.("Consultando…");

  const history =
    input.history && input.history.length > 0
      ? input.history
      : ([{ role: "user", content: input.message }] satisfies ModelMessage[]);

  const prior = history.slice(0, -1);
  const priorBlob = historyText(prior);
  const sawSaldoBefore =
    /saldo|quanto tenho|dispon[ií]vel/.test(priorBlob) ||
    /aqui est[aá] seu saldo/.test(priorBlob);
  const sawExtratoBefore =
    /extrato|moviment|lan[cç]amento/.test(priorBlob) ||
    /separei o extrato/.test(priorBlob);

  const result = await generateText({
    model: google(modelId),
    system: buildSystemPrompt({
      nome: input.userName,
      empresa: input.empresa,
      ambiente: input.asaasEnv === "production" ? "producao" : "sandbox",
      onboarding_status: "approved",
    }),
    messages: history,
    stopWhen: stepCountIs(5),
    tools: {
      get_saldo: tool({
        description:
          "Consulta o saldo disponível da conta Asaas (sandbox). Use para 'quanto tenho', 'saldo'. Depois responda só com frase curta SEM valor (ex.: 'Aqui está seu saldo:'); o card mostra o número.",
        inputSchema: z.object({}),
        execute: async () => {
          input.onStatus?.("Consultando saldo…");
          const toolResult = await getSaldo(input.asaasApiKey, input.asaasEnv);
          collected.push(toolResult);
          return toolResult.ok
            ? toolResult.data
            : { error: toolResult.error?.message_humana };
        },
      }),
      get_extrato: tool({
        description:
          "Consulta o extrato/movimentações da conta. Use para 'extrato', 'o que entrou', 'lançamentos'. Responda com frase curta SEM valores; o card mostra os números. Não ofereça saldo se já foi visto.",
        inputSchema: z.object({
          data_inicio: z
            .string()
            .optional()
            .describe("YYYY-MM-DD início do período"),
          data_fim: z
            .string()
            .optional()
            .describe("YYYY-MM-DD fim do período"),
        }),
        execute: async ({ data_inicio, data_fim }) => {
          input.onStatus?.("Consultando extrato…");
          const toolResult = await getExtrato(input.asaasApiKey, input.asaasEnv, {
            startDate: data_inicio,
            finishDate: data_fim,
          });
          collected.push(toolResult);
          return toolResult.ok
            ? toolResult.data
            : { error: toolResult.error?.message_humana };
        },
      }),
      get_dados_conta: tool({
        description:
          "Consulta banco, agência e número da conta de pagamento no Asaas. Use para 'número da conta', 'agência', 'dados bancários', 'qual meu banco'. NUNCA invente esses dados — sempre chame esta tool.",
        inputSchema: z.object({}),
        execute: async () => {
          input.onStatus?.("Consultando dados da conta…");
          const toolResult = await getDadosConta(
            input.asaasApiKey,
            input.asaasEnv,
          );
          collected.push(toolResult);
          return toolResult.ok
            ? toolResult.data
            : { error: toolResult.error?.message_humana };
        },
      }),
      abrir_cobranca: tool({
        description:
          "Inicia cobrança: resolve cliente no Asaas (preenche CPF se achar um único) e streama blocos de formulário no chat. Passe o que já souber (cliente, valor, vencimento YYYY-MM-DD). open_wizard=true para streamar steps. NÃO cria a cobrança. NÃO diga para editar no painel.",
        inputSchema: abrirCobrancaInputSchema,
        execute: async (args) => {
          input.onStatus?.("Montando cobrança…");
          const toolResult = await abrirCobranca({
            apiKey: input.asaasApiKey,
            env: input.asaasEnv,
            input: args,
          });
          collected.push(toolResult);
          if (toolResult.ui?.type === "escolha") {
            return {
              match: "multiplos",
              opcoes: toolResult.ui.props.opcoes,
              aviso: "Peça para escolher no card.",
            };
          }
          return {
            ok: true,
            resolved: toolResult.data,
            aviso:
              "Responda só com frase curta tipo 'Vamos montar a cobrança:'. NÃO mencione painel nem peça editar à direita. NÃO diga que a cobrança foi criada.",
          };
        },
      }),
      listar_cobrancas: tool({
        description:
          "Lista cobranças. Use status=OVERDUE para 'vencidas', 'quem me deve', 'inadimplentes'. Sem status = recentes. Responda com frase curta; o card mostra a lista.",
        inputSchema: z.object({
          status: z
            .string()
            .optional()
            .describe(
              "Filtro Asaas: PENDING, OVERDUE, RECEIVED, CONFIRMED",
            ),
          limit: z.number().int().min(1).max(50).optional(),
        }),
        execute: async ({ status, limit }) => {
          input.onStatus?.("Listando cobranças…");
          const toolResult = await listarCobrancas(
            input.asaasApiKey,
            input.asaasEnv,
            { status, limit },
          );
          collected.push(toolResult);
          return toolResult.ok
            ? toolResult.data
            : { error: toolResult.error?.message_humana };
        },
      }),
      resolver_cliente: tool({
        description:
          "Resolve cliente por nome ou CPF/CNPJ. Use antes de cobrar quando o nome for ambíguo. Retorna unico | multiplos | nenhum. Com multiplos, o card de escolha aparece.",
        inputSchema: resolverClienteInputSchema,
        execute: async (args) => {
          input.onStatus?.("Buscando cliente…");
          const toolResult = await resolverCliente({
            apiKey: input.asaasApiKey,
            env: input.asaasEnv,
            input: args,
          });
          collected.push(toolResult);
          return toolResult.ok
            ? toolResult.data
            : { error: toolResult.error?.message_humana };
        },
      }),
      reenviar_cobrancas: tool({
        description:
          "Prepara reenvio de notificação de cobranças (vencidas). Passa os IDs. NÃO envia sozinho — gera card de confirmação.",
        inputSchema: reenviarCobrancasInputSchema,
        execute: async (args) => {
          input.onStatus?.("Preparando reenvio…");
          const toolResult = await prepararReenviarCobrancas({
            supabase: input.supabase,
            accountId: input.accountId,
            conversationId: input.conversationId,
            input: args,
          });
          collected.push(toolResult);
          return toolResult.ok
            ? {
                ok: true,
                pending_action_id:
                  toolResult.data &&
                  typeof toolResult.data === "object" &&
                  "pending_action_id" in toolResult.data
                    ? (toolResult.data as { pending_action_id: string })
                        .pending_action_id
                    : undefined,
                aviso: "Peça confirmação no card. NÃO diga que já reenviou.",
              }
            : { error: toolResult.error?.message_humana };
        },
      }),
      preparar_pix: tool({
        description:
          "Prepara Pix (transferência) para uma chave. Checa saldo. NÃO envia sozinho — gera card de confirmação. Inferir tipo da chave quando possível.",
        inputSchema: prepararPixInputSchema,
        execute: async (args) => {
          input.onStatus?.("Preparando Pix…");
          const toolResult = await prepararPix({
            supabase: input.supabase,
            accountId: input.accountId,
            conversationId: input.conversationId,
            apiKey: input.asaasApiKey,
            env: input.asaasEnv,
            input: args,
          });
          collected.push(toolResult);
          return toolResult.ok
            ? {
                ok: true,
                aviso:
                  "Mostre o card e peça confirmação. NÃO diga que o Pix foi enviado.",
              }
            : { error: toolResult.error?.message_humana };
        },
      }),
      agente_relatorio: tool({
        description:
          "Monta relatório do período (entradas, saídas, líquido, a receber, vencidas + gráfico). Use para 'como foi o mês', 'resumo de setembro', 'como estão as contas'.",
        inputSchema: z.object({
          pergunta: z.string().optional(),
          periodo_inicio: z
            .string()
            .optional()
            .describe("YYYY-MM-DD início (default: 1º dia do mês)"),
          periodo_fim: z
            .string()
            .optional()
            .describe("YYYY-MM-DD fim (default: hoje/fim do mês)"),
          comparar_com_anterior: z.boolean().optional(),
        }),
        execute: async (args) => {
          input.onStatus?.("Montando relatório…");
          const toolResult = await agenteRelatorio(
            input.asaasApiKey,
            input.asaasEnv,
            args,
          );
          collected.push(toolResult);
          return toolResult.ok
            ? toolResult.data
            : { error: toolResult.error?.message_humana };
        },
      }),
      preparar_pagamento_boleto: tool({
        description:
          "Prepara pagamento de boleto (conta). Passe a linha digitável. Simula no Asaas e gera card de confirmação. NÃO paga sozinho.",
        inputSchema: prepararPagamentoBoletoInputSchema,
        execute: async (args) => {
          input.onStatus?.("Lendo boleto…");
          const toolResult = await prepararPagamentoBoleto({
            supabase: input.supabase,
            accountId: input.accountId,
            conversationId: input.conversationId,
            apiKey: input.asaasApiKey,
            env: input.asaasEnv,
            input: args,
          });
          collected.push(toolResult);
          return toolResult.ok
            ? {
                ok: true,
                aviso:
                  "Mostre o card e peça confirmação. NÃO diga que o boleto foi pago.",
              }
            : { error: toolResult.error?.message_humana };
        },
      }),
    },
  });

  const hasSaldoCard = collected.some(
    (r) => r.ok && r.ui?.type === "saldo",
  );
  const hasExtratoCard = collected.some(
    (r) => r.ok && r.ui?.type === "extrato",
  );
  const hasDadosContaCard = collected.some(
    (r) => r.ok && r.ui?.type === "dados_conta",
  );
  const hasTaskDraft = collected.some(
    (r) => r.ok && r.ui?.type === "task_draft",
  );
  const hasListaCobrancas = collected.some(
    (r) => r.ok && r.ui?.type === "lista_cobrancas",
  );
  const hasRelatorio = collected.some(
    (r) => r.ok && r.ui?.type === "relatorio",
  );
  const hasConfirmacao = collected.some(
    (r) =>
      r.ok &&
      (r.ui?.type === "confirmacao" || r.ui?.type === "escolha"),
  );

  let reply =
    result.text.trim() ||
    (collected.some((r) => r.ok)
      ? hasSaldoCard
        ? "Aqui está seu saldo:"
        : hasExtratoCard
          ? "Separei o extrato:"
          : hasDadosContaCard
            ? "Aqui estão os dados da sua conta:"
            : hasRelatorio
              ? "Separei o relatório do período:"
              : hasListaCobrancas
                ? "Aqui estão suas cobranças:"
                : hasTaskDraft
                  ? "Vamos montar a cobrança:"
                  : hasConfirmacao
                    ? "Confira e confirme abaixo:"
                    : "Pronto — confira o card abaixo."
      : "Não consegui concluir agora. Tente de novo em instantes.");

  if (hasSaldoCard || hasExtratoCard) {
    reply = shortenReplyForCards(reply, {
      hasSaldo: hasSaldoCard,
      hasExtrato: hasExtratoCard,
    });
  }
  if (hasDadosContaCard) {
    reply = "Aqui estão os dados da sua conta:";
  }
  if (hasListaCobrancas) {
    const lista = collected.find((r) => r.ok && r.ui?.type === "lista_cobrancas")
      ?.ui;
    reply =
      lista?.type === "lista_cobrancas" &&
      /vencid/i.test(lista.props.status)
        ? "Aqui estão as cobranças vencidas:"
        : "Aqui estão suas cobranças:";
  }
  if (hasRelatorio) {
    reply = "Separei o relatório do período:";
  }
  if (hasTaskDraft) {
    reply = "Vamos montar a cobrança:";
  }
  if (hasConfirmacao) {
    const escolhaUi = collected.find((r) => r.ok && r.ui?.type === "escolha")
      ?.ui;
    if (escolhaUi?.type === "escolha") {
      reply = escolhaUi.props.pergunta;
    } else {
      const confUi = collected.find((r) => r.ok && r.ui?.type === "confirmacao")
        ?.ui;
      reply =
        confUi?.type === "confirmacao" &&
        /pix/i.test(confUi.props.titulo)
          ? "Confira o Pix antes de enviar:"
          : confUi?.type === "confirmacao" &&
              /boleto|pagar/i.test(confUi.props.titulo)
            ? "Confira o boleto antes de pagar:"
            : confUi?.type === "confirmacao" &&
                /reenviar/i.test(confUi.props.titulo)
              ? "Confira o reenvio:"
              : "Separei pra você confirmar:";
    }
  }

  const chipOptions = buildFollowUpChips({
    hasSaldoCard,
    hasExtratoCard,
    hasConfirmacao: hasConfirmacao || hasTaskDraft,
    sawSaldoBefore,
    sawExtratoBefore,
    noTools: collected.length === 0,
  });

  if (chipOptions.length > 0) {
    collected.push({
      ok: true,
      ui: {
        type: "chips",
        props: { options: chipOptions },
      },
    });
  }

  const seenChip = new Set<string>();
  const results = collected.filter((r) => {
    if (r.ui?.type !== "chips") return true;
    const key = r.ui.props.options.join("|");
    if (seenChip.has(key)) return false;
    seenChip.add(key);
    return true;
  });

  return { reply, results, model: modelId };
}
