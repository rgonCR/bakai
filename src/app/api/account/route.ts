import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ account: null }, { status: 401 });
  }

  const { data } = await supabase
    .from("accounts")
    .select("id, env, nome, wallet_id, asaas_key_enc")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ account: null });
  }

  return NextResponse.json({
    account: {
      id: data.id,
      env: data.env,
      nome: data.nome,
      walletId: data.wallet_id,
      hasAsaasKey: Boolean(data.asaas_key_enc),
    },
  });
}
