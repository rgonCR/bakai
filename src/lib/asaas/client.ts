export type AsaasEnv = "sandbox" | "production";

const SANDBOX_BASE = "https://sandbox.asaas.com/api/v3";
const PROD_BASE = "https://api.asaas.com/api/v3";

export function asaasBaseUrl(env: AsaasEnv) {
  if (process.env.ASAAS_API_BASE) return process.env.ASAAS_API_BASE;
  return env === "production" ? PROD_BASE : SANDBOX_BASE;
}

export class AsaasError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown,
  ) {
    super(message);
    this.name = "AsaasError";
  }
}

export async function asaasFetch<T>(
  apiKey: string,
  env: AsaasEnv,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const url = `${asaasBaseUrl(env)}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      access_token: apiKey,
      ...(init?.headers ?? {}),
    },
  });

  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!res.ok) {
    const msg =
      typeof body === "object" &&
      body &&
      "errors" in body &&
      Array.isArray((body as { errors: { description?: string }[] }).errors)
        ? (body as { errors: { description?: string }[] }).errors
            .map((e) => e.description)
            .filter(Boolean)
            .join("; ")
        : `Asaas HTTP ${res.status}`;
    throw new AsaasError(msg || `Asaas HTTP ${res.status}`, res.status, body);
  }

  return body as T;
}

export type AsaasAccount = {
  name?: string;
  email?: string;
  walletId?: string;
  environment?: string;
};

/** GET /myAccount/accountNumber */
export type AsaasAccountNumber = {
  agency?: string;
  account?: string;
  accountDigit?: string;
};

export type AsaasBalance = {
  balance: number;
};

export type AsaasFinancialTransaction = {
  id: string;
  value: number;
  balance: number;
  type: string;
  date: string;
  description?: string;
};

export type AsaasListResponse<T> = {
  data: T[];
  hasMore: boolean;
  totalCount?: number;
};
