import { NextResponse } from "next/server";
import { decryptAsaasKey } from "@/lib/crypto/asaas-key";
import type { AsaasEnv } from "@/lib/asaas/client";
import { listPayments } from "@/lib/asaas/payments";
import { getSaldo } from "@/lib/asaas/tools";
import { createClient } from "@/lib/supabase/server";

function todayParts() {
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
  const [y, m] = ymd.split("-");
  return { ymd, yearMonth: `${y}-${m}` };
}

function brl(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sessão ausente." }, { status: 401 });
  }

  const { data: account } = await supabase
    .from("accounts")
    .select("id, env, nome, asaas_key_enc")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!account) {
    return NextResponse.json({
      account: null,
      saldo: null,
      aReceberMes: null,
      vencidas: null,
    });
  }

  const env = (account.env as AsaasEnv) || "sandbox";
  const base = {
    account: {
      id: account.id as string,
      nome: (account.nome as string | null) ?? null,
      env,
      hasAsaasKey: Boolean(account.asaas_key_enc),
    },
  };

  if (!account.asaas_key_enc) {
    return NextResponse.json({
      ...base,
      saldo: null,
      aReceberMes: null,
      vencidas: null,
    });
  }

  try {
    const apiKey = decryptAsaasKey(account.asaas_key_enc as string);
    const { yearMonth } = todayParts();

    const [saldoResult, pendingList, overdueList] = await Promise.all([
      getSaldo(apiKey, env),
      listPayments(apiKey, env, { status: "PENDING", limit: 100 }),
      listPayments(apiKey, env, { status: "OVERDUE", limit: 50 }),
    ]);

    const pending = pendingList.data ?? [];
    const overdue = overdueList.data ?? [];
    const aReceberMesItens = pending.filter((p) =>
      p.dueDate?.startsWith(yearMonth),
    );
    const aReceberMesValor = aReceberMesItens.reduce((s, p) => s + p.value, 0);
    const vencidasValor = overdue.reduce((s, p) => s + p.value, 0);

    return NextResponse.json(
      {
        ...base,
        saldo:
          saldoResult.ok && saldoResult.data
            ? {
                valor: saldoResult.data.saldo,
                formatado:
                  saldoResult.ui?.type === "saldo"
                    ? saldoResult.ui.props.formatado
                    : brl(saldoResult.data.saldo),
              }
            : null,
        aReceberMes: {
          valor: aReceberMesValor,
          formatado: brl(aReceberMesValor),
          quantidade: aReceberMesItens.length,
        },
        vencidas: {
          valor: vencidasValor,
          formatado: brl(vencidasValor),
          quantidade: overdue.length,
        },
      },
      {
        headers: { "Cache-Control": "private, max-age=30" },
      },
    );
  } catch {
    return NextResponse.json({
      ...base,
      saldo: null,
      aReceberMes: null,
      vencidas: null,
    });
  }
}
