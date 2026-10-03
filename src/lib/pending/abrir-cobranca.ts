import { z } from "zod";
import type { AsaasEnv } from "@/lib/asaas/client";
import {
  looksLikeCpfCnpj,
  searchCustomers,
} from "@/lib/asaas/customers";
import type { ToolResult } from "@/lib/agent/types";
import type { CobrancaStepId } from "@/lib/chat/cobranca-draft";

export const abrirCobrancaInputSchema = z.object({
  cliente: z.string().optional().describe("Nome do cliente se já souber"),
  cliente_id: z.string().optional(),
  cpf_cnpj: z.string().optional(),
  valor: z.number().positive().optional(),
  vencimento: z
    .string()
    .optional()
    .describe("YYYY-MM-DD se já souber (converta datas relativas)"),
  forma: z
    .enum(["UNDEFINED", "PIX", "BOLETO", "CREDIT_CARD"])
    .optional()
    .describe("Só se o usuário pediu explicitamente"),
  email: z.string().optional(),
  telefone: z.string().optional(),
  descricao: z.string().optional(),
  open_wizard: z
    .boolean()
    .optional()
    .describe(
      "true = streama formulário passo a passo no chat (padrão quando faltam dados); false = só pergunta 1 dado no chat",
    ),
});

export type AbrirCobrancaInput = z.infer<typeof abrirCobrancaInputSchema>;

function inferStep(input: AbrirCobrancaInput): CobrancaStepId | undefined {
  if (!input.cliente?.trim() && !input.cliente_id?.trim()) return "cliente";
  if (!(input.valor && input.valor > 0) || !input.vencimento?.trim()) {
    return "valor_vencimento";
  }
  if (!input.forma) return "forma";
  // não pede contato de novo se já veio do cadastro Asaas
  if (!input.email?.trim() && !input.telefone?.trim()) return "contato";
  return undefined;
}

/**
 * Abre rascunho (painel = resumo). Não cria pending_action.
 * Resolve cliente único no Asaas para preencher CPF/id/contato.
 */
export async function abrirCobranca(opts: {
  apiKey: string;
  env: AsaasEnv;
  input: AbrirCobrancaInput;
}): Promise<ToolResult> {
  const input = { ...opts.input };
  const clienteRaw = input.cliente?.trim();

  if (!input.cliente_id && clienteRaw) {
    try {
      if (looksLikeCpfCnpj(clienteRaw)) {
        const cpf = clienteRaw.replace(/\D/g, "");
        const byCpf = await searchCustomers(opts.apiKey, opts.env, {
          cpfCnpj: cpf,
        });
        if (byCpf[0]) {
          input.cliente_id = byCpf[0].id;
          input.cliente = byCpf[0].name || clienteRaw;
          input.cpf_cnpj = byCpf[0].cpfCnpj || cpf;
          input.email = input.email || byCpf[0].email;
          input.telefone =
            input.telefone || byCpf[0].mobilePhone || byCpf[0].phone;
        } else {
          input.cpf_cnpj = input.cpf_cnpj || cpf;
        }
      } else {
        const found = await searchCustomers(opts.apiKey, opts.env, {
          name: clienteRaw,
        });
        if (found.length === 1) {
          const c = found[0]!;
          input.cliente_id = c.id;
          input.cliente = c.name || clienteRaw;
          input.cpf_cnpj = input.cpf_cnpj || c.cpfCnpj;
          input.email = input.email || c.email;
          input.telefone = input.telefone || c.mobilePhone || c.phone;
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
        }
      }
    } catch {
      // segue com o que o usuário passou
    }
  }

  const activeStepId = inferStep(input);
  const missingRequired =
    (!input.cliente?.trim() && !input.cliente_id?.trim()) ||
    !(input.valor && input.valor > 0) ||
    !input.vencimento?.trim();
  const openWizard =
    input.open_wizard ?? (missingRequired || Boolean(activeStepId));

  return {
    ok: true,
    data: {
      task: "cobranca",
      patch: input,
      activeStepId,
      open_wizard: openWizard,
      resolved: Boolean(input.cliente_id),
    },
    ui: {
      type: "task_draft",
      props: {
        task: "cobranca",
        open_wizard: openWizard,
        patch: {
          cliente: input.cliente,
          cliente_id: input.cliente_id,
          cpf_cnpj: input.cpf_cnpj,
          valor: input.valor,
          vencimento: input.vencimento,
          forma: input.forma,
          email: input.email,
          telefone: input.telefone,
          descricao: input.descricao,
          activeStepId,
        },
      },
    },
  };
}
