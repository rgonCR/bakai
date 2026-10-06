/** Itens do menu OPERAR — páginas dedicadas (mesmo molde de /cobrancas). */

export type OperateNavItem = {
  id: string;
  label: string;
  href: string;
};

export const OPERATE_NAV: OperateNavItem[] = [
  { id: "cobrancas", label: "Cobranças", href: "/cobrancas" },
  { id: "pagamentos", label: "Pagamentos", href: "/pagamentos" },
  { id: "extrato", label: "Extrato", href: "/extrato" },
  { id: "clientes", label: "Clientes", href: "/clientes" },
  { id: "relatorios", label: "Relatórios", href: "/relatorios" },
];

/** @deprecated use OPERATE_NAV — mantido só se algum import antigo restar */
export const OPERATE_INTENTS = OPERATE_NAV;

export type OperateIntent = OperateNavItem & {
  prompt?: string;
  chips?: string[];
};

export function resolveOperateIntent(
  _id: string | null | undefined,
): OperateIntent | null {
  return null;
}
