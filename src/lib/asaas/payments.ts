import {
  asaasFetch,
  type AsaasEnv,
  type AsaasListResponse,
} from "./client";

export type AsaasBillingType = "UNDEFINED" | "PIX" | "BOLETO" | "CREDIT_CARD";

export type AsaasPayment = {
  id: string;
  customer: string;
  value: number;
  netValue?: number;
  billingType: string;
  status: string;
  dueDate: string;
  paymentDate?: string;
  externalReference?: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  description?: string;
  deleted?: boolean;
};

export async function createPayment(
  apiKey: string,
  env: AsaasEnv,
  input: {
    customer: string;
    billingType: AsaasBillingType;
    value: number;
    dueDate: string;
    description?: string;
  },
): Promise<AsaasPayment> {
  return asaasFetch<AsaasPayment>(apiKey, env, "/payments", {
    method: "POST",
    body: JSON.stringify({
      customer: input.customer,
      billingType: input.billingType,
      value: input.value,
      dueDate: input.dueDate,
      description: input.description,
    }),
  });
}

export async function listPayments(
  apiKey: string,
  env: AsaasEnv,
  args: {
    status?: string;
    customer?: string;
    limit?: number;
    offset?: number;
  } = {},
): Promise<AsaasListResponse<AsaasPayment>> {
  const params = new URLSearchParams();
  if (args.status) params.set("status", args.status);
  if (args.customer) params.set("customer", args.customer);
  params.set("limit", String(args.limit ?? 20));
  params.set("offset", String(args.offset ?? 0));
  return asaasFetch<AsaasListResponse<AsaasPayment>>(
    apiKey,
    env,
    `/payments?${params.toString()}`,
  );
}

/** Cancela/remove cobrança pendente no Asaas */
export async function deletePayment(
  apiKey: string,
  env: AsaasEnv,
  paymentId: string,
): Promise<{ deleted?: boolean; id?: string }> {
  return asaasFetch(apiKey, env, `/payments/${paymentId}`, {
    method: "DELETE",
  });
}

export async function getPaymentPixQr(
  apiKey: string,
  env: AsaasEnv,
  paymentId: string,
): Promise<{ payload?: string; encodedImage?: string; expirationDate?: string }> {
  return asaasFetch(apiKey, env, `/payments/${paymentId}/pixQrCode`);
}

/** Reenvia notificação da cobrança ao cliente (e-mail/SMS/WhatsApp Asaas) */
export async function resendPaymentNotification(
  apiKey: string,
  env: AsaasEnv,
  paymentId: string,
): Promise<unknown> {
  return asaasFetch(apiKey, env, `/payments/${paymentId}/resendNotification`, {
    method: "POST",
  });
}
