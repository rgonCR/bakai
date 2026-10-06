import { NextResponse } from "next/server";
import { requireAsaasAccount } from "@/lib/asaas/account-auth";
import { agenteRelatorio } from "@/lib/asaas/relatorio";

export async function GET(request: Request) {
  try {
    const auth = await requireAsaasAccount();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const url = new URL(request.url);
    const periodo_inicio =
      url.searchParams.get("periodo_inicio")?.trim() || undefined;
    const periodo_fim =
      url.searchParams.get("periodo_fim")?.trim() || undefined;

    const result = await agenteRelatorio(auth.apiKey, auth.env, {
      pergunta: "como foi o mês",
      periodo_inicio,
      periodo_fim,
    });

    if (!result.ok || !result.ui || result.ui.type !== "relatorio") {
      return NextResponse.json(
        {
          error:
            result.error?.message_humana || "Falha ao montar o relatório.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        data: result.data,
        relatorio: result.ui.props,
      },
      { headers: { "Cache-Control": "private, max-age=30" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não consegui montar o relatório.",
      },
      { status: 500 },
    );
  }
}
