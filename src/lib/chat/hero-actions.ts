/** Ações ligadas a tools reais — pills da home (ordem estável). */
export const HERO_ACTIONS = [
  "Criar cobrança",
  "Ver vencidas",
  "Fazer Pix",
  "Como foi o mês?",
  "Pagar boleto",
  "Ver saldo",
  "Ver extrato",
] as const;

const MAX_HERO_ACTIONS = 5;

/** Devolve as ações da home. */
export function pickHeroActions(
  max = MAX_HERO_ACTIONS,
  pool: readonly string[] = HERO_ACTIONS,
): string[] {
  return [...pool].slice(0, Math.min(max, pool.length));
}
