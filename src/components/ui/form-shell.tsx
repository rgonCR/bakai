"use client";

import type { ReactNode } from "react";
import type { FormBlock, FormField } from "@/lib/chat/types";

export function FormShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-6 rounded-xl border border-ia-border bg-white p-5 shadow-sm">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-ia-foreground">{title}</h2>
        {subtitle ? (
          <p className="mt-1 text-sm text-ia-muted">{subtitle}</p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function FormFieldBlock({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-sm font-semibold text-ia-foreground"
      >
        {label}
      </label>
      {hint ? <p className="mb-2 text-xs text-ia-muted">{hint}</p> : null}
      {children}
    </div>
  );
}

export const formInputClass =
  "w-full rounded-xl border border-ia-border bg-white px-3.5 py-2.5 text-sm text-ia-foreground outline-none transition-colors placeholder:text-ia-muted/70 focus:border-ia-primary disabled:opacity-60";

export const formTextareaClass =
  "w-full min-h-[96px] resize-y rounded-xl border border-ia-border bg-white px-3.5 py-2.5 text-sm text-ia-foreground outline-none transition-colors placeholder:text-ia-muted/70 focus:border-ia-primary disabled:opacity-60";

export function FormTip({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-ia-border bg-ia-surface px-4 py-3 text-sm text-ia-muted">
      {children}
    </div>
  );
}

export function FormError({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
      {message}
    </div>
  );
}

export function FormSuccess({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800">
      {message}
    </div>
  );
}

type ChatFormBlockProps = {
  form: FormBlock;
  onSubmit: (values: Record<string, string>) => void;
  disabled?: boolean;
};

export function ChatFormBlock({
  form,
  onSubmit,
  disabled,
}: ChatFormBlockProps) {
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const values: Record<string, string> = {};
    for (const field of form.fields) {
      values[field.id] = String(data.get(field.id) ?? "");
    }
    onSubmit(values);
  }

  return (
    <FormShell title={form.title} subtitle={form.subtitle}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {form.fields.map((field) => (
          <FieldInput key={field.id} field={field} disabled={disabled} />
        ))}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={disabled}
            className="rounded-xl bg-ia-primary px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {form.submitLabel}
          </button>
        </div>
      </form>
    </FormShell>
  );
}

function FieldInput({
  field,
  disabled,
}: {
  field: FormField;
  disabled?: boolean;
}) {
  if (field.type === "textarea") {
    return (
      <FormFieldBlock id={field.id} label={field.label} hint={field.hint}>
        <textarea
          id={field.id}
          name={field.id}
          defaultValue={field.value}
          placeholder={field.placeholder}
          disabled={disabled}
          className={formTextareaClass}
        />
      </FormFieldBlock>
    );
  }

  return (
    <FormFieldBlock id={field.id} label={field.label} hint={field.hint}>
      <input
        id={field.id}
        name={field.id}
        type={field.type === "number" ? "text" : field.type || "text"}
        inputMode={field.type === "number" ? "decimal" : undefined}
        defaultValue={field.value}
        placeholder={field.placeholder}
        disabled={disabled}
        className={formInputClass}
      />
    </FormFieldBlock>
  );
}
