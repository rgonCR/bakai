"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { useConversationHistory } from "./conversation-history";
import { OPERATE_NAV } from "@/lib/chat/operate-intents";

type CommandPaletteProps = {
  open: boolean;
  onClose: () => void;
};

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const { conversations } = useConversationHistory();
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const chats = conversations.filter((c) =>
      !q ? true : c.title.toLowerCase().includes(q),
    );
    const nav = OPERATE_NAV.filter((i) =>
      !q ? true : i.label.toLowerCase().includes(q),
    );
    return { chats: chats.slice(0, 8), intents: nav };
  }, [conversations, query]);

  if (!open) return null;

  function go(href: string) {
    onClose();
    router.push(href);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/35 px-4 pt-[12vh]">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Fechar busca"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Buscar conversas e atalhos"
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-ia-border bg-white shadow-xl"
      >
        <div className="flex items-center gap-2 border-b border-ia-border px-3">
          <Search size={16} className="shrink-0 text-ia-muted" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar conversas ou atalhos…"
            className="h-12 flex-1 bg-transparent text-sm text-ia-foreground outline-none placeholder:text-ia-muted"
          />
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-lg text-ia-muted hover:bg-ia-surface"
            aria-label="Fechar"
          >
            <X size={16} />
          </button>
        </div>

        <div className="ia-scrollbar max-h-[50vh] overflow-y-auto p-2">
          {filtered.intents.length > 0 ? (
            <div className="mb-2">
              <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-ia-muted">
                Atalhos
              </p>
              <ul>
                {filtered.intents.map((i) => (
                  <li key={i.id}>
                    <button
                      type="button"
                      className="w-full rounded-lg px-2 py-2 text-left text-sm text-ia-foreground hover:bg-ia-surface"
                      onClick={() => go(i.href)}
                    >
                      {i.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-ia-muted">
            Conversas
          </p>
          {filtered.chats.length === 0 ? (
            <p className="px-2 py-3 text-sm text-ia-muted">Nenhuma conversa.</p>
          ) : (
            <ul>
              {filtered.chats.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-ia-foreground hover:bg-ia-surface"
                    onClick={() => go(`/?c=${c.id}`)}
                  >
                    {c.hasPendingAction ? (
                      <span className="size-1.5 shrink-0 rounded-full bg-amber-500" />
                    ) : null}
                    <span className="truncate">{c.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
