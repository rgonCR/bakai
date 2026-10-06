import {
  asaasFetch,
  type AsaasAccount,
  type AsaasAccountNumber,
  type AsaasBalance,
  type AsaasEnv,
  type AsaasFinancialTransaction,
  type AsaasListResponse,
} from "./client";
import { toolErrorFromAsaas } from "./asaas-errors";
import { getCustomer } from "./customers";
import { listPayments } from "./payments";
import { asaasPaymentStatusLabel } from "./status";
import type { ToolResult } from "@/lib/agent/types";

/** Código do banco Asaas (instituição de pagamento). */
const ASAAS_BANK_CODE = "461";

function brl(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export async function getSaldo(
  apiKey: string,
  env: AsaasEnv,
): Promise<ToolResult<{ saldo: number }>> {
  try {
    const balance = await asaasFetch<AsaasBalance>(
      apiKey,
      env,
      "/finance/balance",
    );
    return {
      ok: true,
      data: { saldo: balance.balance },
      ui: {
        type: "saldo",
        props: {
          saldo: balance.balance,
          ambiente: env,
          formatado: brl(balance.balance),
        },
      },
    };
  } catch (error) {
    return toolErrorFromAsaas(error, "saldo");
  }
}

export async function getExtrato(
  apiKey: string,
  env: AsaasEnv,
  args: { startDate?: string; finishDate?: string; limit?: number } = {},
): Promise<
  ToolResult<{
    entradas: number;
    saidas: number;
    count: number;
    top: Array<{ data: string; descricao: string; valor: number }>;
  }>
> {
  try {
    const params = new URLSearchParams();
    if (args.startDate) params.set("startDate", args.startDate);
    if (args.finishDate) params.set("finishDate", args.finishDate);
    params.set("limit", String(args.limit ?? 50));
    params.set("offset", "0");

    const list = await asaasFetch<
      AsaasListResponse<AsaasFinancialTransaction>
    >(apiKey, env, `/financialTransactions?${params.toString()}`);

    const rows = list.data ?? [];
    const entradas = rows
      .filter((r) => r.value > 0)
      .reduce((s, r) => s + r.value, 0);
    const saidas = rows
      .filter((r) => r.value < 0)
      .reduce((s, r) => s + r.value, 0);

    const itens = rows.slice(0, 15).map((r) => ({
      data: formatDateBr(r.date),
      descricao: r.description || r.type,
      valor: r.value,
    }));

    const top = [...rows]
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
      .slice(0, 10)
      .map((r) => ({
        data: formatDateBr(r.date),
        descricao: r.description || r.type,
        valor: r.value,
      }));

    return {
      ok: true,
      data: { entradas, saidas, count: rows.length, top },
      ui: {
        type: "extrato",
        props: {
          periodo: formatPeriodoBr(args.startDate, args.finishDate),
          entradas,
          saidas,
          itens,
        },
      },
    };
  } catch (error) {
    return toolErrorFromAsaas(error, "extrato");
  }
}

export async function getDadosConta(
  apiKey: string,
  env: AsaasEnv,
): Promise<
  ToolResult<{
    banco: string;
    agencia: string;
    conta: string;
    titular?: string;
  }>
> {
  try {
    const [number, account] = await Promise.all([
      asaasFetch<AsaasAccountNumber>(apiKey, env, "/myAccount/accountNumber"),
      asaasFetch<AsaasAccount>(apiKey, env, "/myAccount").catch(() => null),
    ]);

    const agencia = number.agency?.trim() || "—";
    const contaNum = number.account?.trim() || "";
    const digito = number.accountDigit?.trim() || "";
    const conta =
      contaNum && digito
        ? `${contaNum}-${digito}`
        : contaNum || digito || "—";

    if (agencia === "—" && conta === "—") {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message_humana:
            "Ainda não consegui ler o número da conta no Asaas. Tente de novo em instantes.",
        },
      };
    }

    return {
      ok: true,
      data: {
        banco: ASAAS_BANK_CODE,
        agencia,
        conta,
        titular: account?.name,
      },
      ui: {
        type: "dados_conta",
        props: {
          banco: `Asaas (${ASAAS_BANK_CODE})`,
          agencia,
          conta,
          titular: account?.name,
        },
      },
    };
  } catch (error) {
    return toolErrorFromAsaas(error, "conta");
  }
}

function formatDateBr(ymd: string) {
  const m = ymd?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return ymd || "—";
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function formatPeriodoBr(start?: string, finish?: string) {
  if (!start && !finish) return "últimos lançamentos";
  const a = start ? formatDateBr(start) : "…";
  const b = finish ? formatDateBr(finish) : "…";
  return `${a} → ${b}`;
}

export async function listarCobrancas(
  apiKey: string,
  env: AsaasEnv,
  args: { status?: string; limit?: number } = {},
): Promise<
  ToolResult<{
    total: number;
    soma: number;
    itens: Array<{
      id: string;
      cliente: string;
      valor: number;
      vencimento: string;
      status: string;
      link?: string;
    }>;
  }>
> {
  try {
    const status = args.status?.trim().toUpperCase() || undefined;
    const list = await listPayments(apiKey, env, {
      status,
      limit: args.limit ?? 20,
    });
    const rows = list.data ?? [];
    const nameCache = new Map<string, string>();

    const itens = await Promise.all(
      rows.map(async (p) => {
        let cliente = p.customer;
        if (!nameCache.has(p.customer)) {
          try {
            const c = await getCustomer(apiKey, env, p.customer);
            nameCache.set(p.customer, c.name || p.customer);
          } catch {
            nameCache.set(p.customer, p.customer);
          }
        }
        cliente = nameCache.get(p.customer) || p.customer;
        return {
          id: p.id,
          cliente,
          valor: p.value,
          vencimento: formatDateBr(p.dueDate),
          status: asaasPaymentStatusLabel(p.status),
          link: p.invoiceUrl,
        };
      }),
    );

    const soma = itens.reduce((s, i) => s + i.valor, 0);
    const statusLabel = status
      ? asaasPaymentStatusLabel(status)
      : "Todas";

    const isOverdue = status === "OVERDUE";

    return {
      ok: true,
      data: { total: itens.length, soma, itens },
      ui: {
        type: "lista_cobrancas",
        props: {
          status: statusLabel,
          total: itens.length,
          soma,
          itens,
          ...(isOverdue && itens.length > 0
            ? {
                acao_lote: {
                  label: "Reenviar para todos",
                  tool: "reenviar_cobrancas" as const,
                },
              }
            : {}),
        },
      },
    };
  } catch (error) {
    return toolErrorFromAsaas(error, "cobrancas");
  }
}

/** Heurística D1 sem LLM — resolve intenção enquanto tool-calling não está ligado */
export async function runReadIntent(
  apiKey: string,
  env: AsaasEnv,
  message: string,
): Promise<{ reply: string; results: ToolResult[] }> {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("número da conta") ||
    normalized.includes("numero da conta") ||
    normalized.includes("dados da conta") ||
    normalized.includes("agência") ||
    normalized.includes("agencia") ||
    (normalized.includes("conta") &&
      (normalized.includes("banco") || normalized.includes("qual")))
  ) {
    const result = await getDadosConta(apiKey, env);
    return {
      reply: result.ok
        ? "Aqui estão os dados da sua conta:"
        : result.error?.message_humana || "Falha ao consultar a conta.",
      results: [result],
    };
  }

  if (
    normalized.includes("saldo") ||
    normalized.includes("quanto tenho") ||
    normalized.includes("disponível")
  ) {
    const result = await getSaldo(apiKey, env);
    return {
      reply: result.ok
        ? "Aqui está seu saldo:"
        : result.error?.message_humana || "Falha ao consultar saldo.",
      results: result.ok
        ? [
            result,
            {
              ok: true,
              ui: {
                type: "chips",
                props: { options: ["Ver extrato"] },
              },
            },
          ]
        : [result],
    };
  }

  if (
    normalized.includes("extrato") ||
    normalized.includes("moviment") ||
    normalized.includes("lançamento") ||
    normalized.includes("lancamento")
  ) {
    const result = await getExtrato(apiKey, env);
    return {
      reply: result.ok
        ? "Separei o extrato:"
        : result.error?.message_humana || "Falha ao consultar extrato.",
      results: [result],
    };
  }

  if (
    normalized.includes("vencid") ||
    normalized.includes("me devendo") ||
    normalized.includes("inadimpl")
  ) {
    const result = await listarCobrancas(apiKey, env, { status: "OVERDUE" });
    return {
      reply: result.ok
        ? "Aqui estão as cobranças vencidas:"
        : result.error?.message_humana || "Falha ao listar vencidas.",
      results: [result],
    };
  }

  if (
    normalized.includes("como foi") ||
    normalized.includes("relatório") ||
    normalized.includes("relatorio") ||
    normalized.includes("resumo do mês") ||
    normalized.includes("resumo do mes")
  ) {
    const { agenteRelatorio } = await import("@/lib/asaas/relatorio");
    const result = await agenteRelatorio(apiKey, env, {
      pergunta: message,
    });
    return {
      reply: result.ok
        ? "Separei o relatório do período:"
        : result.error?.message_humana || "Falha ao montar relatório.",
      results: [result],
    };
  }

  if (
    normalized.includes("fazer pix") ||
    normalized.includes("enviar pix") ||
    normalized === "pix" ||
    normalized.startsWith("pix ")
  ) {
    return {
      reply:
        "Beleza — me passa a chave Pix e o valor (ex.: email@cliente.com e R$ 50).",
      results: [],
    };
  }

  if (
    normalized.includes("pagar boleto") ||
    normalized.includes("paga esse boleto") ||
    normalized.includes("pagar conta")
  ) {
    return {
      reply: "Cole a linha digitável do boleto (47 ou 48 dígitos).",
      results: [],
    };
  }

  if (
    normalized.includes("criar cobrança") ||
    normalized.includes("criar cobranca") ||
    normalized.includes("nova cobrança") ||
    normalized.includes("nova cobranca")
  ) {
    return {
      reply: "Vamos montar a cobrança — me diga o cliente e o valor.",
      results: [],
    };
  }

  if (
    (normalized.includes("cobrança") ||
      normalized.includes("cobranca") ||
      normalized.includes("listar cobran")) &&
    !normalized.includes("criar") &&
    !normalized.includes("nova")
  ) {
    const result = await listarCobrancas(apiKey, env);
    return {
      reply: result.ok
        ? "Aqui estão suas cobranças:"
        : result.error?.message_humana || "Falha ao listar cobranças.",
      results: [result],
    };
  }

  return {
    reply:
      "Sou o bank.ai. Consigo saldo, extrato, cobranças, vencidas e Pix. O que você precisa?",
    results: [],
  };
}
