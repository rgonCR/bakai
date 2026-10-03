"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Receipt } from "lucide-react";
import { Check, Copy } from "lucide-react";

type CobrancaItem = {
  id: string;
  cliente: string;
  valor: number;
  vencimento: string;
  status: string;
  statusRaw: string;
  link: string | null;
  cancelavel: boolean;
};

function brl(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function CopyLinkButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      }}
      className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-ia-border bg-white px-4 py-2 text-sm font-medium text-ia-foreground hover:bg-ia-surface"
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {copied ? "Copiado" : "Copiar link"}
    </button>
  );
}

export default function CobrancasPage() {
  const [itens, setItens] = useState<CobrancaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = filter ? `?status=${encodeURIComponent(filter)}` : "";
      const res = await fetch(`/api/cobrancas${qs}`);
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        itens?: CobrancaItem[];
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Falha ao carregar cobranças.");
      }
      setItens(json.itens ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar.");
      setItens([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function cancelar(id: string) {
    if (
      !window.confirm(
        "Cancelar esta cobrança no Asaas? Essa ação não pode ser desfeita.",
      )
    ) {
      return;
    }
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch("/api/cobrancas", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Não foi possível cancelar.");
      }
      setItens((prev) => prev.filter((i) => i.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao cancelar.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex h-full flex-col overflow-auto">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ia-primary/10 text-ia-primary">
              <Receipt className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-ia-foreground">
                Cobranças
              </h1>
              <p className="mt-1 text-sm text-ia-muted">
                Liste, copie o link ou cancele cobranças abertas.
              </p>
            </div>
          </div>
          <Link
            href="/"
            className="rounded-xl bg-ia-primary px-4 py-2.5 text-sm font-semibold text-white"
          >
            Nova cobrança
          </Link>
        </header>

        <div className="mb-6 flex flex-wrap gap-2">
          {[
            { value: "", label: "Todas" },
            { value: "PENDING", label: "Aguardando" },
            { value: "OVERDUE", label: "Vencidas" },
            { value: "RECEIVED", label: "Recebidas" },
          ].map((opt) => (
            <button
              key={opt.value || "all"}
              type="button"
              onClick={() => setFilter(opt.value)}
              className={`cursor-pointer rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                filter === opt.value
                  ? "border-ia-primary bg-ia-primary/10 text-ia-primary"
                  : "border-ia-border bg-white text-ia-muted hover:border-ia-primary/40"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {error ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {loading ? (
          <p className="text-sm text-ia-muted">Carregando cobranças…</p>
        ) : itens.length === 0 ? (
          <div className="rounded-xl border border-dashed border-ia-border px-6 py-12 text-center">
            <p className="text-sm text-ia-muted">Nenhuma cobrança nesta lista.</p>
            <Link
              href="/"
              className="mt-4 inline-block text-sm font-medium text-ia-primary hover:underline"
            >
              Criar pelo chat
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {itens.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border border-ia-border bg-white p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ia-foreground">
                      {item.cliente}
                    </p>
                    <p className="mt-1 text-xs text-ia-muted">
                      {item.status} · vence {item.vencimento}
                    </p>
                    <p className="mt-1 font-mono text-[11px] text-ia-muted">
                      {item.id}
                    </p>
                  </div>
                  <p className="text-base font-semibold tabular-nums text-ia-foreground">
                    {brl(item.valor)}
                  </p>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {item.link ? (
                    <>
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex cursor-pointer items-center rounded-xl bg-ia-primary px-4 py-2 text-sm font-medium text-white"
                      >
                        Abrir link
                      </a>
                      <CopyLinkButton text={item.link} />
                    </>
                  ) : (
                    <span className="text-xs text-ia-muted">Sem link</span>
                  )}
                  {item.cancelavel ? (
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => void cancelar(item.id)}
                      className="inline-flex cursor-pointer items-center rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      {busyId === item.id ? "Cancelando…" : "Cancelar"}
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
