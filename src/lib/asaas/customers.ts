import { asaasFetch, type AsaasEnv, type AsaasListResponse } from "./client";

export type AsaasCustomer = {
  id: string;
  name?: string;
  cpfCnpj?: string;
  email?: string;
  mobilePhone?: string;
  phone?: string;
};

export async function getCustomer(
  apiKey: string,
  env: AsaasEnv,
  customerId: string,
): Promise<AsaasCustomer> {
  return asaasFetch<AsaasCustomer>(apiKey, env, `/customers/${customerId}`);
}

export async function searchCustomers(
  apiKey: string,
  env: AsaasEnv,
  query: { name?: string; cpfCnpj?: string },
): Promise<AsaasCustomer[]> {
  const params = new URLSearchParams();
  if (query.name) params.set("name", query.name);
  if (query.cpfCnpj) params.set("cpfCnpj", query.cpfCnpj.replace(/\D/g, ""));
  params.set("limit", "10");

  const list = await asaasFetch<AsaasListResponse<AsaasCustomer>>(
    apiKey,
    env,
    `/customers?${params.toString()}`,
  );
  return list.data ?? [];
}

export async function createCustomer(
  apiKey: string,
  env: AsaasEnv,
  input: { name: string; cpfCnpj: string; email?: string; mobilePhone?: string },
): Promise<AsaasCustomer> {
  return asaasFetch<AsaasCustomer>(apiKey, env, "/customers", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      cpfCnpj: input.cpfCnpj.replace(/\D/g, ""),
      email: input.email,
      mobilePhone: input.mobilePhone,
    }),
  });
}

export function looksLikeCpfCnpj(text: string): boolean {
  const digits = text.replace(/\D/g, "");
  return digits.length === 11 || digits.length === 14;
}
