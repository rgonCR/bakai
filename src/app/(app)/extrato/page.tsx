"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, FileText } from "lucide-react";

type ExtratoItem = {
  data: string;
  descricao: string;
  valor: number;
};

function brl(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function brlSigned(value: number) {
  const abs = brl(Math.abs(value));
  if (value < 0) return `−${abs}`;
  if (value > 0) return `+${abs}`;
  return abs;
}

export default function ExtratoPage() {
  const [itens, setItens] = useState<ExtratoItem[]>([]);
  const [periodo, setPeriodo] = useState("últimos lançamentos");
  const [entradas, setEntradas] = useState(0);
  const [saidas, setSaidas] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/extrato");
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        periodo?: string;
        entradas?: number;
        saidas?: number;
        itens?: ExtratoItem[];
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Falha ao carregar extrato.");
      }
      setPeriodo(json.periodo || "últimos lançamentos");
      setEntradas(json.entradas ?? 0);
      setSaidas(json.saidas ?? 0);
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
              <FileText className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-ia-foreground">
                Extrato
              </h1>
              <p className="mt-1 text-sm text-ia-muted">
                Movimentações da conta · {periodo}
              </p>
            </div>
          </div>
          <Link
            href="/"
            className="rounded-xl border border-ia-border bg-white px-4 py-2.5 text-sm font-semibold text-ia-foreground hover:bg-ia-surface"
          >
            Perguntar no chat
          </Link>
        </header>

        <div className="mb-6 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-ia-border bg-white px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Entradas
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-emerald-700">
              {brl(entradas)}
            </p>
          </div>
          <div className="rounded-xl border border-ia-border bg-white px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-red-600">
              Saídas
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-red-600">
              −{brl(Math.abs(saidas))}
            </p>
          </div>
        </div>

        {error ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {loading ? (
          <p className="text-sm text-ia-muted">Carregando extrato…</p>
        ) : itens.length === 0 ? (
          <div className="rounded-xl border border-dashed border-ia-border px-6 py-12 text-center">
            <p className="text-sm text-ia-muted">Nenhum lançamento no período.</p>
          </div>
        ) : (
          <ul className="divide-y divide-ia-border/60 rounded-xl border border-ia-border bg-white px-4">
            {itens.map((item, i) => {
              const entrada = item.valor > 0;
              const saida = item.valor < 0;
              return (
                <li
                  key={`${item.data}-${i}`}
                  className="flex items-center gap-3 py-3"
                >
                  <span className="w-[4.5rem] shrink-0 text-xs tabular-nums text-ia-muted">
                    {item.data}
                  </span>
                  <span
                    className={`flex size-7 shrink-0 items-center justify-center rounded-full ${
                      entrada
                        ? "bg-emerald-50 text-emerald-700"
                        : saida
                          ? "bg-red-50 text-red-600"
                          : "bg-ia-surface text-ia-muted"
                    }`}
                    aria-label={entrada ? "Entrada" : saida ? "Saída" : "Lançamento"}
                  >
                    {entrada ? (
                      <ArrowUp size={14} strokeWidth={2.25} />
                    ) : saida ? (
                      <ArrowDown size={14} strokeWidth={2.25} />
                    ) : (
                      <span className="text-[10px]">·</span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-ia-foreground">
                    {item.descricao}
                  </span>
                  <span
                    className={`shrink-0 text-sm font-semibold tabular-nums ${
                      entrada
                        ? "text-emerald-700"
                        : saida
                          ? "text-red-600"
                          : "text-ia-foreground"
                    }`}
                  >
                    {brlSigned(item.valor)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
