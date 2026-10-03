/** Status de cobrança Asaas → PT-BR legível */

const PAYMENT_STATUS: Record<string, string> = {
  PENDING: "Aguardando pagamento",
  RECEIVED: "Recebida",
  CONFIRMED: "Confirmada",
  OVERDUE: "Vencida",
  REFUNDED: "Estornada",
  RECEIVED_IN_CASH: "Recebida em dinheiro",
  REFUND_REQUESTED: "Estorno solicitado",
  REFUND_IN_PROGRESS: "Estorno em andamento",
  CHARGEBACK_REQUESTED: "Chargeback solicitado",
  CHARGEBACK_DISPUTE: "Chargeback em disputa",
  AWAITING_CHARGEBACK_REVERSAL: "Aguardando reversão de chargeback",
  DUNNING_REQUESTED: "Em negativação",
  DUNNING_RECEIVED: "Recuperada na negativação",
  AWAITING_RISK_ANALYSIS: "Em análise de risco",
};

const BILLING_TYPE: Record<string, string> = {
  UNDEFINED: "Cliente escolhe (Pix, boleto ou cartão)",
  PIX: "Pix",
  BOLETO: "Boleto",
  CREDIT_CARD: "Cartão de crédito",
  DEBIT_CARD: "Cartão de débito",
  TRANSFER: "Transferência",
  DEPOSIT: "Depósito",
};

export function asaasPaymentStatusLabel(status: string): string {
  const key = status?.trim().toUpperCase();
  if (!key) return "—";
  return PAYMENT_STATUS[key] ?? status;
}

export function asaasBillingTypeLabel(billingType: string): string {
  const key = billingType?.trim().toUpperCase();
  if (!key) return "—";
  return BILLING_TYPE[key] ?? billingType;
}
