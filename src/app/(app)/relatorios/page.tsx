"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3 } from "lucide-react";

type RelatorioProps = {
  resumo: string;
  kpis: Array<{ label: string; valor: number; variacao_pct?: number }>;
  series: Array<{ nome: string; x: string[]; y: number[] }>;
  destaques: string[];
};

function brl(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function RelatoriosPage() {
  const [relatorio, setRelatorio] = useState<RelatorioProps | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/relatorios");
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        relatorio?: RelatorioProps;
      };
      if (!res.ok || !json.ok || !json.relatorio) {
        throw new Error(json.error || "Falha ao carregar relatório.");
      }
      setRelatorio(json.relatorio);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar.");
      setRelatorio(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const series = relatorio?.series[0];
  const maxY = Math.max(1, ...(series?.y.map((v) => Math.abs(v)) ?? [1]));

  return (
    <div className="flex h-full flex-col overflow-auto">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ia-primary/10 text-ia-primary">
              <BarChart3 className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-ia-foreground">
                Relatórios
              </h1>
              <p className="mt-1 text-sm text-ia-muted">
                {relatorio?.resumo || "Resumo do mês corrente"}
              </p>
            </div>
          </div>
          <Link
            href="/?q=Como%20foi%20o%20m%C3%AAs%3F"
            className="rounded-xl border border-ia-border bg-white px-4 py-2.5 text-sm font-semibold text-ia-foreground hover:bg-ia-surface"
          >
            Pedir no chat
          </Link>
        </header>

        {error ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {loading ? (
          <p className="text-sm text-ia-muted">Montando relatório…</p>
        ) : !relatorio ? (
          <div className="rounded-xl border border-dashed border-ia-border px-6 py-12 text-center">
            <p className="text-sm text-ia-muted">Sem dados para o período.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {relatorio.kpis.map((kpi) => (
                <div
                  key={kpi.label}
                  className="rounded-xl border border-ia-border bg-white px-4 py-3"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-ia-muted">
                    {kpi.label}
                  </p>
                  <p className="mt-1 text-base font-semibold tabular-nums text-ia-foreground">
                    {brl(kpi.valor)}
                  </p>
                </div>
              ))}
            </div>

            {series && series.x.length > 0 ? (
              <div className="rounded-xl border border-ia-border bg-white p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ia-muted">
                  {series.nome}
                </p>
                <div className="flex h-[160px] items-end gap-1">
                  {series.y.map((v, i) => {
                    const h = Math.max(4, (Math.abs(v) / maxY) * 140);
                    const positive = v >= 0;
                    return (
                      <div
                        key={`${series.x[i]}-${i}`}
                        className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1"
                        title={`${series.x[i]}: ${brl(v)}`}
                      >
                        <div
                          className={`w-full max-w-[28px] rounded-t-md ${
                            positive ? "bg-emerald-500/80" : "bg-red-500/80"
                          }`}
                          style={{ height: h }}
                        />
                        <span className="truncate text-[10px] text-ia-muted">
                          {series.x[i]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {relatorio.destaques.length > 0 ? (
              <ul className="space-y-2 rounded-xl border border-ia-border bg-white p-4">
                {relatorio.destaques.map((d) => (
                  <li key={d} className="text-sm text-ia-foreground">
                    · {d}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
