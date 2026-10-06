import { NextResponse } from "next/server";
import { requireAsaasAccount } from "@/lib/asaas/account-auth";
import { getExtrato } from "@/lib/asaas/tools";

export async function GET(request: Request) {
  try {
    const auth = await requireAsaasAccount();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const url = new URL(request.url);
    const startDate = url.searchParams.get("startDate")?.trim() || undefined;
    const finishDate = url.searchParams.get("finishDate")?.trim() || undefined;
    const limit = Number(url.searchParams.get("limit") || "40");

    const result = await getExtrato(auth.apiKey, auth.env, {
      startDate,
      finishDate,
      limit: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 50) : 40,
    });

    if (!result.ok || !result.ui || result.ui.type !== "extrato") {
      return NextResponse.json(
        { error: result.error?.message_humana || "Falha ao carregar extrato." },
        { status: 502 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        periodo: result.ui.props.periodo,
        entradas: result.ui.props.entradas,
        saidas: result.ui.props.saidas,
        itens: result.ui.props.itens,
      },
      { headers: { "Cache-Control": "private, max-age=15" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não consegui carregar o extrato.",
      },
      { status: 500 },
    );
  }
}
