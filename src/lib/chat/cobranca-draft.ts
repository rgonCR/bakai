import type { AsaasBillingType } from "@/lib/asaas/payments";
import type { FormBlock } from "@/lib/chat/types";

export type CobrancaDraftStatus =
  | "draft"
  | "ready"
  | "pending_confirm"
  | "executing"
  | "done"
  | "failed";

export type CobrancaDraftMissing = "cliente" | "valor" | "vencimento";

export type CobrancaDraft = {
  taskId: string;
  conversationId?: string;
  status: CobrancaDraftStatus;
  panelOpen: boolean;
  /** true = cadastrar novo; false = buscar já cadastrado */
  cliente_novo?: boolean;
  cliente?: string;
  cliente_id?: string;
  cpf_cnpj?: string;
  valor?: number;
  vencimento?: string;
  tipo: "avulsa";
  forma: AsaasBillingType;
  email?: string;
  telefone?: string;
  descricao?: string;
  pending_action_id?: string;
  resultLink?: string;
  errorMessage?: string;
  /** step do wizard no chat */
  activeStepId?: CobrancaStepId;
};

export type CobrancaStepId =
  | "cliente"
  | "valor_vencimento"
  | "forma"
  | "contato";

export type CobrancaDraftPatch = Partial<
  Omit<CobrancaDraft, "taskId" | "tipo" | "missing">
> & {
  tipo?: "avulsa";
};

export function createEmptyCobrancaDraft(
  patch?: CobrancaDraftPatch,
): CobrancaDraft {
  return {
    taskId: crypto.randomUUID(),
    status: "draft",
    panelOpen: true,
    tipo: "avulsa",
    forma: "UNDEFINED",
    cliente_novo: false,
    activeStepId: "cliente",
    ...patch,
  };
}

export function cobrancaMissing(
  draft: Pick<CobrancaDraft, "cliente" | "cliente_id" | "valor" | "vencimento">,
): CobrancaDraftMissing[] {
  const missing: CobrancaDraftMissing[] = [];
  if (!draft.cliente?.trim() && !draft.cliente_id?.trim()) {
    missing.push("cliente");
  }
  if (!(typeof draft.valor === "number" && draft.valor > 0)) {
    missing.push("valor");
  }
  if (!draft.vencimento?.trim()) {
    missing.push("vencimento");
  }
  return missing;
}

export function isCobrancaReady(draft: CobrancaDraft) {
  return cobrancaMissing(draft).length === 0;
}

export function mergeCobrancaDraft(
  current: CobrancaDraft | null,
  patch: CobrancaDraftPatch,
): CobrancaDraft {
  const base = current ?? createEmptyCobrancaDraft();
  const next: CobrancaDraft = {
    ...base,
    ...patch,
    tipo: "avulsa",
    forma: patch.forma ?? base.forma ?? "UNDEFINED",
    panelOpen: patch.panelOpen ?? true,
  };
  if (isCobrancaReady(next) && next.status === "draft") {
    next.status = "ready";
  } else if (!isCobrancaReady(next) && next.status === "ready") {
    next.status = "draft";
  }
  return next;
}

function hasContact(
  draft: Pick<CobrancaDraft, "email" | "telefone">,
) {
  return Boolean(draft.email?.trim() || draft.telefone?.trim());
}

/**
 * Próximo passo do wizard no chat.
 * Obrigatórios primeiro; forma opcional; contato só se ainda não houver e-mail/WhatsApp.
 */
export function nextCobrancaStep(
  draft: CobrancaDraft,
): CobrancaStepId | null {
  const missing = cobrancaMissing(draft);
  if (missing.includes("cliente")) return "cliente";
  if (missing.includes("valor") || missing.includes("vencimento")) {
    return "valor_vencimento";
  }

  const current = draft.activeStepId;
  if (!current) return null;

  if (current === "cliente") return "valor_vencimento";
  if (current === "valor_vencimento") return "forma";
  if (current === "forma") {
    // já tem contato no Asaas/rascunho → não pede de novo
    return hasContact(draft) ? null : "contato";
  }
  return null;
}

/** Steps do wizard — um FormBlock por passo */
export function cobrancaStepForm(
  stepId: CobrancaStepId,
  draft: CobrancaDraft,
): FormBlock {
  if (stepId === "cliente") {
    const novo = draft.cliente_novo === true;
    return {
      task: "cobranca",
      stepId: "cliente",
      title: "Cliente",
      subtitle: "Quem você quer cobrar?",
      submitLabel: "Avançar",
      fields: [
        {
          id: "cliente_modo",
          label: "Cadastro",
          type: "boolean",
          required: true,
          value: novo ? "novo" : "existente",
          options: [
            { value: "existente", label: "Já cadastrado" },
            { value: "novo", label: "Criar novo" },
          ],
        },
        {
          id: "cliente",
          label: "Nome",
          required: true,
          placeholder: "Nome completo",
          value: draft.cliente ?? "",
        },
        {
          id: "cpf_cnpj",
          label: "CPF/CNPJ",
          required: novo,
          hint: novo
            ? "Obrigatório para cadastrar o cliente"
            : "Opcional — ajuda a achar o cadastro",
          placeholder: "000.000.000-00",
          value: draft.cpf_cnpj ?? "",
        },
      ],
    };
  }

  if (stepId === "valor_vencimento") {
    return {
      task: "cobranca",
      stepId: "valor_vencimento",
      title: "Valor e vencimento",
      submitLabel: "Avançar",
      fields: [
        {
          id: "valor",
          label: "Valor",
          type: "number",
          required: true,
          placeholder: "0,00",
          value:
            draft.valor != null
              ? draft.valor.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })
              : "",
        },
        {
          id: "vencimento",
          label: "Vencimento",
          type: "date",
          required: true,
          value: draft.vencimento ?? "",
        },
      ],
    };
  }

  if (stepId === "forma") {
    return {
      task: "cobranca",
      stepId: "forma",
      title: "Forma de pagamento",
      subtitle: "Opcional — se pular, o cliente escolhe Pix, boleto ou cartão",
      submitLabel: "Avançar",
      optionalSkip: true,
      skipLabel: "Pular — cliente escolhe",
      fields: [
        {
          id: "forma",
          label: "Forma",
          type: "select",
          required: false,
          options: [
            {
              value: "UNDEFINED",
              label: "Cliente escolhe (Pix, boleto ou cartão)",
            },
            { value: "PIX", label: "Só Pix" },
            { value: "BOLETO", label: "Só boleto" },
            { value: "CREDIT_CARD", label: "Só cartão de crédito" },
          ],
          value: draft.forma ?? "UNDEFINED",
        },
      ],
    };
  }

  return {
    task: "cobranca",
    stepId: "contato",
    title: "Contato e descrição",
    subtitle: "Opcional — ajuda o Asaas a avisar o cliente",
    submitLabel: "Avançar",
    optionalSkip: true,
    skipLabel: "Pular",
    fields: [
      {
        id: "email",
        label: "E-mail",
        type: "email",
        required: false,
        placeholder: "cliente@email.com",
        value: draft.email ?? "",
      },
      {
        id: "telefone",
        label: "WhatsApp",
        type: "tel",
        required: false,
        placeholder: "11999999999",
        value: draft.telefone ?? "",
      },
      {
        id: "descricao",
        label: "Descrição",
        type: "textarea",
        required: false,
        placeholder: "Opcional",
        value: draft.descricao ?? "",
      },
    ],
  };
}

/** Texto de auditoria no chat quando o usuário avança um passo */
export function formatWizardAudit(
  stepId: CobrancaStepId,
  values: Record<string, string>,
  skip = false,
): string {
  if (skip) {
    if (stepId === "forma") return "Avançar — forma: cliente escolhe";
    if (stepId === "contato") return "Avançar — sem contato adicional";
    return "Avançar (pulei este passo)";
  }

  if (stepId === "cliente") {
    const nome = values.cliente?.trim() || "—";
    const cpf = values.cpf_cnpj?.trim();
    const modo =
      values.cliente_modo === "novo" ? "cliente novo" : "cliente cadastrado";
    return cpf
      ? `Avançar com ${modo} ${nome}, CPF/CNPJ ${cpf}`
      : `Avançar com ${modo} ${nome}`;
  }

  if (stepId === "valor_vencimento") {
    const valorFmt = formatValorAudit(values.valor);
    const venc = formatDateBrAudit(values.vencimento);
    return `Avançar com valor ${valorFmt} e vencimento ${venc}`;
  }

  if (stepId === "forma") {
    const map: Record<string, string> = {
      UNDEFINED: "cliente escolhe",
      PIX: "Pix",
      BOLETO: "boleto",
      CREDIT_CARD: "cartão de crédito",
    };
    const forma = values.forma || "UNDEFINED";
    return `Avançar com forma ${map[forma] ?? forma}`;
  }

  const parts: string[] = [];
  const whatsapp = values.telefone?.trim();
  const email = values.email?.trim();
  const descricao = values.descricao?.trim();
  if (whatsapp) parts.push(`whatsapp ${whatsapp}`);
  if (email) parts.push(`email ${email}`);
  if (descricao) parts.push(`descrição ${descricao}`);
  if (parts.length === 0) return "Avançar — sem contato adicional";
  return `Avançar com ${parts.join(", ")}`;
}

function formatValorAudit(raw?: string) {
  if (!raw?.trim()) return "—";
  const n = Number(raw.replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(n)) return raw;
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/** YYYY-MM-DD → dd/mm/aaaa */
export function formatDateBrAudit(ymd?: string) {
  if (!ymd?.trim()) return "—";
  const m = ymd.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return ymd;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function formatConfirmCobrancaAudit(opts: {
  nome?: string;
  valor?: number;
}) {
  const nome = opts.nome?.trim() || "cliente";
  const valor =
    typeof opts.valor === "number"
      ? opts.valor.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        })
      : "—";
  return `Confirmar criação de cobrança para ${nome} no valor de ${valor}`;
}

export function patchFromFormValues(
  stepId: CobrancaStepId,
  values: Record<string, string>,
): CobrancaDraftPatch {
  if (stepId === "cliente") {
    const novo = values.cliente_modo === "novo";
    return {
      cliente_novo: novo,
      cliente: values.cliente?.trim() || undefined,
      cpf_cnpj: values.cpf_cnpj?.replace(/\D/g, "") || undefined,
      // ao mudar modo, limpa id resolvido anteriormente
      cliente_id: undefined,
      activeStepId: "valor_vencimento",
    };
  }
  if (stepId === "valor_vencimento") {
    const raw = values.valor?.replace(/\./g, "").replace(",", ".") ?? "";
    const valor = Number(raw);
    return {
      valor: Number.isFinite(valor) && valor > 0 ? valor : undefined,
      vencimento: values.vencimento?.trim() || undefined,
      activeStepId: "forma",
    };
  }
  if (stepId === "forma") {
    const forma = (values.forma || "UNDEFINED") as AsaasBillingType;
    return {
      forma:
        forma === "PIX" ||
        forma === "BOLETO" ||
        forma === "CREDIT_CARD" ||
        forma === "UNDEFINED"
          ? forma
          : "UNDEFINED",
      // contato só se ainda não houver — nextCobrancaStep decide
      activeStepId: "forma",
    };
  }
  return {
    email: values.email?.trim() || undefined,
    telefone: values.telefone?.replace(/\D/g, "") || undefined,
    descricao: values.descricao?.trim() || undefined,
    activeStepId: undefined,
  };
}

export function statusPillLabel(status: CobrancaDraftStatus): string {
  switch (status) {
    case "draft":
      return "Montando cobrança";
    case "ready":
      return "Pronto para confirmar";
    case "pending_confirm":
      return "Aguardando confirmação";
    case "executing":
      return "Criando cobrança…";
    case "done":
      return "Cobrança criada";
    case "failed":
      return "Falhou";
  }
}
