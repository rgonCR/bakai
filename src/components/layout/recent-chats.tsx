"use client";

import Link from "next/link";
import { useConversationHistory } from "./conversation-history";

type RecentChatsProps = {
  collapsed: boolean;
  activeConversationId?: string | null;
};

export function RecentChats({
  collapsed,
  activeConversationId,
}: RecentChatsProps) {
  const { conversations, loading } = useConversationHistory();

  if (collapsed) return null;
  if (!loading && conversations.length === 0) return null;

  return (
    <div className="mt-4 flex min-h-0 flex-1 flex-col px-2">
      <p className="px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ia-muted">
        Recentes
      </p>
      <div className="ia-scrollbar min-h-0 flex-1 overflow-y-auto pb-2">
        {loading && conversations.length === 0 ? (
          <p className="px-1 py-1.5 text-xs text-ia-muted">Carregando…</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {conversations.map((c) => {
              const active = activeConversationId === c.id;
              return (
                <li key={c.id}>
                  <Link
                    href={`/?c=${c.id}`}
                    title={c.title}
                    className={`block truncate rounded-lg px-2 py-1.5 text-sm transition-colors ${
                      active
                        ? "bg-ia-surface font-medium text-ia-foreground"
                        : "text-ia-foreground/85 hover:bg-ia-surface/80"
                    }`}
                  >
                    {c.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
