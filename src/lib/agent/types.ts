/** Contrato canônico — escopo/bank-ai-agente-e-tools.md §3 */

export type ToolErrorCode =
  | "NOT_FOUND"
  | "VALIDATION"
  | "INSUFFICIENT_BALANCE"
  | "ASAAS_ERROR"
  | "RATE_LIMIT";

export type ToolResult<T = unknown> = {
  ok: boolean;
  data?: T;
  ui?: UICard;
  error?: {
    code: ToolErrorCode;
    message_humana: string;
  };
};

export type ConfirmLinha = { label: string; valor: string };

export type UICard =
  | {
      type: "saldo";
      props: { saldo: number; ambiente: string; formatado: string };
    }
  | {
      type: "extrato";
      props: {
        periodo: string;
        entradas: number;
        saidas: number;
        itens: Array<{
          data: string;
          descricao: string;
          valor: number;
        }>;
      };
    }
  | {
      type: "lista_cobrancas";
      props: {
        status: string;
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
        acao_lote?: { label: string; tool: "reenviar_cobrancas" };
      };
    }
  | {
      type: "cobranca_detalhe";
      props: {
        id: string;
        cliente: string;
        valor: number;
        status: string;
        vencimento: string;
        link?: string;
        pix_copia_cola?: string;
        linha_digitavel?: string;
      };
    }
  | {
      type: "confirmacao";
      props: {
        pending_action_id: string;
        titulo: string;
        linhas: ConfirmLinha[];
        editaveis?: string[];
        cta: string;
      };
    }
  | {
      type: "escolha";
      props: {
        pergunta: string;
        opcoes: Array<{ id: string; label: string; sub?: string }>;
      };
    }
  | {
      type: "relatorio";
      props: {
        resumo: string;
        kpis: Array<{
          label: string;
          valor: number;
          variacao_pct?: number;
        }>;
        series: Array<{ nome: string; x: string[]; y: number[] }>;
        destaques: string[];
      };
    }
  | {
      type: "sucesso";
      props: {
        titulo: string;
        linhas: ConfirmLinha[];
        link?: string;
        cta_secundario?: string;
      };
    }
  | {
      type: "status_conta";
      props: {
        etapa: "dados" | "documentos" | "analise" | "aprovada" | "recusada";
        pendencias: string[];
        link_documentos?: string;
      };
    }
  | {
      type: "chips";
      props: { options: string[] };
    }
  | {
      type: "dados_conta";
      props: {
        banco: string;
        agencia: string;
        conta: string;
        titular?: string;
      };
    }
  | {
      type: "task_draft";
      props: {
        task: "cobranca";
        patch: {
          cliente?: string;
          cliente_id?: string;
          cpf_cnpj?: string;
          valor?: number;
          vencimento?: string;
          forma?: "UNDEFINED" | "PIX" | "BOLETO" | "CREDIT_CARD";
          email?: string;
          telefone?: string;
          descricao?: string;
          activeStepId?:
            | "cliente"
            | "valor_vencimento"
            | "forma"
            | "contato"
            | undefined;
        };
        /** abre o primeiro passo do wizard no chat */
        open_wizard?: boolean;
      };
    };

export type ToolName =
  | "preparar_abertura_conta"
  | "get_status_conta"
  | "get_saldo"
  | "get_extrato"
  | "get_dados_conta"
  | "listar_cobrancas"
  | "get_cobranca"
  | "abrir_cobranca"
  | "preparar_cobranca"
  | "preparar_cliente"
  | "preparar_pix"
  | "preparar_pagamento_boleto"
  | "reenviar_cobrancas"
  | "resolver_cliente"
  | "agente_relatorio"
  | "leitor_boleto";

/** Valor em pending_actions.type (abertura ≠ nome da tool) */
export type PendingActionType =
  | "abertura_conta"
  | "preparar_cobranca"
  | "preparar_cliente"
  | "preparar_pix"
  | "preparar_pagamento_boleto"
  | "reenviar_cobrancas";

export type OnboardingStatus =
  | "sem_conta"
  | "draft"
  | "created"
  | "pending_documents"
  | "in_review"
  | "approved"
  | "rejected";

export type AccountSource = "baas" | "byo_key";
