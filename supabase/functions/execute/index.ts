/**
 * Edge entry /execute — autentica JWT e faz proxy JSON para o Next (AGENT_ORIGIN).
 * Contrato idêntico a POST /api/execute.
 *
 * Secrets: AGENT_ORIGIN=https://seu-app.vercel.app
 * Client: NEXT_PUBLIC_AGENT_EXECUTE_URL=https://<ref>.supabase.co/functions/v1/execute
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

  const upstream = await fetch(`${origin}/api/execute`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: auth,
    },
    body,
  });

  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: {
      ...cors,
      "Content-Type":
        upstream.headers.get("Content-Type") ?? "application/json",
    },
  });
});
