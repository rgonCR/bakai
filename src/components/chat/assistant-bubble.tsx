"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type AssistantBubbleProps = {
  text: string;
};

/** Só o texto — cards e chips vêm depois, na ordem correta. */
export function AssistantBubble({ text }: AssistantBubbleProps) {
  if (!text.trim()) return null;

  return (
    <div className="mb-3 flex justify-start">
      <div className="max-w-[85%]">
        <div className="chat-markdown text-sm leading-relaxed text-ia-foreground">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
