"use client";

import { useState } from "react";
import type { AgentQuestion, ChatMessage } from "@/lib/chat/types";
import { mockAgentReply } from "@/lib/chat/mock-agent";
import { AiOrb } from "./ai-orb";
import { AssistantBubble } from "./assistant-bubble";
import { ChatInput } from "./chat-input";
import { GenerationStatus } from "./generation-status";
import { PromptBubble } from "./prompt-bubble";
import { ReportPanel } from "./report-panel";
import { ChatFormBlock } from "@/components/ui/form-shell";

type ViewState = "empty" | "chatting" | "thinking" | "error";

const CONTENT_MAX = "mx-auto w-full max-w-3xl px-4 sm:px-6";

function Disclaimer() {
  return (
    <p className="text-center text-xs text-ia-muted">
      O bank.ai é uma IA conversacional e pode cometer erros. Confirme
      operações sensíveis antes de concluir.
    </p>
  );
}

type BankChatProps = {
  userName?: string;
};

export function BankChat({ userName = "você" }: BankChatProps) {
  const [draft, setDraft] = useState("");
  const [viewState, setViewState] = useState<ViewState>("empty");
  const [statusLabel, setStatusLabel] = useState("Preparando…");
  const [errorMessage, setErrorMessage] = useState<string>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pendingQuestions, setPendingQuestions] = useState<AgentQuestion[]>(
    [],
  );
  const [awaitingAgent, setAwaitingAgent] = useState(false);

  function resetConversation() {
    setDraft("");
    setErrorMessage(undefined);
    setStatusLabel("Preparando…");
    setMessages([]);
    setPendingQuestions([]);
    setAwaitingAgent(false);
    setViewState("empty");
  }

  async function handleSend(raw?: string) {
    const message = (raw ?? draft).trim();
    if (!message || awaitingAgent) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: message,
    };
    setMessages((prev) => [...prev, userMsg]);
    setDraft("");
    setPendingQuestions([]);
    setViewState("chatting");
    setAwaitingAgent(true);
    setStatusLabel("Entendendo sua intenção…");
    setErrorMessage(undefined);

    try {
      const agent = await mockAgentReply(message);
      if (agent.statusLabel) setStatusLabel(agent.statusLabel);

      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: agent.reply,
        questions: agent.questions,
        report: agent.report,
        form: agent.form,
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setPendingQuestions(agent.questions ?? []);
      setAwaitingAgent(false);
      setViewState("chatting");
    } catch {
      setAwaitingAgent(false);
      setErrorMessage("Não foi possível processar sua mensagem.");
      setViewState("error");
    }
  }

  function handleQuestionPick(_question: AgentQuestion, option: string) {
    void handleSend(option);
  }

  function handleFormSubmit(values: Record<string, string>) {
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

  const showHero = viewState === "empty" && messages.length === 0;

  if (showHero) {
    return (
      <div className="flex h-full flex-col overflow-hidden bg-white">
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-4 pb-8 pt-4">
          <div className="-translate-y-10 flex w-full flex-col items-center">
            <div className="mb-6">
              <AiOrb size={190} />
            </div>
            <h1 className="mb-8 max-w-2xl text-center text-[30px] font-medium leading-snug text-black">
              <span className="font-bold">Olá, {userName}!</span> O que vamos
              resolver no banco hoje?
            </h1>
            <div className="w-full max-w-[1000px]">
              <ChatInput
                value={draft}
                onChange={setDraft}
                onSubmit={() => void handleSend()}
                disabled={false}
              />
            </div>
          </div>
        </div>
        <div className="shrink-0 px-4 pb-4">
          <Disclaimer />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white">
      <div
        className={`${CONTENT_MAX} ia-scrollbar min-h-0 flex-1 overflow-y-auto py-8`}
      >
        {messages.map((m) =>
          m.role === "user" ? (
            <PromptBubble key={m.id} text={m.content} />
          ) : (
            <div key={m.id}>
              <AssistantBubble
                text={m.content}
                questions={m.questions}
                onPick={handleQuestionPick}
              />
              {m.report ? <ReportPanel report={m.report} /> : null}
              {m.form ? (
                <ChatFormBlock
                  form={m.form}
                  onSubmit={handleFormSubmit}
                  disabled={awaitingAgent}
                />
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
            {pendingQuestions.length > 0 && viewState === "chatting" && (
              <div className="mb-3 flex flex-wrap gap-2">
                {pendingQuestions.flatMap((q) =>
                  q.opcoes.map((opt) => (
                    <button
                      key={`${q.campo}-${opt}`}
                      type="button"
                      className="rounded-full border border-black/10 px-3 py-1 text-xs"
                      onClick={() => handleQuestionPick(q, opt)}
                    >
                      {opt}
                    </button>
                  )),
                )}
              </div>
            )}
            <ChatInput
              value={draft}
              onChange={setDraft}
              onSubmit={() => void handleSend()}
              disabled={awaitingAgent}
              variant="chat"
              placeholder="Peça ao bank.ai…"
            />
            <div className="mt-3">
              <Disclaimer />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
