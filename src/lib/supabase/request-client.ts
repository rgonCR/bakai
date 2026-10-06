import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient as createCookieClient } from "./server";
import { getSupabaseAnonKey, getSupabaseUrl } from "./env";

/**
 * Preferência: Bearer JWT (Edge / clients cross-origin) com getUser(jwt).
 * Fallback: cookies SSR do Next.
 */
export async function createClientFromRequest(request: Request) {
  const auth = request.headers.get("authorization");
  const token = auth?.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : null;

  if (token) {
    const client = createSupabaseClient(getSupabaseUrl(), getSupabaseAnonKey(), {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    // Garante validação do JWT mesmo sem sessão local
    await client.auth.getUser(token);
    return client;
  }

  return createCookieClient();
}
