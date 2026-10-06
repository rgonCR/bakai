"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AgentQuestion, ChatMessage, FormBlock } from "@/lib/chat/types";
import type { UICard } from "@/lib/agent/types";
import { mockAgentReply } from "@/lib/chat/mock-agent";
import { streamChatMessage } from "@/lib/chat/live-client";
import {
  cobrancaStepForm,
  formatConfirmCobrancaAudit,
  formatWizardAudit,
  isCobrancaReady,
  nextCobrancaStep,
  patchFromFormValues,
  type CobrancaDraft,
  type CobrancaStepId,
} from "@/lib/chat/cobranca-draft";
import { useAccountSummary } from "@/components/layout/account-summary";
import { useConversationHistory } from "@/components/layout/conversation-history";
import { useTaskDraft } from "@/components/layout/task-draft";
import { executeEndpoint } from "@/lib/chat/agent-endpoints";
import { agentAuthHeaders } from "@/lib/chat/auth-headers";
import { pickHeroActions } from "@/lib/chat/hero-actions";
import { AiOrb } from "./ai-orb";
import { AssistantBubble } from "./assistant-bubble";
import { ChatInput } from "./chat-input";
import { GenerationStatus } from "./generation-status";
import { PromptBubble } from "./prompt-bubble";
import { ReportPanel } from "./report-panel";
import { HomeSummaryCards } from "./home-summary-cards";
import { SuggestionChips } from "./suggestion-chips";
import { UiCardView } from "./ui-card";
import { ChatFormBlock } from "@/components/ui/form-shell";

type ViewState = "empty" | "chatting" | "thinking" | "error";

const CONTENT_MAX = "mx-auto w-full max-w-3xl px-4 sm:px-6";
const SCROLL_TOP_PAD = 24;
const SCROLL_BOTTOM_PAD = 20;

/**
 * Resposta curta: scroll mínimo para caber inteira na viewport.
 * Resposta longa: teto = início da resposta no topo.
 */
function anchorAssistantTurn(
  container: HTMLElement,
  turn: HTMLElement,
  behavior: ScrollBehavior = "smooth",
) {
  const viewH = container.clientHeight;
  const turnTop = turn.offsetTop;
  const turnH = turn.offsetHeight;
  const startAtTop = Math.max(0, turnTop - SCROLL_TOP_PAD);

  if (turnH + SCROLL_TOP_PAD + SCROLL_BOTTOM_PAD > viewH) {
    container.scrollTo({ top: startAtTop, behavior });
    return;
  }

  const showBottom = Math.max(
    0,
    turnTop + turnH - viewH + SCROLL_BOTTOM_PAD,
  );
  container.scrollTo({ top: showBottom, behavior });
}

type BankChatProps = {
  userName?: string;
  /** true = Asaas real via /api/chat; false = mock local */
  live?: boolean;
  /** id da conversa na URL (?c=) — null/undefined = novo chat */
  activeConversationId?: string | null;
  onConversationIdChange?: (id: string | undefined) => void;
  /** Prompt automático ao montar (ex.: intent=extrato) */
  initialPrompt?: string | null;
  /** Chips iniciais quando intent não dispara prompt */
  initialChips?: string[] | null;
};

export function BankChat({
  userName = "você",
  live = false,
  activeConversationId = null,
  onConversationIdChange,
  initialPrompt = null,
  initialChips = null,
}: BankChatProps) {
  const router = useRouter();
  const { refresh, upsertConversation } = useConversationHistory();
  const { refresh: refreshSummary } = useAccountSummary();
  const {
    draft: cobrancaDraft,
    panelVisible,
    openCobranca,
    patchDraft: patchCobranca,
    setPanelOpen,
    clearDraft: clearCobranca,
  } = useTaskDraft();
  const loadedIdRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastAssistantRef = useRef<HTMLDivElement>(null);
  const pendingAnchorRef = useRef<"none" | "smooth" | "auto">("none");
  const [draft, setDraft] = useState("");
  const [wizardForm, setWizardForm] = useState<FormBlock | null>(null);
  const [viewState, setViewState] = useState<ViewState>("empty");
  const [statusLabel, setStatusLabel] = useState("Consultando…");
  const [errorMessage, setErrorMessage] = useState<string>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [awaitingAgent, setAwaitingAgent] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>(
    activeConversationId ?? undefined,
  );
  const [loadingHistory, setLoadingHistory] = useState(
    Boolean(activeConversationId),
  );
  const [anchorNonce, setAnchorNonce] = useState(0);
  const [heroActions, setHeroActions] = useState<string[]>([]);
  const [executingPendingId, setExecutingPendingId] = useState<string | null>(
    null,
  );
  const [resolvedPendingIds, setResolvedPendingIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [lockedMessageIds, setLockedMessageIds] = useState<Set<string>>(
    () => new Set(),
  );

  const lastAssistantId =
    messages.findLast((m) => m.role === "assistant")?.id ?? null;
  const loadingHistoryRef = useRef(loadingHistory);
  loadingHistoryRef.current = loadingHistory;

  function requestAnchor(behavior: "smooth" | "auto") {
    pendingAnchorRef.current = behavior;
    setAnchorNonce((n) => n + 1);
  }

  // Dep única e estável — evita erro de HMR por tamanho de array mudar
  useLayoutEffect(() => {
    if (anchorNonce === 0) return;
    if (pendingAnchorRef.current === "none") return;
    if (loadingHistoryRef.current) return;

    const container = scrollRef.current;
    const turn = lastAssistantRef.current;
    if (!container || !turn) return;

    const behavior = pendingAnchorRef.current;
    pendingAnchorRef.current = "none";

    const run = () => anchorAssistantTurn(container, turn, behavior);
    run();
    requestAnimationFrame(run);
  }, [anchorNonce]);

  useEffect(() => {
    let cancelled = false;

    async function loadConversation(id: string) {
      setLoadingHistory(true);
      setErrorMessage(undefined);
      setAwaitingAgent(false);
      setDraft("");
      try {
        const res = await fetch(`/api/conversations/${id}`);
        if (!res.ok) {
          throw new Error(
            res.status === 404
              ? "Conversa não encontrada."
              : "Não foi possível abrir a conversa.",
          );
        }
        const json = (await res.json()) as {
          messages: ChatMessage[];
          conversation: { id: string; title: string };
        };
        if (cancelled) return;
        loadedIdRef.current = json.conversation.id;
        setConversationId(json.conversation.id);
        setMessages(json.messages ?? []);
        setExecutingPendingId(null);
        setResolvedPendingIds(new Set());
        setLockedMessageIds(new Set());
        setWizardForm(null);
        clearCobranca();
        setViewState(
          (json.messages?.length ?? 0) > 0 ? "chatting" : "empty",
        );
        if ((json.messages?.length ?? 0) > 0) {
          pendingAnchorRef.current = "auto";
          setAnchorNonce((n) => n + 1);
        }
      } catch (error) {
        if (cancelled) return;
        loadedIdRef.current = null;
        setMessages([]);
        setConversationId(undefined);
        setViewState("error");
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Não foi possível abrir a conversa.",
        );
      } finally {
        if (!cancelled) {
          setLoadingHistory(false);
          // garante re-ancorar depois do DOM do chat montar
          if (pendingAnchorRef.current !== "none") {
            setAnchorNonce((n) => n + 1);
          }
        }
      }
    }

    if (activeConversationId) {
      // evita refetch ao só sincronizar a URL depois de criar a conversa
      if (loadedIdRef.current === activeConversationId) {
        setLoadingHistory(false);
        return;
      }
      void loadConversation(activeConversationId);
      return () => {
        cancelled = true;
      };
    }

    loadedIdRef.current = null;
    setLoadingHistory(false);
    setDraft("");
    setErrorMessage(undefined);
    setStatusLabel("Consultando…");
    setMessages([]);
    setAwaitingAgent(false);
    setConversationId(undefined);
    setExecutingPendingId(null);
    setResolvedPendingIds(new Set());
    setLockedMessageIds(new Set());
    setWizardForm(null);
    clearCobranca();
    setViewState("empty");
    return () => {
      cancelled = true;
    };
  }, [activeConversationId, clearCobranca]);

  function resetConversation() {
    loadedIdRef.current = null;
    setDraft("");
    setErrorMessage(undefined);
    setStatusLabel("Consultando…");
    setMessages([]);
    setAwaitingAgent(false);
    setConversationId(undefined);
    setExecutingPendingId(null);
    setResolvedPendingIds(new Set());
    setLockedMessageIds(new Set());
    setWizardForm(null);
    clearCobranca();
    setViewState("empty");
    onConversationIdChange?.(undefined);
  }

  function applyTaskDraftFromCards(cards?: UICard[]): FormBlock | null {
    const taskCard = cards?.find((c) => c.type === "task_draft");
    if (!taskCard || taskCard.type !== "task_draft") return null;

    const opened = openCobranca({
      conversationId,
      ...taskCard.props.patch,
      panelOpen: true,
    });

    if (taskCard.props.open_wizard === false) {
      setWizardForm(null);
      if (isCobrancaReady(opened)) {
        void prepareConfirmCard(opened);
      }
      return null;
    }

    const step =
      (taskCard.props.patch.activeStepId as CobrancaStepId | undefined) ??
      opened.activeStepId;

    if (!step) {
      setWizardForm(null);
      if (isCobrancaReady(opened)) {
        void prepareConfirmCard(opened);
      }
      return null;
    }

    const form = cobrancaStepForm(step, opened);
    setWizardForm(form);
    patchCobranca({ activeStepId: step });
    return form;
  }

  async function persistAudit(text: string, convId?: string) {
    const id = convId ?? conversationId;
    if (!id || !live) return;
    try {
      await fetch(`/api/conversations/${id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "user", text }),
      });
    } catch {
      // UI já registra; persistência é best-effort
    }
  }

  function lockMessage(messageId: string) {
    setLockedMessageIds((prev) => new Set(prev).add(messageId));
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, interactionLocked: true } : m,
      ),
    );
  }

  function advanceWizard(
    values: Record<string, string>,
    skip = false,
    sourceMessageId?: string,
  ) {
    if (!cobrancaDraft) return;
    const stepId = (wizardForm?.stepId ??
      cobrancaDraft.activeStepId ??
      "cliente") as CobrancaStepId;

    if (sourceMessageId) lockMessage(sourceMessageId);

    const audit = formatWizardAudit(stepId, values, skip);
    const userMsg: ChatMessage = {
      id: `u-wiz-${Date.now()}`,
      role: "user",
      content: audit,
    };
    setMessages((prev) => [...prev, userMsg]);
    void persistAudit(audit);

    const patch = skip
      ? stepId === "forma"
        ? { forma: "UNDEFINED" as const, activeStepId: "forma" as const }
        : stepId === "contato"
          ? { activeStepId: undefined }
          : patchFromFormValues(stepId, values)
      : patchFromFormValues(stepId, values);

    patchCobranca({
      ...patch,
      conversationId: conversationId ?? cobrancaDraft.conversationId,
    });

    const merged: CobrancaDraft = {
      ...cobrancaDraft,
      ...patch,
      tipo: "avulsa",
      forma: patch.forma ?? cobrancaDraft.forma,
      status: cobrancaDraft.status,
      taskId: cobrancaDraft.taskId,
      panelOpen: true,
    };

    const next = nextCobrancaStep({
      ...merged,
      activeStepId: stepId,
    });

    if (next) {
      const form = cobrancaStepForm(next, {
        ...merged,
        activeStepId: next,
      });
      setWizardForm(form);
      patchCobranca({ activeStepId: next });
      const assistantMsg: ChatMessage = {
        id: `a-wiz-${Date.now()}`,
        role: "assistant",
        content:
          next === "valor_vencimento"
            ? "Agora valor e vencimento:"
            : next === "forma"
              ? "Como o cliente pode pagar? (opcional)"
              : next === "contato"
                ? "Quer acrescentar e-mail, WhatsApp ou descrição? (opcional)"
                : "Continue:",
        form,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      if (conversationId && live) {
        void fetch(`/api/conversations/${conversationId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role: "assistant",
            text: assistantMsg.content,
          }),
        });
      }
      requestAnchor("smooth");
      return;
    }

    setWizardForm(null);
    if (!isCobrancaReady(merged)) {
      setMessages((prev) => [
        ...prev,
        {
          id: `a-wiz-${Date.now()}`,
          role: "assistant",
          content:
            "Ainda falta algum dado obrigatório — complete no formulário acima.",
        },
      ]);
      requestAnchor("smooth");
      return;
    }

    void prepareConfirmCard(merged);
  }

  async function prepareConfirmCard(source: {
    cliente?: string;
    cliente_id?: string;
    cpf_cnpj?: string;
    cliente_novo?: boolean;
    valor?: number;
    vencimento?: string;
    forma?: import("@/lib/asaas/payments").AsaasBillingType;
    email?: string;
    telefone?: string;
    descricao?: string;
    conversationId?: string;
  }) {
    setAwaitingAgent(true);
    setStatusLabel("Preparando confirmação…");
    try {
      const prep = await fetch("/api/cobranca/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: conversationId ?? source.conversationId,
          cliente: source.cliente,
          cliente_id: source.cliente_id,
          cpf_cnpj: source.cpf_cnpj,
          criar_cliente:
            source.cliente_novo === true
              ? true
              : source.cliente_novo === false
                ? false
                : undefined,
          valor: source.valor,
          vencimento: source.vencimento,
          forma: source.forma ?? "UNDEFINED",
          email: source.email,
          telefone: source.telefone,
          descricao: source.descricao,
        }),
      });
      const json = (await prep.json()) as {
        ok?: boolean;
        error?: string;
        pending_action_id?: string;
        conversationId?: string;
        ui?: UICard;
      };

      const ui = json.ui;
      if (ui?.type === "escolha") {
        setMessages((prev) => [
          ...prev,
          {
            id: `a-wiz-${Date.now()}`,
            role: "assistant",
            content: ui.props.pergunta,
            cards: [ui],
          },
        ]);
        requestAnchor("smooth");
        return;
      }

      if (!prep.ok || !json.pending_action_id || !ui) {
        throw new Error(json.error || "Não foi possível preparar a cobrança.");
      }

      if (json.conversationId && !conversationId) {
        loadedIdRef.current = json.conversationId;
        setConversationId(json.conversationId);
        onConversationIdChange?.(json.conversationId);
      }

      patchCobranca({
        pending_action_id: json.pending_action_id,
        status: "pending_confirm",
        conversationId: json.conversationId ?? conversationId,
      });

      const confirmMsg: ChatMessage = {
        id: `a-wiz-${Date.now()}`,
        role: "assistant",
        content: "Separei a cobrança pra você confirmar:",
        cards: [ui],
      };
      setMessages((prev) => [...prev, confirmMsg]);
      if (conversationId && live) {
        void fetch(`/api/conversations/${conversationId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role: "assistant",
            parts: [
              { type: "text", text: confirmMsg.content },
              { type: "ui", ui },
            ],
          }),
        });
      }
      requestAnchor("smooth");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível preparar a confirmação.",
      );
      setViewState("error");
    } finally {
      setAwaitingAgent(false);
    }
  }

  async function handleReenviarLote(ids: string[], sourceMessageId?: string) {
    if (awaitingAgent || ids.length === 0) return;
    if (sourceMessageId) lockMessage(sourceMessageId);

    const audit = `Reenviar ${ids.length} cobrança${ids.length > 1 ? "s" : ""} vencida${ids.length > 1 ? "s" : ""}`;
    setMessages((prev) => [
      ...prev,
      { id: `u-reenv-${Date.now()}`, role: "user", content: audit },
    ]);
    void persistAudit(audit);
    setAwaitingAgent(true);
    setStatusLabel("Preparando reenvio…");
    setViewState("chatting");

    try {
      const res = await fetch("/api/cobrancas/reenviar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          cobranca_ids: ids,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        conversationId?: string;
        ui?: UICard;
      };
      if (!res.ok || !json.ui) {
        throw new Error(json.error || "Não foi possível preparar o reenvio.");
      }
      if (json.conversationId && json.conversationId !== conversationId) {
        setConversationId(json.conversationId);
        onConversationIdChange?.(json.conversationId);
      }

      const assistantMsg: ChatMessage = {
        id: `a-reenv-${Date.now()}`,
        role: "assistant",
        content: "Confira o reenvio:",
        cards: [json.ui],
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setAwaitingAgent(false);
      requestAnchor("smooth");
    } catch (error) {
      setAwaitingAgent(false);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível preparar o reenvio.",
      );
      setViewState("error");
    }
  }

  async function handleExecute(
    pendingActionId: string,
    action: "confirm" | "cancel",
    sourceMessageId?: string,
    meta?: { cta: string; titulo: string },
  ) {
    if (executingPendingId || awaitingAgent) return;
    if (resolvedPendingIds.has(pendingActionId)) return;

    if (sourceMessageId) lockMessage(sourceMessageId);
    setResolvedPendingIds((prev) => new Set(prev).add(pendingActionId));

    const titulo = meta?.titulo ?? "";
    const ctaLabel = meta?.cta?.trim() || "";
    const hint = `${titulo} ${ctaLabel}`.toLowerCase();
    const isPix = hint.includes("pix");
    const isBoleto =
      !isPix && (hint.includes("boleto") || /\bpagar\b/.test(hint));
    const isReenvio = hint.includes("reenvi");
    const isCobranca =
      Boolean(meta) && !isPix && !isBoleto && !isReenvio;

    // Auditoria = texto do botão clicado
    const audit =
      action === "cancel"
        ? isPix
          ? "Cancelar Pix"
          : isBoleto
            ? "Cancelar pagamento de boleto"
            : isReenvio
              ? "Cancelar reenvio"
              : "Cancelar"
        : ctaLabel ||
          formatConfirmCobrancaAudit({
            nome: cobrancaDraft?.cliente,
            valor: cobrancaDraft?.valor,
          });
    setMessages((prev) => [
      ...prev,
      { id: `u-exec-${Date.now()}`, role: "user", content: audit },
    ]);
    void persistAudit(audit);

    setExecutingPendingId(pendingActionId);
    setErrorMessage(undefined);
    setStatusLabel(action === "confirm" ? "Confirmando…" : "Cancelando…");
    setAwaitingAgent(true);
    setViewState("chatting");

    try {
      let actionId = pendingActionId;

      // Rematerializa só cobrança (edição no draft) — nunca trocar Pix/boleto
      if (
        action === "confirm" &&
        isCobranca &&
        cobrancaDraft &&
        isCobrancaReady(cobrancaDraft)
      ) {
        const prep = await fetch("/api/cobranca/prepare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId:
              conversationId ?? cobrancaDraft.conversationId,
            cliente: cobrancaDraft.cliente,
            cliente_id: cobrancaDraft.cliente_id,
            cpf_cnpj: cobrancaDraft.cpf_cnpj,
            criar_cliente:
              cobrancaDraft.cliente_novo === true
                ? true
                : cobrancaDraft.cliente_novo === false
                  ? false
                  : undefined,
            valor: cobrancaDraft.valor,
            vencimento: cobrancaDraft.vencimento,
            forma: cobrancaDraft.forma,
            email: cobrancaDraft.email,
            telefone: cobrancaDraft.telefone,
            descricao: cobrancaDraft.descricao,
          }),
        });
        const prepJson = (await prep.json()) as {
          ok?: boolean;
          error?: string;
          pending_action_id?: string;
        };
        if (prep.ok && prepJson.pending_action_id) {
          actionId = prepJson.pending_action_id;
        }
      }

      const res = await fetch(executeEndpoint(), {
        method: "POST",
        headers: await agentAuthHeaders(),
        body: JSON.stringify({
          pending_action_id: actionId,
          action,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        status?: string;
        reply?: string;
        ui?: import("@/lib/agent/types").UICard;
      };

      if (!res.ok || (!json.ok && action === "confirm")) {
        throw new Error(json.error || "Não foi possível executar a ação.");
      }

      if (isCobranca) {
        setWizardForm(null);
        clearCobranca();
      }

      const followUpChips =
        action === "cancel"
          ? ["Criar cobrança", "Ver saldo", "Fazer Pix"]
          : isPix
            ? ["Ver saldo", "Fazer Pix", "Criar cobrança"]
            : ["Nova cobrança", "Ver saldo", "Ver cobranças"];
      const defaultReply =
        action === "cancel"
          ? isPix
            ? "Pix cancelado — nada foi enviado."
            : isBoleto
              ? "Pagamento cancelado — nada foi pago."
              : "Descarti o rascunho — nada foi cobrado no Asaas."
          : isPix
            ? "Pix confirmado:"
            : isBoleto
              ? "Pagamento de boleto confirmado:"
              : "Cobrança criada.";
      const assistantMsg: ChatMessage = {
        id: `a-exec-${Date.now()}`,
        role: "assistant",
        content: json.reply || defaultReply,
        cards: json.ui ? [json.ui] : undefined,
        chips: followUpChips,
        questions:
          action === "confirm"
            ? [
                {
                  campo: "atalho",
                  texto: "O que gostaria de fazer agora?",
                  opcoes: followUpChips,
                },
              ]
            : [
                {
                  campo: "atalho",
                  texto: "Sugestões",
                  opcoes: followUpChips,
                },
              ],
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setAwaitingAgent(false);
      setExecutingPendingId(null);
      setViewState("chatting");
      requestAnchor("smooth");
      void refresh();
      void refreshSummary();
    } catch (error) {
      setAwaitingAgent(false);
      setExecutingPendingId(null);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível executar a ação.",
      );
      setViewState("error");
    }
  }

  async function handleSend(raw?: string) {
    const message = (raw ?? draft).trim();
    if (!message || awaitingAgent || loadingHistory) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: message,
    };
    setMessages((prev) => [...prev, userMsg]);
    setDraft("");
    setViewState("chatting");
    setAwaitingAgent(true);
    setStatusLabel("Consultando…");
    setErrorMessage(undefined);
    // sobe a conversa pra abrir espaço pra resposta
    requestAnimationFrame(() => {
      const container = scrollRef.current;
      if (!container) return;
      container.scrollTo({
        top: Math.max(0, container.scrollHeight - container.clientHeight),
        behavior: "smooth",
      });
    });

    try {
      let assistantMsg: ChatMessage;

      if (live) {
        assistantMsg = await streamChatMessage({
          message,
          conversationId,
          onStatus: (label) =>
            setStatusLabel(
              /gemini|llm|openai|modelo/i.test(label) ? "Consultando…" : label,
            ),
          onConversation: (id) => {
            loadedIdRef.current = id;
            setConversationId(id);
            onConversationIdChange?.(id);
            upsertConversation({
              id,
              title: message.slice(0, 80),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
            void refresh();
          },
        });
      } else {
        const agent = await mockAgentReply(message);
        if (agent.statusLabel) setStatusLabel("Consultando…");
        assistantMsg = {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: agent.reply,
          questions: agent.questions,
          report: agent.report,
          reports: agent.report ? [agent.report] : undefined,
          form: agent.form,
          cards: agent.report
            ? [
                {
                  type: "saldo",
                  props: {
                    saldo: 0,
                    ambiente: "mock",
                    formatado:
                      agent.report.fields.find((f) => f.label === "Saldo")
                        ?.value ?? "—",
                  },
                },
              ]
            : undefined,
        };
      }

      const openedForm = applyTaskDraftFromCards(assistantMsg.cards);
      const withForm =
        openedForm && !assistantMsg.form
          ? { ...assistantMsg, form: openedForm }
          : assistantMsg;

      setMessages((prev) => [...prev, withForm]);
      setAwaitingAgent(false);
      setViewState("chatting");
      requestAnchor("smooth");
      void refresh();
      void refreshSummary();
    } catch (error) {
      setAwaitingAgent(false);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível processar sua mensagem.",
      );
      setViewState("error");
    }
  }

  function handleQuestionPick(_question: AgentQuestion, option: string) {
    const normalized = option.trim().toLowerCase();
    if (
      normalized === "ver cobranças" ||
      normalized === "ver cobrancas" ||
      normalized === "listar cobranças" ||
      normalized === "listar cobrancas"
    ) {
      router.push("/cobrancas");
      return;
    }
    void handleSend(option);
  }

  function handleFormSubmit(
    values: Record<string, string>,
    form?: FormBlock,
    sourceMessageId?: string,
  ) {
    if (form?.task === "cobranca" || wizardForm?.task === "cobranca") {
      advanceWizard(values, false, sourceMessageId);
      return;
    }
    const summary = Object.entries(values)
      .filter(([, v]) => v.trim())
      .map(([k, v]) => `${k}: ${v}`)
      .join(" · ");
    void handleSend(
      summary
        ? `Confirmar formulário — ${summary}`
        : "Confirmar formulário (sem dados)",
    );
  }

  useEffect(() => {
    if (activeConversationId || loadingHistory) return;
    if (initialChips && initialChips.length > 0) {
      setHeroActions(initialChips);
      return;
    }
    setHeroActions(pickHeroActions(5));
  }, [activeConversationId, loadingHistory, initialChips]);

  const initialPromptFired = useRef(false);
  useEffect(() => {
    if (initialPromptFired.current) return;
    if (!initialPrompt?.trim()) return;
    if (activeConversationId || loadingHistory || awaitingAgent) return;
    if (messages.length > 0) return;
    initialPromptFired.current = true;
    void handleSend(initialPrompt.trim());
    // handleSend é estável o suficiente para o boot do intent
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    initialPrompt,
    activeConversationId,
    loadingHistory,
    awaitingAgent,
    messages.length,
  ]);

  if (loadingHistory) {
    return (
      <div className="flex h-full items-center justify-center bg-white">
        <GenerationStatus label="Abrindo conversa" status="thinking" />
      </div>
    );
  }

  const showHero = viewState === "empty" && messages.length === 0;

  if (showHero) {
    return (
      <div className="flex h-full flex-col overflow-hidden bg-white">
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-4 pb-8 pt-4">
          <div className="-translate-y-10 flex w-full flex-col items-center">
            <div className="mb-6">
              <AiOrb size={190} />
            </div>
            <h1 className="mb-4 max-w-2xl text-center text-[30px] font-medium leading-snug text-black">
              <span className="font-bold">Olá, {userName}!</span> O que posso
              fazer por você?
            </h1>
            {heroActions.length > 0 ? (
              <div className="mb-6 flex justify-center">
                <SuggestionChips
                  options={heroActions}
                  onPick={(opt) => void handleSend(opt)}
                />
              </div>
            ) : null}
            <div className="w-full max-w-[1000px]">
              <ChatInput
                value={draft}
                onChange={setDraft}
                onSubmit={() => void handleSend()}
                disabled={false}
                placeholder="Peça saldo, cobrança, Pix…"
              />
              <HomeSummaryCards
                className="mt-4"
                onPick={(opt) => {
                  if (
                    opt.toLowerCase() === "ver cobranças" ||
                    opt.toLowerCase() === "ver cobrancas"
                  ) {
                    router.push("/cobrancas");
                    return;
                  }
                  void handleSend(opt);
                }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden bg-white">
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <div
        ref={scrollRef}
        className={`${CONTENT_MAX} ia-scrollbar min-h-0 flex-1 overflow-y-auto py-8`}
      >
        {messages.map((m) =>
          m.role === "user" ? (
            <PromptBubble key={m.id} text={m.content} />
          ) : (
            <div
              key={m.id}
              ref={m.id === lastAssistantId ? lastAssistantRef : undefined}
            >
              {/* ordem: texto → card → chips */}
              <AssistantBubble text={m.content} />
              {m.cards
                ?.filter((card) => card.type !== "chips")
                .map((card, idx) => (
                  <UiCardView
                    key={`${m.id}-card-${idx}`}
                    card={card}
                    onOpenDetails={
                      card.type === "confirmacao" || cobrancaDraft
                        ? () => setPanelOpen(true)
                        : undefined
                    }
                    busy={
                      (card.type === "confirmacao" &&
                        executingPendingId ===
                          card.props.pending_action_id) ||
                      awaitingAgent
                    }
                    resolved={
                      m.interactionLocked ||
                      lockedMessageIds.has(m.id) ||
                      (card.type === "confirmacao" &&
                        resolvedPendingIds.has(card.props.pending_action_id))
                    }
                    onConfirm={(id, meta) =>
                      void handleExecute(id, "confirm", m.id, meta)
                    }
                    onCancel={(id, meta) =>
                      void handleExecute(id, "cancel", m.id, meta)
                    }
                    onBatchAction={(tool, ids) => {
                      if (m.interactionLocked || lockedMessageIds.has(m.id)) {
                        return;
                      }
                      if (tool === "reenviar_cobrancas") {
                        void handleReenviarLote(ids, m.id);
                      }
                    }}
                    onChoice={(id, label) => {
                      if (m.interactionLocked || lockedMessageIds.has(m.id)) {
                        return;
                      }
                      lockMessage(m.id);
                      if (id === "avulsa" || id === "recorrente") {
                        void handleSend(`Cobrança ${label.toLowerCase()}`);
                        return;
                      }
                      if (
                        id === "UNDEFINED" ||
                        id === "PIX" ||
                        id === "BOLETO" ||
                        id === "CREDIT_CARD"
                      ) {
                        patchCobranca({ forma: id });
                        void handleSend(`Forma de pagamento: ${label}`);
                        return;
                      }
                      patchCobranca({
                        cliente_id: id,
                        cliente: label,
                      });
                      void handleSend(
                        `Quero cobrar o cliente ${label} (cliente_id ${id})`,
                      );
                    }}
                  />
                ))}
              {!m.cards?.length &&
                (m.reports ?? (m.report ? [m.report] : [])).map((report) => (
                  <ReportPanel
                    key={`${m.id}-${report.title}`}
                    report={report}
                  />
                ))}
              {m.form ? (
                <ChatFormBlock
                  form={m.form}
                  onSubmit={(values) =>
                    handleFormSubmit(values, m.form, m.id)
                  }
                  onSkip={() => {
                    if (m.form?.task === "cobranca") {
                      advanceWizard({}, true, m.id);
                    }
                  }}
                  disabled={
                    awaitingAgent ||
                    m.interactionLocked ||
                    lockedMessageIds.has(m.id)
                  }
                />
              ) : null}
              {(m.chips?.length || m.questions?.some((q) => q.opcoes.length)) &&
              !awaitingAgent ? (
                <div className="mb-6">
                  <SuggestionChips
                    prompt={
                      m.questions?.[0]?.texto &&
                      m.questions[0].texto !== "Sugestões"
                        ? m.questions[0].texto
                        : undefined
                    }
                    options={
                      m.chips?.length
                        ? m.chips
                        : [
                            ...new Set(
                              m.questions?.flatMap((q) => q.opcoes) ?? [],
                            ),
                          ]
                    }
                    onPick={(opt) =>
                      handleQuestionPick(
                        m.questions?.[0] ?? {
                          campo: "atalho",
                          texto: "Sugestões",
                          opcoes: [opt],
                        },
                        opt,
                      )
                    }
                    disabled={awaitingAgent}
                  />
                </div>
              ) : null}
            </div>
          ),
        )}

        {awaitingAgent && (
          <GenerationStatus label={statusLabel} status="thinking" />
        )}

        {viewState === "error" && (
          <div className="mt-6 space-y-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <p>{errorMessage}</p>
            <button
              type="button"
              className="underline"
              onClick={resetConversation}
            >
              Começar de novo
            </button>
          </div>
        )}
      </div>

      {(viewState === "chatting" ||
        viewState === "empty" ||
        viewState === "thinking") && (
        <div className="shrink-0 bg-gradient-to-t from-white from-80% to-transparent px-4 pb-4 pt-4">
          <div className={CONTENT_MAX}>
            <ChatInput
              value={draft}
              onChange={setDraft}
              onSubmit={() => void handleSend()}
              disabled={awaitingAgent}
              variant="chat"
              placeholder={
                cobrancaDraft
                  ? "Responda ou continue no formulário…"
                  : "Peça ao bank.ai…"
              }
            />
          </div>
        </div>
      )}
      </div>
      {cobrancaDraft && !panelVisible ? (
        <button
          type="button"
          className="fixed bottom-24 right-4 z-30 cursor-pointer rounded-xl border border-ia-border bg-[#F4F7FB] px-3 py-2 text-xs font-semibold text-ia-foreground shadow-sm xl:bottom-8"
          onClick={() => setPanelOpen(true)}
        >
          Ver detalhes
        </button>
      ) : null}
    </div>
  );
}
