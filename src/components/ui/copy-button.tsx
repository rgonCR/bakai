"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

type CopyButtonProps = {
  text: string;
  label?: string;
};

function useCopyToClipboard(text: string) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return { copied, copy };
}

export function CopyButton({ text, label = "Copiar" }: CopyButtonProps) {
  const { copied, copy } = useCopyToClipboard(text);

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-ia-border bg-white px-4 py-2 text-sm font-semibold text-ia-foreground transition-colors hover:bg-ia-surface"
    >
      {copied ? <Check size={16} /> : <Copy size={16} />}
      {copied ? "Copiado" : label}
    </button>
  );
}

type CopyIconButtonProps = {
  text: string;
  title?: string;
};

export function CopyIconButton({ text, title = "Copiar" }: CopyIconButtonProps) {
  const { copied, copy } = useCopyToClipboard(text);

  return (
    <button
      type="button"
      onClick={copy}
      title={copied ? "Copiado" : title}
      aria-label={copied ? "Copiado" : title}
      className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-ia-muted transition-colors hover:bg-white hover:text-ia-primary"
    >
      {copied ? <Check size={14} strokeWidth={2} /> : <Copy size={14} strokeWidth={2} />}
    </button>
  );
}
