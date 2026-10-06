"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type RecentConversation = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  hasPendingAction?: boolean;
};

type ConversationHistoryValue = {
  conversations: RecentConversation[];
  loading: boolean;
  refresh: () => Promise<void>;
  upsertConversation: (item: RecentConversation) => void;
};

const ConversationHistoryContext =
  createContext<ConversationHistoryValue | null>(null);

export function ConversationHistoryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [conversations, setConversations] = useState<RecentConversation[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/conversations");
      if (!res.ok) {
        if (res.status === 401) {
          setConversations([]);
          return;
        }
        throw new Error("Falha ao listar conversas");
      }
      const json = (await res.json()) as {
        conversations: RecentConversation[];
      };
      setConversations(json.conversations ?? []);
    } catch {
      // sidebar silenciosa — chat continua usable
    } finally {
      setLoading(false);
    }
  }, []);

  const upsertConversation = useCallback((item: RecentConversation) => {
    setConversations((prev) => {
      const rest = prev.filter((c) => c.id !== item.id);
      return [item, ...rest];
    });
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ conversations, loading, refresh, upsertConversation }),
    [conversations, loading, refresh, upsertConversation],
  );

  return (
    <ConversationHistoryContext.Provider value={value}>
      {children}
    </ConversationHistoryContext.Provider>
  );
}

export function useConversationHistory() {
  const ctx = useContext(ConversationHistoryContext);
  if (!ctx) {
    throw new Error(
      "useConversationHistory deve estar dentro de ConversationHistoryProvider",
    );
  }
  return ctx;
}
