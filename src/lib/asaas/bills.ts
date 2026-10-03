import { asaasFetch, type AsaasEnv } from "./client";

export type BillSimulate = {
  minimumScheduleDate?: string;
  fee?: number;
  bankSlipInfo?: {
    identificationField?: string;
    value?: number;
    dueDate?: string;
    companyName?: string;
    beneficiaryName?: string;
    originalValue?: number;
    interestValue?: number;
    fineValue?: number;
    discountValue?: number;
    totalDiscountValue?: number;
  };
};

export type AsaasBill = {
  id: string;
  status?: string;
  value?: number;
  scheduleDate?: string;
  dueDate?: string;
  identificationField?: string;
  description?: string;
};

/** Normaliza linha digitável / código de barras (só dígitos, 47 ou 48). */
export function normalizeLinhaDigitavel(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 47 || digits.length === 48) return digits;
  return null;
}

export async function simulateBill(
  apiKey: string,
  env: AsaasEnv,
  identificationField: string,
): Promise<BillSimulate> {
  return asaasFetch<BillSimulate>(apiKey, env, "/bill/simulate", {
    method: "POST",
    body: JSON.stringify({ identificationField }),
  });
}

export async function createBillPayment(
  apiKey: string,
  env: AsaasEnv,
  input: {
    identificationField: string;
    scheduleDate?: string;
    description?: string;
  },
): Promise<AsaasBill> {
  return asaasFetch<AsaasBill>(apiKey, env, "/bill", {
    method: "POST",
    body: JSON.stringify({
      identificationField: input.identificationField,
      scheduleDate: input.scheduleDate,
      description: input.description,
    }),
  });
}
