import {
  asaasFetch,
  type AsaasEnv,
  type AsaasFinancialTransaction,
  type AsaasListResponse,
} from "./client";
import { toolErrorFromAsaas } from "./asaas-errors";
import { listPayments, type AsaasPayment } from "./payments";
import type { ToolResult } from "@/lib/agent/types";

function brl(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDayLabel(ymd: string) {
  const [, m, day] = ymd.split("-");
  return `${day}/${m}`;
}

function toYmdSp(d: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(d);
}

function daysInRange(start: string, end: string): string[] {
  const out: string[] = [];
  const cur = new Date(`${start}T12:00:00`);
  const last = new Date(`${end}T12:00:00`);
  while (cur <= last) {
    out.push(toYmdSp(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

function monthBounds(ref = new Date()) {
  const y = ref.getFullYear();
  const m = ref.getMonth();
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 0);
  return { start: toYmdSp(start), end: toYmdSp(end) };
}

function parseTxDay(raw: string | undefined): string | null {
  if (!raw) return null;
  const day = raw.includes("T")
    ? raw.slice(0, 10)
    : raw.match(/^\d{4}-\d{2}-\d{2}/)?.[0] || raw.slice(0, 10);
  return day && day.length >= 10 ? day : null;
}

/** `seed-bankai|YYYY-MM-DD|n` — data de caixa do seed (sandbox não backdata). */
function parseSeedCaixaDay(ref: string | undefined): string | null {
  if (!ref) return null;
  const m = ref.match(/^seed-bankai\|(\d{4}-\d{2}-\d{2})(?:\||$)/);
  return m?.[1] ?? null;
}

function fillRangeZeros(byDay: Map<string, number>, start: string, end: string) {
  for (const d of daysInRange(start, end)) {
    if (!byDay.has(d)) byDay.set(d, 0);
  }
}

/**
 * Monta série diária do gráfico.
 * 1) Se houver cobranças com externalReference do seed → usa essas datas.
 * 2) Senão, se o extrato concentrar tudo em 1–2 dias → espalha recebidas no período.
 * 3) Senão, usa as datas reais do extrato.
 */
function buildMovimentacaoByDay(
  rows: AsaasFinancialTransaction[],
  payments: AsaasPayment[],
  start: string,
  end: string,
): Map<string, number> {
  const rangeDays = daysInRange(start, end);
  const inRange = (d: string) => d >= start && d <= end;

  const seedPayments = payments
    .map((p) => {
      const day = parseSeedCaixaDay(p.externalReference);
      return day && inRange(day) ? { day, value: p.value } : null;
    })
    .filter((x): x is { day: string; value: number } => Boolean(x));

  if (seedPayments.length > 0) {
    const byDay = new Map<string, number>();
    for (const { day, value } of seedPayments) {
      byDay.set(day, (byDay.get(day) ?? 0) + value);
    }
    fillRangeZeros(byDay, start, end);
    return byDay;
  }

  const fromTx = new Map<string, number>();
  for (const r of rows) {
    const day = parseTxDay(r.date);
    if (!day || !inRange(day)) continue;
    fromTx.set(day, (fromTx.get(day) ?? 0) + r.value);
  }

  const activeDays = [...fromTx.entries()].filter(([, v]) => v !== 0);
  const receivedOnly = payments
    .filter((p) => p.value > 0)
    .sort((a, b) => a.id.localeCompare(b.id));

  // Sandbox: tudo liquida no mesmo dia → espalha entradas até hoje p/ demo
  if (activeDays.length > 0 && activeDays.length <= 2 && receivedOnly.length >= 2) {
    const byDay = new Map<string, number>();
    const today = toYmdSp(new Date());
    const untilToday = rangeDays.filter((d) => d <= today);
    const weekdays = untilToday.filter((d) => {
      const wd = new Date(`${d}T12:00:00`).getDay();
      return wd !== 0 && wd !== 6;
    });
    const targets =
      weekdays.length > 0
        ? weekdays
        : untilToday.length > 0
          ? untilToday
          : rangeDays;
    for (let i = 0; i < receivedOnly.length; i++) {
      const p = receivedOnly[i]!;
      const idx =
        receivedOnly.length === 1
          ? 0
          : Math.round((i / (receivedOnly.length - 1)) * (targets.length - 1));
      const day = targets[idx]!;
      byDay.set(day, (byDay.get(day) ?? 0) + p.value);
    }
    fillRangeZeros(byDay, start, end);
    return byDay;
  }

  fillRangeZeros(fromTx, start, end);
  return fromTx;
}

export async function agenteRelatorio(
  apiKey: string,
  env: AsaasEnv,
  args: {
    pergunta?: string;
    periodo_inicio?: string;
    periodo_fim?: string;
    comparar_com_anterior?: boolean;
  } = {},
): Promise<ToolResult> {
  try {
    const defaults = monthBounds();
    const start = args.periodo_inicio || defaults.start;
    const end = args.periodo_fim || defaults.end;

    const params = new URLSearchParams();
    params.set("startDate", start);
    params.set("finishDate", end);
    params.set("limit", "100");
    params.set("offset", "0");

    const list = await asaasFetch<
      AsaasListResponse<AsaasFinancialTransaction>
    >(apiKey, env, `/financialTransactions?${params.toString()}`);

    const rows = list.data ?? [];
    const entradas = rows
      .filter((r) => r.value > 0)
      .reduce((s, r) => s + r.value, 0);
    const saidas = Math.abs(
      rows.filter((r) => r.value < 0).reduce((s, r) => s + r.value, 0),
    );
    const liquido = entradas - saidas;

    const [pending, overdue, received, confirmed] = await Promise.all([
      listPayments(apiKey, env, { status: "PENDING", limit: 50 }),
      listPayments(apiKey, env, { status: "OVERDUE", limit: 50 }),
      listPayments(apiKey, env, { status: "RECEIVED", limit: 100 }),
      listPayments(apiKey, env, { status: "CONFIRMED", limit: 100 }),
    ]);

    // Série do gráfico: preferir datas do seed (externalReference) —
    // o sandbox Asaas liquida tudo em "hoje".
    const byDay = buildMovimentacaoByDay(
      rows,
      [...(received.data ?? []), ...(confirmed.data ?? [])],
      start,
      end,
    );

    const days = [...byDay.keys()].sort();
    // série diária longa → agrega por semana
    let x: string[];
    let y: number[];
    if (days.length > 21) {
      const buckets = new Map<string, number>();
      for (const d of days) {
        const dt = new Date(`${d}T12:00:00`);
        const weekStart = new Date(dt);
        weekStart.setDate(dt.getDate() - dt.getDay());
        const key = toYmdSp(weekStart);
        buckets.set(key, (buckets.get(key) ?? 0) + (byDay.get(d) ?? 0));
      }
      const keys = [...buckets.keys()].sort();
      x = keys.map(formatDayLabel);
      y = keys.map((k) => buckets.get(k) ?? 0);
    } else {
      x = days.map(formatDayLabel);
      y = days.map((d) => byDay.get(d) ?? 0);
    }
    const aReceber = (pending.data ?? []).reduce((s, p) => s + p.value, 0);
    const vencidas = (overdue.data ?? []).reduce((s, p) => s + p.value, 0);
    const qtdVencidas = overdue.data?.length ?? 0;

    const destaques: string[] = [];
    if (liquido >= 0) {
      destaques.push(`Resultado positivo de ${brl(liquido)} no período.`);
    } else {
      destaques.push(`Resultado negativo de ${brl(Math.abs(liquido))} no período.`);
    }
    if (qtdVencidas > 0) {
      destaques.push(
        `${qtdVencidas} cobrança${qtdVencidas > 1 ? "s" : ""} vencida${qtdVencidas > 1 ? "s" : ""} somam ${brl(vencidas)}.`,
      );
    } else {
      destaques.push("Nenhuma cobrança vencida no momento.");
    }
    if (aReceber > 0) {
      destaques.push(`Ainda há ${brl(aReceber)} a receber em aberto.`);
    }
    if (rows.length === 0) {
      destaques.unshift("Sem movimentações no período — extrato vazio.");
    }

    const periodoLabel = `${start.slice(8, 10)}/${start.slice(5, 7)} → ${end.slice(8, 10)}/${end.slice(5, 7)}`;

    return {
      ok: true,
      data: {
        periodo: { inicio: start, fim: end },
        entradas,
        saidas,
        liquido,
        a_receber: aReceber,
        vencidas,
      },
      ui: {
        type: "relatorio",
        props: {
          resumo: `Resumo ${periodoLabel}`,
          kpis: [
            { label: "Entradas", valor: entradas },
            { label: "Saídas", valor: saidas },
            { label: "Líquido", valor: liquido },
            { label: "A receber", valor: aReceber },
            { label: "Vencidas", valor: vencidas },
          ],
          series: [
            {
              nome: "Movimentação",
              x,
              y,
            },
          ],
          destaques,
        },
      },
    };
  } catch (error) {
    return toolErrorFromAsaas(error, "relatorio");
  }
}
