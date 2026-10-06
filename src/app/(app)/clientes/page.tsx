"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Search, Users } from "lucide-react";

type ClienteItem = {
  id: string;
  nome: string;
  cpf_cnpj: string;
  email: string;
  telefone: string;
};

function formatCpfCnpj(raw?: string) {
  if (!raw) return "—";
  const d = raw.replace(/\D/g, "");
  if (d.length === 11) {
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  if (d.length === 14) {
    return d.replace(
      /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
      "$1.$2.$3/$4-$5",
    );
  }
  return raw;
}

export default function ClientesPage() {
  const [query, setQuery] = useState("");
  const [itens, setItens] = useState<ClienteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/clientes/search?q=${encodeURIComponent(q.trim())}`,
      );
      const json = (await res.json()) as {
        clientes?: ClienteItem[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(json.error || "Falha ao buscar clientes.");
      }
      setItens(json.clientes ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar.");
      setItens([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => void load(query), 280);
    return () => window.clearTimeout(t);
  }, [query, load]);

  return (
    <div className="flex h-full flex-col overflow-auto">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ia-primary/10 text-ia-primary">
              <Users className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-ia-foreground">
                Clientes
              </h1>
              <p className="mt-1 text-sm text-ia-muted">
                Busque cadastros no Asaas pelo nome ou CPF/CNPJ.
              </p>
            </div>
          </div>
          <Link
            href="/"
            className="rounded-xl bg-ia-primary px-4 py-2.5 text-sm font-semibold text-white"
          >
            Cobrar cliente
          </Link>
        </header>

        <div className="relative mb-6">
          <Search
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ia-muted"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome ou CPF/CNPJ…"
            className="w-full rounded-xl border border-ia-border bg-white py-2.5 pl-10 pr-3.5 text-sm text-ia-foreground outline-none placeholder:text-ia-muted/70 focus:border-ia-primary"
          />
        </div>

        {error ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {loading ? (
          <p className="text-sm text-ia-muted">Buscando clientes…</p>
        ) : itens.length === 0 ? (
          <div className="rounded-xl border border-dashed border-ia-border px-6 py-12 text-center">
            <p className="text-sm text-ia-muted">
              {query.trim()
                ? "Nenhum cliente encontrado."
                : "Nenhum cliente listado ainda."}
            </p>
            <Link
              href="/"
              className="mt-4 inline-block text-sm font-medium text-ia-primary hover:underline"
            >
              Cadastrar cobrando pelo chat
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {itens.map((c) => (
              <li
                key={c.id}
                className="rounded-xl border border-ia-border bg-white p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ia-foreground">
                      {c.nome}
                    </p>
                    <p className="mt-1 text-xs text-ia-muted">
                      {formatCpfCnpj(c.cpf_cnpj)}
                      {c.email ? ` · ${c.email}` : ""}
                      {c.telefone ? ` · ${c.telefone}` : ""}
                    </p>
                    <p className="mt-1 font-mono text-[11px] text-ia-muted">
                      {c.id}
                    </p>
                  </div>
                  <Link
                    href={`/?q=${encodeURIComponent(`Cobra o ${c.nome}`)}`}
                    className="rounded-xl border border-ia-border bg-white px-4 py-2 text-sm font-medium text-ia-foreground hover:bg-ia-surface"
                  >
                    Cobrar
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
