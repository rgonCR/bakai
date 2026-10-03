"use client";

import { ChevronDown, Eye, EyeOff } from "lucide-react";
import { useAccountSummary } from "./account-summary";

export function Topbar() {
  const { account, saldo, loading, valuesHidden, toggleValuesHidden } =
    useAccountSummary();

  const empresa =
    account?.nome?.trim() ||
    (loading ? "…" : "Sua empresa");
  const isSandbox = !account || account.env !== "production";

  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-ia-border/70 px-4 sm:px-5">
      <button
        type="button"
        className="inline-flex max-w-[50%] items-center gap-1 truncate text-sm font-semibold text-ia-foreground"
        title="Seletor de conta (MVP: uma conta)"
      >
        <span className="truncate">{empresa}</span>
        <ChevronDown size={16} strokeWidth={1.75} className="shrink-0 text-ia-muted" />
      </button>

      <div className="flex items-center gap-2 sm:gap-3">
        {isSandbox ? (
          <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
            Sandbox
          </span>
        ) : null}

        <div className="flex items-center gap-1.5 text-sm text-ia-foreground">
          <span className="hidden text-ia-muted sm:inline">Saldo</span>
          <span className="min-w-[5.5rem] text-right font-semibold tabular-nums">
            {loading && !saldo
              ? "…"
              : valuesHidden
                ? "R$ ••••"
                : (saldo?.formatado ?? "—")}
          </span>
          <button
            type="button"
            onClick={toggleValuesHidden}
            className="flex size-8 items-center justify-center rounded-lg text-ia-muted transition-colors hover:bg-ia-surface hover:text-ia-foreground"
            aria-label={valuesHidden ? "Mostrar valores" : "Ocultar valores"}
            title={valuesHidden ? "Mostrar valores" : "Ocultar valores"}
          >
            {valuesHidden ? (
              <EyeOff size={16} strokeWidth={1.75} />
            ) : (
              <Eye size={16} strokeWidth={1.75} />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
