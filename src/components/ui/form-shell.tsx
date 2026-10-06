"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Loader2, Search, UserRound } from "lucide-react";
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

  const isClienteStep = form.stepId === "cliente";
  const clienteNovo = boolValues.cliente_modo === "novo";

  const fields = form.fields.filter((field) => {
    if (!isClienteStep) return true;
    if (field.id === "cliente_busca") return !clienteNovo;
    if (field.id === "cliente" || field.id === "cpf_cnpj") return clienteNovo;
    return true;
  });

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const values: Record<string, string> = {};
    for (const field of form.fields) {
      values[field.id] = String(data.get(field.id) ?? "");
    }
    // garante modo mesmo se hidden
    if (boolValues.cliente_modo) {
      values.cliente_modo = boolValues.cliente_modo;
    }
    for (const field of fields) {
      if (field.required && !values[field.id]?.trim()) {
        return;
      }
      if (
        field.type === "customer_search" &&
        field.required &&
        !values[field.id]?.includes("|")
      ) {
        return;
      }
    }
    onSubmit(values);
  }

  return (
    <FormShell
      title={form.title}
      subtitle={
        isClienteStep
          ? clienteNovo
            ? "Informe nome e CPF/CNPJ do novo cliente"
            : "Busque pelo nome — não precisa saber o CPF"
          : form.subtitle
      }
    >
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

type ClienteHit = {
  id: string;
  nome: string;
  cpf_cnpj: string;
  email: string;
  telefone: string;
};

function formatCpfCnpjDisplay(raw?: string) {
  if (!raw) return "";
  const d = raw.replace(/\D/g, "");
  if (d.length === 11) {
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  if (d.length === 14) {
    return d.replace(
      /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
      "$1.$2.$3/$4-$5",
    );
  }
  return raw;
}

function packCliente(c: ClienteHit) {
  return [c.nome, c.id, c.cpf_cnpj, c.email, c.telefone].join("|");
}

function unpackCliente(packed?: string): ClienteHit | null {
  if (!packed?.includes("|")) return null;
  const [nome, id, cpf_cnpj, email, telefone] = packed.split("|");
  if (!id?.trim()) return null;
  return {
    id: id.trim(),
    nome: nome?.trim() || id.trim(),
    cpf_cnpj: cpf_cnpj?.trim() || "",
    email: email?.trim() || "",
    telefone: telefone?.trim() || "",
  };
}

function CustomerSearchField({
  field,
  disabled,
}: {
  field: FormField;
  disabled?: boolean;
}) {
  const initial = unpackCliente(field.value);
  const [query, setQuery] = useState(initial?.nome ?? "");
  const [selected, setSelected] = useState<ClienteHit | null>(initial);
  const [hits, setHits] = useState<ClienteHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (disabled) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void (async () => {
        setLoading(true);
        setError(undefined);
        try {
          const res = await fetch(
            `/api/clientes/search?q=${encodeURIComponent(query.trim())}`,
          );
          const json = (await res.json()) as {
            clientes?: ClienteHit[];
            error?: string;
          };
          if (!res.ok) {
            setHits([]);
            setError(json.error || "Não consegui buscar clientes.");
            return;
          }
          setHits(json.clientes ?? []);
        } catch {
          setHits([]);
          setError("Falha ao buscar clientes.");
        } finally {
          setLoading(false);
        }
      })();
    }, 280);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, disabled]);

  return (
    <FormFieldBlock
      id={field.id}
      label={field.label}
      hint={field.hint}
      required={field.required}
    >
      <input
        type="hidden"
        name={field.id}
        value={selected ? packCliente(selected) : ""}
        required={field.required}
      />
      <div ref={wrapRef} className="relative">
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ia-muted"
          />
          <input
            id={field.id}
            type="search"
            autoComplete="off"
            value={query}
            placeholder={field.placeholder ?? "Buscar…"}
            disabled={disabled}
            className={`${formInputClass} pl-9`}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(null);
              setOpen(true);
            }}
          />
          {loading ? (
            <Loader2
              size={16}
              className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-ia-muted"
            />
          ) : null}
        </div>

        {selected ? (
          <p className="mt-2 flex items-center gap-2 text-xs text-ia-foreground">
            <UserRound size={14} className="text-ia-primary" />
            <span className="font-medium">{selected.nome}</span>
            {selected.cpf_cnpj ? (
              <span className="text-ia-muted">
                {formatCpfCnpjDisplay(selected.cpf_cnpj)}
              </span>
            ) : null}
          </p>
        ) : null}

        {open && !disabled ? (
          <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-ia-border bg-white py-1 shadow-lg">
            {error ? (
              <li className="px-3 py-2 text-sm text-red-600">{error}</li>
            ) : hits.length === 0 && !loading ? (
              <li className="px-3 py-2 text-sm text-ia-muted">
                {query.trim()
                  ? "Nenhum cliente encontrado. Tente outro trecho ou cadastre um novo."
                  : "Digite para buscar, ou veja os recentes abaixo."}
              </li>
            ) : (
              hits.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="flex w-full flex-col gap-0.5 px-3 py-2.5 text-left hover:bg-ia-surface"
                    onClick={() => {
                      setSelected(c);
                      setQuery(c.nome);
                      setOpen(false);
                    }}
                  >
                    <span className="text-sm font-medium text-ia-foreground">
                      {c.nome}
                    </span>
                    <span className="text-xs text-ia-muted">
                      {c.cpf_cnpj
                        ? formatCpfCnpjDisplay(c.cpf_cnpj)
                        : "Sem CPF/CNPJ"}
                      {c.email ? ` · ${c.email}` : ""}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        ) : null}
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
  if (field.type === "customer_search") {
    return <CustomerSearchField field={field} disabled={disabled} />;
  }

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
