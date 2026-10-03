import type { MockAgentReply } from "./types";

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function mockAgentReply(message: string): Promise<MockAgentReply> {
  await delay(900);

  const normalized = message.toLowerCase();

  if (
    normalized.includes("saldo") ||
    normalized.includes("quanto tenho") ||
    normalized.includes("conta")
  ) {
    return {
      statusLabel: "Consultando saldo…",
      reply: "Aqui está o resumo da sua conta corrente.",
      report: {
        title: "Saldo disponível",
        fields: [
          { label: "Conta", value: "0001 / 123456-7", copyable: true },
          { label: "Saldo", value: "R$ 12.480,32", copyable: true },
          { label: "Limite", value: "R$ 5.000,00", copyable: false },
          { label: "Atualizado em", value: "hoje, 06:50", copyable: false },
        ],
      },
      questions: [
        {
          campo: "proxima_acao",
          texto: "O que deseja fazer agora?",
          opcoes: ["Ver extrato", "Fazer transferência", "Pagar boleto"],
        },
      ],
    };
  }

  if (
    normalized.includes("extrato") ||
    normalized.includes("moviment") ||
    normalized.includes("lançamento")
  ) {
    return {
      statusLabel: "Montando extrato…",
      reply: "Separei os lançamentos dos últimos 7 dias.",
      report: {
        title: "Extrato — últimos 7 dias",
        fields: [
          { label: "Período", value: "27/09 → 03/10", copyable: false },
          { label: "Entradas", value: "R$ 8.200,00", copyable: true },
          { label: "Saídas", value: "R$ 3.145,90", copyable: true },
          { label: "Saldo final", value: "R$ 12.480,32", copyable: true },
        ],
        bodyMarkdown:
          "## Lançamentos\n\n- **PIX recebido** — R$ 2.500,00\n- **Transferência TED** — −R$ 1.200,00\n- **Pagamento boleto** — −R$ 345,90\n- **Salário** — R$ 5.700,00",
      },
      questions: [
        {
          campo: "periodo",
          texto: "Quer outro período?",
          opcoes: ["Últimos 30 dias", "Este mês", "Exportar PDF"],
        },
      ],
    };
  }

  if (
    normalized.includes("transfer") ||
    normalized.includes("pix") ||
    normalized.includes("enviar")
  ) {
    return {
      statusLabel: "Preparando transferência…",
      reply:
        "Posso montar a transferência. Confirme os dados no formulário abaixo — nada será enviado ainda.",
      form: {
        title: "Nova transferência",
        subtitle: "Shell determinístico de formulário (mock, sem execução).",
        fields: [
          {
            id: "destino",
            label: "Chave PIX / conta",
            placeholder: "cpf, e-mail ou agência/conta",
          },
          {
            id: "valor",
            label: "Valor",
            type: "number",
            placeholder: "0,00",
          },
          {
            id: "descricao",
            label: "Descrição",
            type: "textarea",
            placeholder: "Opcional",
            hint: "Aparece no extrato do destinatário.",
          },
        ],
        submitLabel: "Revisar transferência",
      },
      questions: [
        {
          campo: "atalho",
          texto: "Ou escolha um atalho",
          opcoes: ["PIX para mim mesmo", "Agendar para amanhã"],
        },
      ],
    };
  }

  if (normalized.includes("boleto") || normalized.includes("pagar")) {
    return {
      statusLabel: "Abrindo pagamento…",
      reply: "Cole o código de barras ou escolha uma opção.",
      form: {
        title: "Pagamento de boleto",
        subtitle: "Campo determinístico — só UI por enquanto.",
        fields: [
          {
            id: "codigo",
            label: "Código de barras",
            placeholder: "Digite ou cole o código",
          },
        ],
        submitLabel: "Validar boleto",
      },
    };
  }

  return {
    statusLabel: "Entendendo sua intenção…",
    reply:
      "Sou o assistente do bank.ai. Posso consultar saldo, montar extratos, preparar transferências e pagamentos — tudo em blocos conversacionais.\n\nO que você precisa?",
    questions: [
      {
        campo: "intencao",
        texto: "Sugestões",
        opcoes: ["Ver saldo", "Ver extrato", "Fazer transferência", "Pagar boleto"],
      },
    ],
  };
}
