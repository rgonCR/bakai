type PromptBubbleProps = {
  text: string;
};

export function PromptBubble({ text }: PromptBubbleProps) {
  return (
    <div className="mb-8 flex justify-end">
      <div className="max-w-[85%] rounded-[20px] bg-ia-surface px-4 py-3 text-sm leading-relaxed text-ia-foreground">
        {text}
      </div>
    </div>
  );
}
