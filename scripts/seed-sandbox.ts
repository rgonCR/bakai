/**
 * Seed do sandbox Asaas na conta MAIN (integradora / ASAAS_MASTER_KEY).
 * Clientes + cobranças recebidas, pendentes e vencidas.
 *
 * Limitação Asaas: dueDate não pode ser no passado e o confirm do sandbox
 * sempre liquida em "hoje". Para o gráfico de Movimentação ficar espalhado,
 * gravamos a data desejada em externalReference (`seed-bankai|YYYY-MM-DD|n`)
 * e o relatório do bank.ai usa essa data na série.
 *
 * Uso:
 *   npm run seed:sandbox
 *   # lê ASAAS_MASTER_KEY do .env.local (conta main)
 *   # override: ASAAS_KEY=... npm run seed:sandbox
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const BASE = "https://api-sandbox.asaas.com/v3";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

const KEY =
  process.env.ASAAS_KEY ||
  process.env.ASAAS_SEED_KEY ||
  process.env.ASAAS_MASTER_KEY;
if (!KEY) {
  throw new Error(
    "Defina ASAAS_MASTER_KEY no .env.local (conta main) ou ASAAS_KEY.",
  );
}

const KEY_SOURCE = process.env.ASAAS_KEY
  ? "ASAAS_KEY"
  : process.env.ASAAS_SEED_KEY
    ? "ASAAS_SEED_KEY"
    : "ASAAS_MASTER_KEY (conta main)";

async function api<T = Record<string, unknown>>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      access_token: KEY!,
      "Content-Type": "application/json",
      "User-Agent": "bank.ai-seed",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as T & {
    errors?: unknown;
  };
  if (!res.ok) {
    throw new Error(
      `${method} ${path} -> ${res.status} ${JSON.stringify(json)}`,
    );
  }
  return json;
}

/** CPF válido aleatório (só teste) */
function cpf(): string {
  const n = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  const dv = (arr: number[]) => {
    const s = arr.reduce((acc, d, i) => acc + d * (arr.length + 1 - i), 0);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  n.push(dv(n));
  n.push(dv(n));
  return n.join("");
}

const emDias = (d: number) => {
  const dt = new Date();
  dt.setHours(12, 0, 0, 0);
  dt.setDate(dt.getDate() + d);
  return dt.toISOString().slice(0, 10);
};

/** Datas de caixa espalhadas do dia 1 do mês até hoje (relatório do mês corrente). */
function datasCaixaNoMes(qtd: number): string[] {
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 12);
  const days: string[] = [];
  const cur = new Date(start);
  while (cur <= now) {
    days.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  if (days.length === 0) return [emDias(0)];
  if (qtd <= 1) return [days[days.length - 1]!];
  const out: string[] = [];
  for (let i = 0; i < qtd; i++) {
    const idx = Math.round((i / (qtd - 1)) * (days.length - 1));
    out.push(days[idx]!);
  }
  return out;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const CLIENTES = [
  "Joao Silva",
  "Joao Pereira",
  "Maria Souza",
  "Padaria Pao Quente",
  "Ana Costa",
  "Studio Lumen",
  "Carlos Lima",
  "Oficina do Beto",
  "Mercado Bom Preco",
  "Clinica Vida",
];

type Destino = "recebida" | "pendente" | "vencida";

type PlanoItem = {
  valor: number;
  destino: Destino;
  /**
   * Offset da dueDate real na API (só >= 0 — Asaas rejeita passado).
   * Pendentes: dias até o vencimento. Recebidas/vencidas: 0.
   */
  dueOffset: number;
  descricao: string;
};

/** Histórico + próximos vencimentos (datas de caixa das recebidas = 1º→hoje) */
const PLANO: PlanoItem[] = [
  // Recebidas — confirm no sandbox = hoje; data do gráfico vem do externalReference
  {
    valor: 1200,
    destino: "recebida",
    dueOffset: 0,
    descricao: "Mensalidade set/João Silva",
  },
  {
    valor: 350,
    destino: "recebida",
    dueOffset: 0,
    descricao: "Consulta Studio Lumen",
  },
  {
    valor: 890,
    destino: "recebida",
    dueOffset: 0,
    descricao: "Pedido Padaria",
  },
  {
    valor: 2400,
    destino: "recebida",
    dueOffset: 0,
    descricao: "Projeto site Ana Costa",
  },
  {
    valor: 480,
    destino: "recebida",
    dueOffset: 0,
    descricao: "Manutenção Oficina Beto",
  },
  {
    valor: 150,
    destino: "recebida",
    dueOffset: 0,
    descricao: "Assinatura Clínica Vida",
  },
  {
    valor: 3200,
    destino: "recebida",
    dueOffset: 0,
    descricao: "Contrato Mercado Bom Preço",
  },
  {
    valor: 620,
    destino: "recebida",
    dueOffset: 0,
    descricao: "Serviço Carlos Lima",
  },

  // Pendentes — vencimento ao longo do mês
  { valor: 350, destino: "pendente", dueOffset: 2, descricao: "Pix Maria Souza" },
  {
    valor: 990,
    destino: "pendente",
    dueOffset: 5,
    descricao: "Boleto João Pereira",
  },
  {
    valor: 1500,
    destino: "pendente",
    dueOffset: 8,
    descricao: "Fatura Studio Lumen",
  },
  { valor: 275, destino: "pendente", dueOffset: 12, descricao: "Pedido Padaria" },
  {
    valor: 780,
    destino: "pendente",
    dueOffset: 18,
    descricao: "Mensalidade Ana Costa",
  },
  {
    valor: 420,
    destino: "pendente",
    dueOffset: 22,
    descricao: "Serviço Clínica Vida",
  },

  // Vencidas — força overdue no sandbox
  {
    valor: 450,
    destino: "vencida",
    dueOffset: 0,
    descricao: "Atraso João Silva",
  },
  {
    valor: 800,
    destino: "vencida",
    dueOffset: 0,
    descricao: "Atraso Oficina Beto",
  },
  {
    valor: 120,
    destino: "vencida",
    dueOffset: 0,
    descricao: "Atraso Carlos Lima",
  },
  {
    valor: 1350,
    destino: "vencida",
    dueOffset: 0,
    descricao: "Atraso Mercado Bom Preço",
  },
  {
    valor: 210,
    destino: "vencida",
    dueOffset: 0,
    descricao: "Atraso Maria Souza",
  },
];

async function main() {
  console.log(`Seed bank.ai → sandbox Asaas (${KEY_SOURCE})\n`);
  console.log(
    "Nota: liquidação Asaas = hoje; datas de caixa vão em externalReference pro gráfico.\n",
  );

  const me = await api<{ name?: string; email?: string; walletId?: string }>(
    "/myAccount",
  );
  console.log(
    `Conta: ${me.name || "—"} · ${me.email || "—"} · wallet ${me.walletId || "—"}\n`,
  );

  console.log("Criando clientes…");
  const ids: string[] = [];
  for (const name of CLIENTES) {
    const email = `${name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .split(" ")[0]!
      .toLowerCase()}.${Date.now().toString(36)}@exemplo.com`;
    const c = await api<{ id: string }>("/customers", "POST", {
      name,
      cpfCnpj: cpf(),
      email,
      mobilePhone: "1199999" + String(Math.floor(1000 + Math.random() * 8999)),
    });
    ids.push(c.id);
    console.log(`  + ${name}`);
    await sleep(150);
  }

  const recebidas = PLANO.filter((p) => p.destino === "recebida");
  const caixas = datasCaixaNoMes(recebidas.length);
  let caixaIdx = 0;

  console.log("\nCriando cobranças…");
  for (const [i, item] of PLANO.entries()) {
    const dueDate = emDias(item.dueOffset);
    const caixaDate =
      item.destino === "recebida"
        ? caixas[caixaIdx++] ?? emDias(0)
        : dueDate;
    const billingType =
      i % 3 === 0 ? "BOLETO" : i % 3 === 1 ? "PIX" : "UNDEFINED";

    const p = await api<{ id: string }>("/payments", "POST", {
      customer: ids[i % ids.length],
      billingType,
      value: item.valor,
      dueDate,
      description: item.descricao,
      externalReference: `seed-bankai|${caixaDate}|${i + 1}`,
    });

    if (item.destino === "recebida") {
      await api(`/sandbox/payment/${p.id}/confirm`, "POST", {});
    }
    if (item.destino === "vencida") {
      await api(`/sandbox/payment/${p.id}/overdue`, "POST", {});
    }

    const caixaHint =
      item.destino === "recebida" ? `  caixa→${caixaDate}` : "";
    console.log(
      `  ${item.destino.padEnd(8)} R$ ${item.valor.toFixed(2).padStart(8)}  vence ${dueDate}${caixaHint}  ${p.id}`,
    );
    await sleep(220);
  }

  const saldo = await api<{ balance: number }>("/finance/balance");
  const pending = await api<{ totalCount?: number; data?: unknown[] }>(
    "/payments?status=PENDING&limit=1",
  );
  const overdue = await api<{ totalCount?: number; data?: unknown[] }>(
    "/payments?status=OVERDUE&limit=1",
  );

  console.log(`\nSaldo:     R$ ${Number(saldo.balance).toFixed(2)}`);
  console.log(`Pendentes: ~${pending.totalCount ?? pending.data?.length ?? "?"}`);
  console.log(`Vencidas:  ~${overdue.totalCount ?? overdue.data?.length ?? "?"}`);
  console.log("\nPronto — peça o relatório de novo na home.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
