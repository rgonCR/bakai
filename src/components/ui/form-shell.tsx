"use client";

import { useState, type ReactNode } from "react";
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
  required,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-sm font-semibold text-ia-foreground"
      >
        {label}
        {required === true ? (
          <span className="ml-1 text-ia-primary" aria-hidden>
            *
          </span>
        ) : null}
        {required === false ? (
          <span className="ml-1 text-xs font-normal text-ia-muted">
            opcional
          </span>
        ) : null}
      </label>
      {hint ? <p className="mb-2 text-xs text-ia-muted">{hint}</p> : null}
      {children}
    </div>
  );
}

export const formInputClass =
  "w-full rounded-xl border border-ia-border bg-white px-3.5 py-2.5 text-sm text-ia-foreground outline-none transition-colors placeholder:text-ia-muted/70 focus:border-ia-primary disabled:opacity-60";

/** Select com seta afastada da borda */
export const formSelectClass = `${formInputClass} appearance-none bg-[length:12px] bg-[right_14px_center] bg-no-repeat pr-11`;

const SELECT_CHEVRON = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="8" viewBox="0 0 12 8" fill="none"><path d="M1 1.5L6 6.5L11 1.5" stroke="%236B7280" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
)}")`;

export const formTextareaClass =
  "w-full min-h-[96px] resize-y rounded-xl border border-ia-border bg-white px-3.5 py-2.5 text-sm text-ia-foreground outline-none transition-colors placeholder:text-ia-muted/70 focus:border-ia-primary disabled:opacity-60";

/** Digita centavos: 25 → 0,25 · 2500 → 25,00 */
export function formatCentsInput(digits: string): string {
  const only = digits.replace(/\D/g, "").slice(0, 12);
  if (!only) return "";
  const cents = Number(only);
  if (!Number.isFinite(cents)) return "";
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function parseBrlToNumber(formatted: string): number | undefined {
  const raw = formatted.replace(/\./g, "").replace(",", ".");
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function digitsFromBrlDisplay(value?: string): string {
  if (!value?.trim()) return "";
  const n = parseBrlToNumber(value);
  if (n == null) return value.replace(/\D/g, "");
  return String(Math.round(n * 100));
}

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
  onSkip?: () => void;
  disabled?: boolean;
};

export function ChatFormBlock({
  form,
  onSubmit,
  onSkip,
  disabled,
}: ChatFormBlockProps) {
  const [boolValues, setBoolValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const field of form.fields) {
      if (field.type === "boolean") {
        init[field.id] =
          field.value || field.options?.[0]?.value || "existente";
      }
    }
    return init;
  });

  const fields = form.fields.map((field) => {
    if (
      field.id === "cpf_cnpj" &&
      boolValues.cliente_modo != null
    ) {
      const novo = boolValues.cliente_modo === "novo";
      return {
        ...field,
        required: novo,
        hint: novo
          ? "Obrigatório para cadastrar o cliente"
          : "Opcional — ajuda a achar o cadastro",
      };
    }
    return field;
  });

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const values: Record<string, string> = {};
    for (const field of fields) {
      values[field.id] = String(data.get(field.id) ?? "");
      if (field.required && !values[field.id]?.trim()) {
        return;
      }
    }
    onSubmit(values);
  }

  return (
    <FormShell title={form.title} subtitle={form.subtitle}>
      <form
        onSubmit={handleSubmit}
        className={`space-y-4 ${disabled ? "opacity-70" : ""}`}
      >
        {fields.map((field) => (
          <FieldInput
            key={field.id}
            field={field}
            disabled={disabled}
            boolValue={boolValues[field.id]}
            onBoolChange={(value) =>
              setBoolValues((prev) => ({ ...prev, [field.id]: value }))
            }
          />
        ))}
        <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
          {disabled ? (
            <p className="text-xs font-medium text-ia-muted">Já registrado</p>
          ) : (
            <>
              {form.optionalSkip ? (
                <button
                  type="button"
                  className="cursor-pointer rounded-xl border border-ia-border bg-white px-4 py-2.5 text-sm font-medium text-ia-muted"
                  onClick={() => onSkip?.()}
                >
                  {form.skipLabel || "Pular"}
                </button>
              ) : null}
              <button
                type="submit"
                className="cursor-pointer rounded-xl bg-ia-primary px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                {form.submitLabel}
              </button>
            </>
          )}
        </div>
      </form>
    </FormShell>
  );
}

function MoneyField({
  field,
  disabled,
}: {
  field: FormField;
  disabled?: boolean;
}) {
  const [display, setDisplay] = useState(() =>
    field.value ? formatCentsInput(digitsFromBrlDisplay(field.value)) : "",
  );

  return (
    <FormFieldBlock
      id={field.id}
      label={field.label}
      hint={field.hint}
      required={field.required}
    >
      <input
        id={field.id}
        name={field.id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={display}
        placeholder={field.placeholder ?? "0,00"}
        disabled={disabled}
        required={field.required}
        className={formInputClass}
        onChange={(e) => {
          setDisplay(formatCentsInput(e.target.value));
        }}
      />
    </FormFieldBlock>
  );
}

function BooleanToggleField({
  field,
  disabled,
  value,
  onChange,
}: {
  field: FormField;
  disabled?: boolean;
  value: string;
  onChange: (value: string) => void;
}) {
  const options = field.options ?? [];
  return (
    <FormFieldBlock
      id={field.id}
      label={field.label}
      hint={field.hint}
      required={field.required}
    >
      <input type="hidden" name={field.id} value={value} />
      <div className="grid grid-cols-2 gap-2">
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(opt.value)}
              className={`cursor-pointer rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors disabled:opacity-60 ${
                active
                  ? "border-ia-primary bg-ia-primary/10 text-ia-primary"
                  : "border-ia-border bg-white text-ia-muted hover:border-ia-primary/40"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </FormFieldBlock>
  );
}

function FieldInput({
  field,
  disabled,
  boolValue,
  onBoolChange,
}: {
  field: FormField;
  disabled?: boolean;
  boolValue?: string;
  onBoolChange?: (value: string) => void;
}) {
  if (field.type === "boolean") {
    return (
      <BooleanToggleField
        field={field}
        disabled={disabled}
        value={boolValue || field.value || field.options?.[0]?.value || ""}
        onChange={(v) => onBoolChange?.(v)}
      />
    );
  }

  if (field.type === "textarea") {
    return (
      <FormFieldBlock
        id={field.id}
        label={field.label}
        hint={field.hint}
        required={field.required}
      >
        <textarea
          id={field.id}
          name={field.id}
          defaultValue={field.value}
          placeholder={field.placeholder}
          disabled={disabled}
          required={field.required}
          className={formTextareaClass}
        />
      </FormFieldBlock>
    );
  }

  if (field.type === "select") {
    return (
      <FormFieldBlock
        id={field.id}
        label={field.label}
        hint={field.hint}
        required={field.required}
      >
        <select
          id={field.id}
          name={field.id}
          defaultValue={field.value}
          disabled={disabled}
          required={field.required}
          className={formSelectClass}
          style={{ backgroundImage: SELECT_CHEVRON }}
        >
          {(field.options ?? []).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </FormFieldBlock>
    );
  }

  if (field.type === "number") {
    return <MoneyField field={field} disabled={disabled} />;
  }

  const inputType =
    field.type === "date"
      ? "date"
      : field.type === "tel"
        ? "tel"
        : field.type === "email"
          ? "email"
          : "text";

  return (
    <FormFieldBlock
      id={field.id}
      label={field.label}
      hint={field.hint}
      required={field.required}
    >
      <input
        id={field.id}
        name={field.id}
        type={inputType}
        defaultValue={field.value}
        placeholder={field.placeholder}
        disabled={disabled}
        required={field.required}
        className={formInputClass}
      />
    </FormFieldBlock>
  );
}
