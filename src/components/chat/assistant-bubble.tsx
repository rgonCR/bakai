import type { AgentQuestion } from "@/lib/chat/types";

type AssistantBubbleProps = {
  text: string;
  questions?: AgentQuestion[];
  onPick?: (question: AgentQuestion, option: string) => void;
};

export function AssistantBubble({
  text,
  questions,
  onPick,
}: AssistantBubbleProps) {
  const choiceQuestions =
    questions?.filter((q) => q.opcoes.length > 0 && onPick) ?? [];

  return (
    <div className="mb-6 flex justify-start">
      <div className="max-w-[85%] space-y-3">
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-ia-foreground">
          {text}
        </div>
        {choiceQuestions.length > 0 && (
          <div className="space-y-3">
            {choiceQuestions.map((q) => (
              <div key={q.campo} className="flex flex-wrap gap-2">
                {q.opcoes.map((opt) => (
                  <button
                    key={`${q.campo}-${opt}`}
                    type="button"
                    className="rounded-full border border-black/10 px-3 py-1 text-xs"
                    onClick={() => onPick?.(q, opt)}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
