import { randomUUID } from "crypto";
import { z } from "zod";
import type { AsaasEnv } from "@/lib/asaas/client";
import {
  createCustomer,
  looksLikeCpfCnpj,
  searchCustomers,
} from "@/lib/asaas/customers";
import {
  createPayment,
  getPaymentPixQr,
  type AsaasBillingType,
} from "@/lib/asaas/payments";
import {
  asaasBillingTypeLabel,
  asaasPaymentStatusLabel,
} from "@/lib/asaas/status";
import type { ToolResult, UICard } from "@/lib/agent/types";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const formaSchema = z.enum(["UNDEFINED", "PIX", "BOLETO", "CREDIT_CARD"]);
const tipoSchema = z.enum(["avulsa", "recorrente"]);

export const prepararCobrancaInputSchema = z.object({
  cliente: z
    .string()
    .min(2)
    .describe("Nome do cliente ou CPF/CNPJ"),
  cliente_id: z
    .string()
    .optional()
    .describe("ID Asaas do cliente, se já resolvido (ex.: card de escolha)"),
  valor: z.number().positive().describe("Valor em reais, ex.: 350"),
  vencimento: z
    .string()
    .describe("Data de vencimento YYYY-MM-DD (≥ hoje)"),
  tipo: tipoSchema
    .optional()
    .describe("avulsa (default) ou recorrente (ainda fora do MVP)"),
  forma: formaSchema
    .optional()
    .describe("UNDEFINED default; PIX; BOLETO; CREDIT_CARD"),
  descricao: z.string().optional(),
  cpf_cnpj: z
    .string()
    .optional()
    .describe("CPF/CNPJ se for cliente novo"),
  criar_cliente: z
    .boolean()
    .optional()
    .describe("true = cadastrar cliente novo; false = só buscar existente"),
  email: z.string().optional(),
  telefone: z.string().optional(),
});

export type PrepararCobrancaInput = z.infer<typeof prepararCobrancaInputSchema>;

export type CobrancaPayload = {
  cliente_id?: string;
  cliente_nome: string;
  cpf_cnpj?: string;
  email?: string;
  telefone?: string;
  criar_cliente?: boolean;
  tipo: "avulsa";
  valor: number;
  vencimento: string;
  forma: AsaasBillingType;
  descricao?: string;
  editaveis: string[];
};

function brl(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function todayYmd() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
}

function parseVencimento(raw: string): string | null {
  const m = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function digitsPhone(raw?: string) {
  return raw?.replace(/\D/g, "") ?? "";
}

export async function prepararCobranca(opts: {
  supabase: Supabase;
  accountId: string;
  conversationId: string;
  apiKey: string;
  env: AsaasEnv;
  input: PrepararCobrancaInput;
}): Promise<ToolResult> {
  const vencimento = parseVencimento(opts.input.vencimento);
  if (!vencimento) {
    return {
      ok: false,
      error: {
        code: "VALIDATION",
        message_humana: "Use a data de vencimento no formato AAAA-MM-DD.",
      },
    };
  }
  if (vencimento < todayYmd()) {
    return {
      ok: false,
      error: {
        code: "VALIDATION",
        message_humana: "O vencimento precisa ser hoje ou uma data futura.",
      },
    };
  }

  if (opts.input.tipo === "recorrente") {
    return {
      ok: false,
      error: {
        code: "VALIDATION",
        message_humana:
          "Cobrança recorrente ainda não está disponível neste MVP. Posso preparar uma avulsa com os mesmos dados.",
      },
    };
  }

  const forma = (opts.input.forma ?? "UNDEFINED") as AsaasBillingType;
  const clienteRaw = opts.input.cliente.trim();
  const cpfHint = opts.input.cpf_cnpj?.replace(/\D/g, "");
  const email = opts.input.email?.trim() || undefined;
  const telefone = digitsPhone(opts.input.telefone) || undefined;

  let clienteId: string | undefined = opts.input.cliente_id?.trim() || undefined;
  let clienteNome = clienteRaw;
  let criarCliente = false;
  let cpfCnpj = cpfHint;
  let emailExistente: string | undefined;
  let telefoneExistente: string | undefined;
  const forceNovo = opts.input.criar_cliente === true;
  const forceExistente = opts.input.criar_cliente === false;

  if (forceNovo) {
    if (!cpfCnpj || cpfCnpj.length < 11) {
      return {
        ok: false,
        error: {
          code: "VALIDATION",
          message_humana:
            "Para cliente novo, informe o CPF/CNPJ (11 ou 14 dígitos).",
        },
      };
    }
    criarCliente = true;
  } else if (clienteId) {
    // id já escolhido — segue
  } else if (looksLikeCpfCnpj(clienteRaw)) {
    cpfCnpj = clienteRaw.replace(/\D/g, "");
    const byCpf = await searchCustomers(opts.apiKey, opts.env, {
      cpfCnpj,
    });
    if (byCpf[0]) {
      clienteId = byCpf[0].id;
      clienteNome = byCpf[0].name || clienteRaw;
      emailExistente = byCpf[0].email;
      telefoneExistente = byCpf[0].mobilePhone;
    } else if (forceExistente) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message_humana:
            "Não achei cliente com esse CPF/CNPJ. Troque para «Criar novo» ou confira o documento.",
        },
      };
    } else {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message_humana:
            "Não achei cliente com esse CPF/CNPJ. Me passa o nome completo para eu cadastrar junto.",
        },
      };
    }
  } else {
    let found =
      cpfCnpj && cpfCnpj.length >= 11
        ? await searchCustomers(opts.apiKey, opts.env, { cpfCnpj })
        : [];
    if (found.length === 0) {
      found = await searchCustomers(opts.apiKey, opts.env, {
        name: clienteRaw,
      });
    }
    if (found.length === 1) {
      clienteId = found[0]!.id;
      clienteNome = found[0]!.name || clienteRaw;
      cpfCnpj = found[0]!.cpfCnpj;
      emailExistente = found[0]!.email;
      telefoneExistente = found[0]!.mobilePhone;
    } else if (found.length > 1) {
      return {
        ok: true,
        data: { match: "multiplos" },
        ui: {
          type: "escolha",
          props: {
            pergunta: "Qual cliente você quer cobrar?",
            opcoes: found.slice(0, 6).map((c) => ({
              id: c.id,
              label: c.name || c.id,
              sub: c.cpfCnpj,
            })),
          },
        },
      };
    } else if (!forceExistente && cpfCnpj && cpfCnpj.length >= 11) {
      criarCliente = true;
    } else {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message_humana: forceExistente
            ? `Não achei "${clienteRaw}" nos clientes. Confira o nome ou escolha «Criar novo».`
            : `Não achei "${clienteRaw}" nos clientes. Me passa o CPF/CNPJ para cadastrar e cobrar.`,
        },
      };
    }
  }

  const payload: CobrancaPayload = {
    cliente_id: clienteId,
    cliente_nome: clienteNome,
    cpf_cnpj: cpfCnpj,
    email: email || emailExistente,
    telefone: telefone || telefoneExistente,
    criar_cliente: criarCliente,
    tipo: "avulsa",
    valor: opts.input.valor,
    vencimento,
    forma,
    descricao: opts.input.descricao,
    editaveis: ["valor", "vencimento", "forma"],
  };

  await opts.supabase
    .from("pending_actions")
    .update({ status: "cancelled" })
    .eq("conversation_id", opts.conversationId)
    .eq("type", "preparar_cobranca")
    .eq("status", "pending");

  const idempotencyKey = `cobranca:${opts.accountId}:${opts.conversationId}:${randomUUID()}`;
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { data: pending, error } = await opts.supabase
    .from("pending_actions")
    .insert({
      account_id: opts.accountId,
      conversation_id: opts.conversationId,
      type: "preparar_cobranca",
      payload,
      status: "pending",
      idempotency_key: idempotencyKey,
      expires_at: expiresAt,
    })
    .select("id")
    .single();

  if (error || !pending) {
    return {
      ok: false,
      error: {
        code: "ASAAS_ERROR",
        message_humana: "Não consegui preparar a cobrança. Tente de novo.",
      },
    };
  }

  const ui: UICard = {
    type: "confirmacao",
    props: {
      pending_action_id: pending.id as string,
      titulo: "Nova cobrança",
      linhas: [
        { label: "Cliente", valor: clienteNome },
        { label: "Tipo", valor: "Avulsa" },
        { label: "Valor", valor: brl(payload.valor) },
        { label: "Vencimento", valor: formatDateBr(vencimento) },
        { label: "Forma", valor: asaasBillingTypeLabel(forma) },
        ...(payload.email
          ? [{ label: "E-mail", valor: payload.email }]
          : []),
        ...(payload.telefone
          ? [{ label: "WhatsApp", valor: payload.telefone }]
          : []),
        ...(payload.descricao
          ? [{ label: "Descrição", valor: payload.descricao }]
          : []),
        ...(criarCliente
          ? [
              {
                label: "Cadastro",
                valor: "Cliente novo será criado ao confirmar",
              },
            ]
          : []),
      ],
      editaveis: payload.editaveis,
      cta: `Confirmar criação de cobrança para ${clienteNome} no valor de ${brl(payload.valor)}`,
    },
  };

  return {
    ok: true,
    data: { pending_action_id: pending.id, payload },
    ui,
  };
}

function formatDateBr(ymd: string) {
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
}

export type ExecuteEdits = {
  valor?: number;
  vencimento?: string;
  forma?: AsaasBillingType;
};

export async function executeCobranca(opts: {
  apiKey: string;
  env: AsaasEnv;
  payload: CobrancaPayload;
  edits?: ExecuteEdits;
}): Promise<
  { ok: true; ui: UICard; result: unknown } | { ok: false; message: string }
> {
  const valor = opts.edits?.valor ?? opts.payload.valor;
  const vencimento = opts.edits?.vencimento ?? opts.payload.vencimento;
  const forma = opts.edits?.forma ?? opts.payload.forma;

  if (!(valor > 0)) {
    return { ok: false, message: "Valor inválido." };
  }
  if (!vencimento || vencimento < todayYmd()) {
    return { ok: false, message: "Vencimento inválido." };
  }

  let customerId = opts.payload.cliente_id;
  if (!customerId && opts.payload.criar_cliente && opts.payload.cpf_cnpj) {
    const created = await createCustomer(opts.apiKey, opts.env, {
      name: opts.payload.cliente_nome,
      cpfCnpj: opts.payload.cpf_cnpj,
      email: opts.payload.email,
      mobilePhone: opts.payload.telefone,
    });
    customerId = created.id;
  }
  if (!customerId) {
    return { ok: false, message: "Cliente da cobrança não encontrado." };
  }

  const payment = await createPayment(opts.apiKey, opts.env, {
    customer: customerId,
    billingType: forma,
    value: valor,
    dueDate: vencimento,
    description: opts.payload.descricao,
  });

  let pix: string | undefined;
  if (forma === "PIX" || forma === "UNDEFINED") {
    try {
      const qr = await getPaymentPixQr(opts.apiKey, opts.env, payment.id);
      pix = qr.payload;
    } catch {
      // opcional
    }
  }

  const linhas = [
    { label: "Cliente", valor: opts.payload.cliente_nome },
    { label: "Tipo", valor: "Avulsa" },
    { label: "Valor", valor: brl(valor) },
    { label: "Vencimento", valor: formatDateBr(vencimento) },
    { label: "Forma", valor: asaasBillingTypeLabel(forma) },
    { label: "Status", valor: asaasPaymentStatusLabel(payment.status) },
    { label: "ID", valor: payment.id },
  ];
  if (payment.invoiceUrl) {
    linhas.push({ label: "Link", valor: payment.invoiceUrl });
  }
  if (pix) {
    linhas.push({ label: "Pix copia e cola", valor: pix });
  }

  return {
    ok: true,
    result: { payment, pix },
    ui: {
      type: "sucesso",
      props: {
        titulo: "Cobrança criada",
        linhas,
        link: payment.invoiceUrl,
        cta_secundario: "Nova cobrança",
      },
    },
  };
}
