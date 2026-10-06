"use client";

import { ArrowUpRight, Sparkles } from "lucide-react";
import { useCallback, useId, useLayoutEffect, useRef } from "react";

type ChatInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder?: string;
  variant?: "hero" | "chat";
};

/** leading-6 = 24px → 7 linhas */
const LINE_HEIGHT_PX = 24;
const MAX_LINES = 7;
const MAX_HEIGHT_PX = LINE_HEIGHT_PX * MAX_LINES;

function SubmitButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Enviar mensagem"
      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ia-primary text-white transition-opacity disabled:opacity-40"
    >
      <ArrowUpRight size={20} />
    </button>
  );
}

function CompactInput({
  value,
  onChange,
  onSubmit,
  disabled,
  placeholder,
  submitDisabled,
  textareaId,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  placeholder: string;
  submitDisabled: boolean;
  textareaId: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const syncTextareaHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;

    el.style.height = "auto";
    const next = Math.min(el.scrollHeight, MAX_HEIGHT_PX);
    el.style.height = `${Math.max(next, LINE_HEIGHT_PX)}px`;
    el.style.overflowY = el.scrollHeight > MAX_HEIGHT_PX ? "auto" : "hidden";
  }, []);

  useLayoutEffect(() => {
    syncTextareaHeight();
  }, [value, syncTextareaHeight]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (value.trim() && !disabled) onSubmit();
    }
  }

  return (
    <div className="flex w-full items-end gap-2 rounded-[28px] bg-ia-surface/70 px-3 py-2 ring-1 ring-ia-border/50">
      <Sparkles
        size={20}
        strokeWidth={1.75}
        className="mb-2 shrink-0 text-ia-foreground"
        aria-hidden
      />
      <textarea
        id={textareaId}
        ref={textareaRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        rows={1}
        placeholder={placeholder}
        className="max-h-[168px] min-h-6 w-full flex-1 resize-none bg-transparent py-1.5 text-sm leading-6 text-ia-foreground outline-none placeholder:text-ia-muted disabled:opacity-60"
      />
      <SubmitButton onClick={onSubmit} disabled={submitDisabled} />
    </div>
  );
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder = "Peça saldo, extrato, transferência…",
  variant = "hero",
}: ChatInputProps) {
  const textareaId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const submitDisabled = disabled || !value.trim();

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (value.trim() && !disabled) onSubmit();
    }
  }

  if (variant === "chat") {
    return (
      <CompactInput
        value={value}
        onChange={onChange}
        onSubmit={onSubmit}
        disabled={disabled}
        placeholder={placeholder}
        submitDisabled={submitDisabled}
        textareaId={textareaId}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-[720px]">
      <label htmlFor={textareaId} className="sr-only">
        Mensagem para o bank.ai
      </label>
      <div className="flex items-center gap-3 rounded-full border border-ia-border bg-white px-4 py-2">
        <span className="inline-flex shrink-0 items-center text-ia-primary">
          <Sparkles size={18} strokeWidth={1.75} />
        </span>
        <textarea
          id={textareaId}
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
          placeholder={placeholder}
          className="h-9 w-full flex-1 resize-none bg-transparent py-2 text-sm font-medium leading-5 text-ia-foreground outline-none placeholder:text-ia-foreground/75 disabled:opacity-60"
        />
        <SubmitButton onClick={onSubmit} disabled={submitDisabled} />
      </div>
    </div>
  );
}
