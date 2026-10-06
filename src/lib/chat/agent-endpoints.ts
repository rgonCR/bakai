/**
 * Endpoints do agente. Com Edge deployado, aponte:
 *   NEXT_PUBLIC_AGENT_CHAT_URL=https://<project>.supabase.co/functions/v1/chat
 *   NEXT_PUBLIC_AGENT_EXECUTE_URL=https://<project>.supabase.co/functions/v1/execute
 * Sem isso, usa Route Handlers Next (/api/chat, /api/execute).
 */

export function chatEndpoint() {
  return (
    process.env.NEXT_PUBLIC_AGENT_CHAT_URL?.trim() || "/api/chat"
  );
}

export function executeEndpoint() {
  return (
    process.env.NEXT_PUBLIC_AGENT_EXECUTE_URL?.trim() || "/api/execute"
  );
}

export function usesEdgeAgent() {
  return Boolean(process.env.NEXT_PUBLIC_AGENT_CHAT_URL?.trim());
}
