import Image from "next/image";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  FileText,
  MessagesSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const navItems: NavItem[] = [
  { href: "/", label: "Conversar", icon: MessagesSquare },
  { href: "/extratos", label: "Extratos", icon: FileText },
];

export const settingsItem: NavItem = {
  href: "/configuracoes",
  label: "Configurações",
  icon: Settings,
};

type SidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
  activePath: string;
};

function NavLink({
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
      className={`group/link relative flex items-center py-2 text-sm font-medium text-ia-foreground transition-colors ${
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

export function Sidebar({ collapsed, onToggle, activePath }: SidebarProps) {
  return (
    <aside
      className={`flex h-screen shrink-0 flex-col transition-[width] duration-200 ease-out ${
        collapsed ? "w-[52px]" : "w-[240px]"
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
              : "gap-2.5"
          }`}
          aria-label="bank.ai"
        >
          <Image
            src="/bankai-symbol.svg"
            alt=""
            width={32}
            height={32}
            priority
          />
          {!collapsed && (
            <span className="text-lg font-bold tracking-tight text-ia-foreground">
              bank.ai
            </span>
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

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto pt-1">
        {navItems.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            collapsed={collapsed}
            isActive={activePath === item.href}
          />
        ))}
      </nav>

      <div className="mt-auto shrink-0 pb-3 pt-2">
        <NavLink
          item={settingsItem}
          collapsed={collapsed}
          isActive={activePath === settingsItem.href}
        />
      </div>
    </aside>
  );
}
