"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  cobrancaMissing,
  createEmptyCobrancaDraft,
  mergeCobrancaDraft,
  type CobrancaDraft,
  type CobrancaDraftPatch,
} from "@/lib/chat/cobranca-draft";

type TaskDraftContextValue = {
  draft: CobrancaDraft | null;
  missing: ReturnType<typeof cobrancaMissing>;
  panelVisible: boolean;
  patchDraft: (patch: CobrancaDraftPatch) => void;
  openCobranca: (patch?: CobrancaDraftPatch) => CobrancaDraft;
  setPanelOpen: (open: boolean) => void;
  clearDraft: () => void;
  replaceDraft: (draft: CobrancaDraft | null) => void;
};

const TaskDraftContext = createContext<TaskDraftContextValue | null>(null);

export function TaskDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<CobrancaDraft | null>(null);

  const patchDraft = useCallback((patch: CobrancaDraftPatch) => {
    setDraft((current) => mergeCobrancaDraft(current, patch));
  }, []);

  const openCobranca = useCallback((patch?: CobrancaDraftPatch) => {
    const next = mergeCobrancaDraft(
      null,
      {
        panelOpen: true,
        status: "draft",
        activeStepId: "cliente",
        ...patch,
      },
    );
    // se já tem cliente, pula pro próximo
    if (next.cliente || next.cliente_id) {
      if (next.valor && next.vencimento) {
        next.activeStepId = "forma";
      } else {
        next.activeStepId = "valor_vencimento";
      }
    }
    setDraft(next);
    return next;
  }, []);

  const setPanelOpen = useCallback((open: boolean) => {
    setDraft((current) =>
      current ? { ...current, panelOpen: open } : current,
    );
  }, []);

  const clearDraft = useCallback(() => setDraft(null), []);

  const replaceDraft = useCallback((next: CobrancaDraft | null) => {
    setDraft(next);
  }, []);

  const value = useMemo<TaskDraftContextValue>(() => {
    const missing = draft ? cobrancaMissing(draft) : [];
    return {
      draft,
      missing,
      panelVisible: Boolean(draft?.panelOpen),
      patchDraft,
      openCobranca,
      setPanelOpen,
      clearDraft,
      replaceDraft,
    };
  }, [draft, patchDraft, openCobranca, setPanelOpen, clearDraft, replaceDraft]);

  return (
    <TaskDraftContext.Provider value={value}>
      {children}
    </TaskDraftContext.Provider>
  );
}

export function useTaskDraft() {
  const ctx = useContext(TaskDraftContext);
  if (!ctx) {
    throw new Error("useTaskDraft deve estar dentro de TaskDraftProvider");
  }
  return ctx;
}

/** Para componentes que podem renderizar fora do provider (testes) */
export function useTaskDraftOptional() {
  return useContext(TaskDraftContext);
}

export function createEmptyDraftForTests() {
  return createEmptyCobrancaDraft();
}
