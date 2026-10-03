"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * Garante sessão do usuário logado.
 * Sem sessão → redireciona para /login (sem anonymous / signup efêmero).
 */
export async function ensureSession() {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session) return { supabase, session };

  // tenta refresh uma vez
  const { data: refreshed } = await supabase.auth.refreshSession();
  if (refreshed.session) return { supabase, session: refreshed.session };

  throw new Error("NO_SESSION");
}
