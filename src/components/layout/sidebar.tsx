"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  FileText,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  Settings,
  SquarePen,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { RecentChats } from "./recent-chats";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const operateItems: NavItem[] = [
  { href: "/cobrancas", label: "Cobranças", icon: Receipt },
  { href: "/pagamentos", label: "Pagamentos", icon: Wallet },
  { href: "/extrato", label: "Extrato", icon: FileText },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
];

type SidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
  activePath: string;
  activeConversationId?: string | null;
};

function SectionLabel({
  collapsed,
  children,
}: {
  collapsed: boolean;
  children: React.ReactNode;
}) {
  if (collapsed) return null;
  return (
    <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-ia-muted">
      {children}
    </p>
  );
}

function NavRow({
  item,
  collapsed,
  isActive,
}: {
  item: NavItem;
  collapsed: boolean;
  isActive: boolean;
}) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      className={`group/link relative flex w-full items-center py-2 text-sm font-medium text-ia-foreground/90 transition-colors hover:text-ia-foreground ${
        collapsed ? "justify-center px-0" : "gap-3 pl-3 pr-3"
      }`}
    >
      <span
        aria-hidden
        className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-ia-primary transition-opacity ${
          isActive ? "opacity-100" : "opacity-0 group-hover/link:opacity-100"
        }`}
      />
      <Icon
        size={20}
        strokeWidth={1.75}
        className={`shrink-0 ${isActive ? "text-ia-primary" : ""}`}
      />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}

export function Sidebar({
  collapsed,
  onToggle,
  activePath,
  activeConversationId,
}: SidebarProps) {
  const router = useRouter();
  const onHome = activePath === "/" && !activeConversationId;

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <aside
      className={`flex h-screen shrink-0 flex-col transition-[width] duration-200 ease-out ${
        collapsed ? "w-[56px]" : "w-[264px]"
      }`}
    >
      <div
        className={`group/header relative flex h-14 shrink-0 items-center ${
          collapsed ? "justify-center" : "justify-between pl-3 pr-2"
        }`}
      >
        <Link
          href="/"
          className={`flex shrink-0 items-center transition-opacity duration-150 ${
            collapsed
              ? "justify-center group-hover/header:opacity-0"
              : ""
          }`}
          aria-label="bank.ai"
        >
          {collapsed ? (
            <span className="flex size-8 items-center justify-center overflow-hidden rounded-full">
              <Image
                src="/logo/logo_bank_elipse.svg"
                alt=""
                width={32}
                height={32}
                className="size-8 object-cover"
                priority
              />
            </span>
          ) : (
            <Image
              src="/logo/logo_menu_aberto.svg"
              alt="bank.ai"
              width={160}
              height={48}
              className="h-12 w-auto"
              priority
            />
          )}
        </Link>

        {!collapsed && (
          <button
            type="button"
            onClick={onToggle}
            aria-label="Recolher menu"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-ia-foreground transition-colors hover:bg-ia-surface"
          >
            <PanelLeftClose size={18} strokeWidth={1.75} />
          </button>
        )}

        {collapsed && (
          <button
            type="button"
            onClick={onToggle}
            aria-label="Abrir barra lateral"
            title="Abrir barra lateral"
            className="absolute inset-0 m-auto flex size-8 items-center justify-center rounded-full bg-ia-surface text-ia-foreground opacity-0 transition-opacity duration-150 group-hover/header:opacity-100"
          >
            <PanelLeftOpen size={18} strokeWidth={1.75} />
          </button>
        )}
      </div>

      <nav className="ia-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto pt-1">
        <div className="flex shrink-0 flex-col gap-0.5">
          <NavRow
            item={{
              href: "/",
              label: "Nova conversa",
              icon: SquarePen,
            }}
            collapsed={collapsed}
            isActive={onHome}
          />
        </div>

        <SectionLabel collapsed={collapsed}>Operar</SectionLabel>
        <div className="flex shrink-0 flex-col gap-0.5">
          {operateItems.map((item) => (
            <NavRow
              key={item.href}
              item={item}
              collapsed={collapsed}
              isActive={activePath === item.href}
            />
          ))}
        </div>

        <RecentChats
          collapsed={collapsed}
          activeConversationId={activeConversationId}
        />
      </nav>

      <div className="shrink-0 border-t border-ia-border/60 pb-3 pt-2">
        <div
          className={`flex items-center ${
            collapsed ? "justify-center" : "pr-2"
          }`}
        >
          <div className="min-w-0 flex-1">
            <NavRow
              item={{
                href: "/conta",
                label: "Minha conta",
                icon: UserRound,
              }}
              collapsed={collapsed}
              isActive={activePath === "/conta"}
            />
          </div>
          {!collapsed && (
            <button
              type="button"
              onClick={() => void handleLogout()}
              aria-label="Sair"
              title="Sair"
              className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-ia-muted transition-colors hover:bg-ia-surface hover:text-ia-foreground"
            >
              <LogOut size={18} strokeWidth={1.75} />
            </button>
          )}
        </div>
        {collapsed && (
          <button
            type="button"
            onClick={() => void handleLogout()}
            aria-label="Sair"
            title="Sair"
            className="mx-auto mt-0.5 flex size-8 cursor-pointer items-center justify-center rounded-lg text-ia-muted transition-colors hover:bg-ia-surface hover:text-ia-foreground"
          >
            <LogOut size={18} strokeWidth={1.75} />
          </button>
        )}
        <NavRow
          item={{
            href: "/configuracoes",
            label: "Configurações",
            icon: Settings,
          }}
          collapsed={collapsed}
          isActive={activePath === "/configuracoes"}
        />
        {!collapsed && (
          <p className="mt-2 px-3 text-[10px] leading-snug text-ia-muted">
            Conta de pagamento fornecida por Asaas
          </p>
        )}
      </div>
    </aside>
  );
}
