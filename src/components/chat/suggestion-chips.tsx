"use client";

type SuggestionChipsProps = {
  options: string[];
  onPick: (option: string) => void;
  disabled?: boolean;
  /** Texto acima dos botões (ex.: pós-fluxo) */
  prompt?: string;
};

export function SuggestionChips({
  options,
  onPick,
  disabled,
  prompt,
}: SuggestionChipsProps) {
  if (options.length === 0) return null;

  return (
    <div className="space-y-2.5">
      {prompt ? (
        <p className="text-sm font-medium text-ia-foreground">{prompt}</p>
      ) : null}
      <div className="flex flex-wrap gap-2.5">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            disabled={disabled}
            onClick={() => onPick(opt)}
            className="ia-chip inline-flex cursor-pointer items-center justify-center rounded-full px-5 py-2 text-sm font-medium text-ia-primary transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
