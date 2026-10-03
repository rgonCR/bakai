import { z } from "zod";
import type { AsaasEnv } from "@/lib/asaas/client";
import {
  looksLikeCpfCnpj,
  searchCustomers,
} from "@/lib/asaas/customers";
import type { ToolResult } from "@/lib/agent/types";

export const resolverClienteInputSchema = z.object({
  texto: z
    .string()
    .min(2)
    .describe("Nome, CPF/CNPJ ou trecho para achar o cliente"),
  contexto: z.string().optional(),
});

export type ResolverClienteInput = z.infer<typeof resolverClienteInputSchema>;

export async function resolverCliente(opts: {
  apiKey: string;
  env: AsaasEnv;
  input: ResolverClienteInput;
}): Promise<ToolResult> {
  const texto = opts.input.texto.trim();
  if (!texto) {
    return {
      ok: false,
      error: {
        code: "VALIDATION",
        message_humana: "Me diga o nome ou CPF/CNPJ do cliente.",
      },
    };
  }

  try {
    const found = looksLikeCpfCnpj(texto)
      ? await searchCustomers(opts.apiKey, opts.env, {
          cpfCnpj: texto.replace(/\D/g, ""),
        })
      : await searchCustomers(opts.apiKey, opts.env, { name: texto });

    if (found.length === 0) {
      return {
        ok: true,
        data: {
          match: "nenhum" as const,
          texto,
        },
      };
    }

    if (found.length === 1) {
      const c = found[0]!;
      return {
        ok: true,
        data: {
          match: "unico" as const,
          cliente_id: c.id,
          nome: c.name,
          cpf_cnpj: c.cpfCnpj,
          email: c.email,
          telefone: c.mobilePhone || c.phone,
        },
      };
    }

    return {
      ok: true,
      data: {
        match: "multiplos" as const,
        total: found.length,
      },
      ui: {
        type: "escolha",
        props: {
          pergunta: "Qual cliente você quer?",
          opcoes: found.slice(0, 8).map((c) => ({
            id: c.id,
            label: c.name || c.id,
            sub: c.cpfCnpj,
          })),
        },
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "ASAAS_ERROR",
        message_humana:
          error instanceof Error
            ? error.message
            : "Não consegui buscar o cliente agora.",
      },
    };
  }
}
