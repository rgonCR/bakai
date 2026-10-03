import { NextResponse } from "next/server";
import { decryptAsaasKey } from "@/lib/crypto/asaas-key";
import type { AsaasEnv } from "@/lib/asaas/client";
import { getCustomer } from "@/lib/asaas/customers";
import { deletePayment, listPayments } from "@/lib/asaas/payments";
import { asaasPaymentStatusLabel } from "@/lib/asaas/status";
import { createClient } from "@/lib/supabase/server";

function formatDateBr(ymd: string) {
  const m = ymd?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return ymd || "—";
  return `${m[3]}/${m[2]}/${m[1]}`;
}

const CANCELABLE = new Set(["PENDING", "OVERDUE"]);

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status")?.trim() || undefined;
    const limit = Number(url.searchParams.get("limit") || "30");

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Sessão ausente." }, { status: 401 });
    }

    const { data: account } = await supabase
      .from("accounts")
      .select("id, env, asaas_key_enc")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!account?.asaas_key_enc) {
      return NextResponse.json(
        { error: "Conta Asaas não conectada." },
        { status: 400 },
      );
    }

    const apiKey = decryptAsaasKey(account.asaas_key_enc as string);
    const env = (account.env as AsaasEnv) || "sandbox";

    const list = await listPayments(apiKey, env, {
      status: status?.toUpperCase(),
      limit: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 50) : 30,
    });

    const rows = list.data ?? [];
    const nameCache = new Map<string, string>();

    const itens = await Promise.all(
      rows.map(async (p) => {
        if (!nameCache.has(p.customer)) {
          try {
            const c = await getCustomer(apiKey, env, p.customer);
            nameCache.set(p.customer, c.name || p.customer);
          } catch {
            nameCache.set(p.customer, p.customer);
          }
        }
        const statusKey = p.status?.toUpperCase() || "";
        return {
          id: p.id,
          cliente: nameCache.get(p.customer) || p.customer,
          valor: p.value,
          vencimento: formatDateBr(p.dueDate),
          status: asaasPaymentStatusLabel(p.status),
          statusRaw: statusKey,
          link: p.invoiceUrl || null,
          cancelavel: CANCELABLE.has(statusKey),
        };
      }),
    );

    return NextResponse.json(
      {
        ok: true,
        total: itens.length,
        hasMore: list.hasMore,
        itens,
      },
      { headers: { "Cache-Control": "private, max-age=15" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não consegui listar as cobranças.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as { id?: string };
    const id = body.id?.trim();
    if (!id) {
      return NextResponse.json(
        { error: "ID da cobrança é obrigatório." },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Sessão ausente." }, { status: 401 });
    }

    const { data: account } = await supabase
      .from("accounts")
      .select("id, env, asaas_key_enc")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!account?.asaas_key_enc) {
      return NextResponse.json(
        { error: "Conta Asaas não conectada." },
        { status: 400 },
      );
    }

    const apiKey = decryptAsaasKey(account.asaas_key_enc as string);
    const env = (account.env as AsaasEnv) || "sandbox";

    await deletePayment(apiKey, env, id);

    return NextResponse.json({ ok: true, id });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não consegui cancelar a cobrança.",
      },
      { status: 500 },
    );
  }
}
