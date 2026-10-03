import { asaasFetch, type AsaasEnv } from "./client";

export type PixKeyType = "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP";

export type AsaasTransfer = {
  id: string;
  value: number;
  status: string;
  dateCreated?: string;
  effectiveDate?: string;
  scheduleDate?: string;
  type?: string;
  operationType?: string;
  description?: string;
  bankAccount?: {
    ownerName?: string;
    cpfCnpj?: string;
  };
};

export function inferPixKeyType(chave: string): PixKeyType | null {
  const raw = chave.trim();
  if (!raw) return null;
  if (raw.includes("@")) return "EMAIL";
  const digits = raw.replace(/\D/g, "");
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) {
    return "EVP";
  }
  if (digits.length === 11) {
    // telefone BR costuma começar com DDD 1x–9x; CPF também tem 11 dígitos
    if (raw.startsWith("+") || raw.startsWith("(") || digits.startsWith("55")) {
      return "PHONE";
    }
    return "CPF";
  }
  if (digits.length === 14) return "CNPJ";
  if (digits.length >= 10 && digits.length <= 13) return "PHONE";
  // chave aleatória sem hífens
  if (/^[0-9a-f]{32}$/i.test(raw.replace(/-/g, ""))) return "EVP";
  return null;
}

export async function createPixTransfer(
  apiKey: string,
  env: AsaasEnv,
  input: {
    value: number;
    pixAddressKey: string;
    pixAddressKeyType: PixKeyType;
    description?: string;
    scheduleDate?: string;
  },
): Promise<AsaasTransfer> {
  return asaasFetch<AsaasTransfer>(apiKey, env, "/transfers", {
    method: "POST",
    body: JSON.stringify({
      value: input.value,
      pixAddressKey: input.pixAddressKey,
      pixAddressKeyType: input.pixAddressKeyType,
      operationType: "PIX",
      description: input.description,
      scheduleDate: input.scheduleDate,
    }),
  });
}
