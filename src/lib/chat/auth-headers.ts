import { createClient } from "@/lib/supabase/client";
import { usesEdgeAgent } from "./agent-endpoints";

/**
 * Headers para o agente.
 * Same-origin (/api/*): só Content-Type — cookies SSR bastam.
 * Edge (URL absoluta): Bearer JWT para a Function autenticar e proxyar.
 */
export async function agentAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (!usesEdgeAgent()) {
    return headers;
  }

  try {
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    // segue sem Bearer
  }
  return headers;
}
