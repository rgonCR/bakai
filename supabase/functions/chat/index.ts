/**
 * Edge entry /chat — autentica JWT e faz proxy SSE para o Next (AGENT_ORIGIN).
 * Contrato idêntico a POST /api/chat (SSE: status | message | conversation | error | done).
 *
 * Secrets: AGENT_ORIGIN=https://seu-app.vercel.app
 * Client: NEXT_PUBLIC_AGENT_CHAT_URL=https://<ref>.supabase.co/functions/v1/chat
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const origin = Deno.env.get("AGENT_ORIGIN")?.replace(/\/$/, "");
  if (!origin) {
    return new Response(
      JSON.stringify({
        error: "AGENT_ORIGIN não configurado na Edge Function.",
      }),
      {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }

  const auth = req.headers.get("Authorization") ?? "";
  const body = await req.text();

  const upstream = await fetch(`${origin}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: auth,
    },
    body,
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      ...cors,
      "Content-Type":
        upstream.headers.get("Content-Type") ?? "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
});
