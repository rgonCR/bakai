"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Wallet } from "lucide-react";

type PagamentoItem = {
  id: string;
  tipo: "pix" | "boleto";
  titulo: string;
  valor: number;
  status: string;
  data: string;
};

function brl(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function PagamentosPage() {
  const [itens, setItens] = useState<PagamentoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/pagamentos");
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        itens?: PagamentoItem[];
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Falha ao carregar pagamentos.");
      }
      setItens(json.itens ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar.");
      setItens([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex h-full flex-col overflow-auto">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ia-primary/10 text-ia-primary">
              <Wallet className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-ia-foreground">
                Pagamentos
              </h1>
              <p className="mt-1 text-sm text-ia-muted">
                Pix enviados e boletos pagos pela conta.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/?q=Fazer%20Pix"
              className="rounded-xl bg-ia-primary px-4 py-2.5 text-sm font-semibold text-white"
            >
              Fazer Pix
            </Link>
            <Link
              href="/?q=Pagar%20boleto"
              className="rounded-xl border border-ia-border bg-white px-4 py-2.5 text-sm font-semibold text-ia-foreground hover:bg-ia-surface"
            >
              Pagar boleto
            </Link>
          </div>
        </header>

        {error ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {loading ? (
          <p className="text-sm text-ia-muted">Carregando pagamentos…</p>
        ) : itens.length === 0 ? (
          <div className="rounded-xl border border-dashed border-ia-border px-6 py-12 text-center">
            <p className="text-sm text-ia-muted">
              Nenhum Pix ou boleto listado ainda.
            </p>
            <Link
              href="/?q=Fazer%20Pix"
              className="mt-4 inline-block text-sm font-medium text-ia-primary hover:underline"
            >
              Enviar Pix pelo chat
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {itens.map((item) => (
              <li
                key={`${item.tipo}-${item.id}`}
                className="rounded-xl border border-ia-border bg-white p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ia-foreground">
                      {item.titulo}
                    </p>
                    <p className="mt-1 text-xs text-ia-muted">
                      {item.tipo === "pix" ? "Pix" : "Boleto"} · {item.status} ·{" "}
                      {item.data}
                    </p>
                    <p className="mt-1 font-mono text-[11px] text-ia-muted">
                      {item.id}
                    </p>
                  </div>
                  <p className="text-base font-semibold tabular-nums text-red-600">
                    −{brl(Math.abs(item.valor))}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
