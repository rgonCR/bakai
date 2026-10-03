"use client";

import { useAccountSummary } from "@/components/layout/account-summary";

type HomeSummaryCardsProps = {
  onPick?: (option: string) => void;
  className?: string;
};

export function HomeSummaryCards({
  onPick,
  className = "",
}: HomeSummaryCardsProps) {
  const {
    account,
    saldo,
    aReceberMes,
    vencidas,
    loading,
    valuesHidden,
  } = useAccountSummary();

  if (!account?.hasAsaasKey) return null;

  const mask = "R$ ••••";

  const cards = [
    {
      label: "Saldo",
      value: loading && !saldo ? "…" : valuesHidden ? mask : (saldo?.formatado ?? "—"),
      hint: "Disponível agora",
      action: "Ver saldo",
    },
    {
      label: "A receber este mês",
      value:
        loading && !aReceberMes
          ? "…"
          : valuesHidden
            ? mask
            : (aReceberMes?.formatado ?? "R$ 0,00"),
      hint:
        aReceberMes && aReceberMes.quantidade > 0
          ? `${aReceberMes.quantidade} cobrança${aReceberMes.quantidade > 1 ? "s" : ""}`
          : "Nenhuma neste mês",
      action: "Ver cobranças",
    },
    {
      label: "Vencidas",
      value:
        loading && !vencidas
          ? "…"
          : valuesHidden
            ? mask
            : (vencidas?.formatado ?? "R$ 0,00"),
      hint:
        vencidas && vencidas.quantidade > 0
          ? `${vencidas.quantidade} em atraso`
          : "Em dia",
      action: "Ver vencidas",
      alert: Boolean(vencidas && vencidas.quantidade > 0),
    },
  ];

  return (
    <div
      className={`grid w-full grid-cols-1 gap-2 sm:grid-cols-3 ${className}`}
    >
      {cards.map((card) => (
        <button
          key={card.label}
          type="button"
          onClick={() => onPick?.(card.action)}
          className={`rounded-xl border px-4 py-3 text-left transition-colors hover:border-ia-primary/40 ${
            card.alert
              ? "border-red-200 bg-red-50/60"
              : "border-ia-border bg-white"
          }`}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ia-muted">
            {card.label}
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-ia-foreground">
            {card.value}
          </p>
          <p className="mt-0.5 text-xs text-ia-muted">{card.hint}</p>
        </button>
      ))}
    </div>
  );
}
