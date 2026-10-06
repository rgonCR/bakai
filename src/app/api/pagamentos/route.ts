import { NextResponse } from "next/server";
import { requireAsaasAccount } from "@/lib/asaas/account-auth";
import { listBillPayments } from "@/lib/asaas/bills";
import { listTransfers } from "@/lib/asaas/transfers";

function formatDateBr(ymd?: string) {
  if (!ymd) return "—";
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return ymd.slice(0, 10);
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export async function GET() {
  try {
    const auth = await requireAsaasAccount();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const [transfers, bills] = await Promise.all([
      listTransfers(auth.apiKey, auth.env, { limit: 25 }).catch(() => ({
        data: [] as Awaited<ReturnType<typeof listTransfers>>["data"],
        hasMore: false,
      })),
      listBillPayments(auth.apiKey, auth.env, { limit: 25 }).catch(() => ({
        data: [] as Awaited<ReturnType<typeof listBillPayments>>["data"],
        hasMore: false,
      })),
    ]);

    const pix = (transfers.data ?? []).map((t) => ({
      id: t.id,
      tipo: "pix" as const,
      titulo: t.description || t.bankAccount?.ownerName || "Pix enviado",
      valor: t.value,
      status: t.status || "—",
      data: formatDateBr(t.effectiveDate || t.scheduleDate || t.dateCreated),
    }));

    const boletos = (bills.data ?? []).map((b) => ({
      id: b.id,
      tipo: "boleto" as const,
      titulo: b.description || "Pagamento de boleto",
      valor: b.value ?? 0,
      status: b.status || "—",
      data: formatDateBr(b.scheduleDate || b.dueDate),
    }));

    const itens = [...pix, ...boletos].sort((a, b) => {
      // dd/mm/aaaa → comparar invertendo
      const toKey = (d: string) => {
        const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        return m ? `${m[3]}${m[2]}${m[1]}` : d;
      };
      return toKey(b.data).localeCompare(toKey(a.data));
    });

    return NextResponse.json(
      { ok: true, itens },
      { headers: { "Cache-Control": "private, max-age=15" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não consegui listar pagamentos.",
      },
      { status: 500 },
    );
  }
}
