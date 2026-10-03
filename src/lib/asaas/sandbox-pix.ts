/**
 * Destinos Pix de homologação (BACEN) — docs Asaas:
 * https://docs.asaas.com/docs/testando-transferencias
 *
 * No sandbox, transferir para essas chaves debita o saldo e conclui a operação
 * sem creditar outra conta. Entre contas sandbox, use a chave EVP da outra conta.
 */
export const SANDBOX_PIX_DESTINOS = [
  {
    nome: "João Silva",
    cpfCnpj: "99991111140",
    chave: "cliente-a00001@pix.bcb.gov.br",
  },
  {
    nome: "João Silva Silva",
    cpfCnpj: "99992222263",
    chave: "cliente-a00002@pix.bcb.gov.br",
  },
  {
    nome: "José Silva",
    cpfCnpj: "99993333387",
    chave: "cliente-a00003@pix.bcb.gov.br",
  },
  {
    nome: "José Silva Silva",
    cpfCnpj: "99994444409",
    chave: "cliente-a00004@pix.bcb.gov.br",
  },
  {
    nome: "José da Silva",
    cpfCnpj: "99995555514",
    chave: "cliente-a00005@pix.bcb.gov.br",
  },
] as const;

export const SANDBOX_PIX_CHAVE_PADRAO = SANDBOX_PIX_DESTINOS[0].chave;

export function isSandboxPixDestino(chave: string): boolean {
  const raw = chave.trim().toLowerCase();
  const digits = raw.replace(/\D/g, "");
  return SANDBOX_PIX_DESTINOS.some(
    (d) =>
      d.chave.toLowerCase() === raw ||
      d.cpfCnpj === digits ||
      d.cpfCnpj === raw,
  );
}

/** Mensagem humana quando o Asaas recusa Pix no sandbox. */
export function mensagemErroPixSandbox(asaasMessage?: string): string {
  const base =
    asaasMessage && !/erro desconhecido/i.test(asaasMessage)
      ? asaasMessage
      : "O Asaas sandbox recusou a transferência Pix.";
  return `${base} No sandbox, use uma chave de teste do BACEN — por exemplo ${SANDBOX_PIX_CHAVE_PADRAO} — ou a chave Pix de outra conta sandbox. Se ainda falhar, o Pix out pode estar indisponível nessa conta (TED e recebimento via confirmar cobrança costumam funcionar).`;
}
