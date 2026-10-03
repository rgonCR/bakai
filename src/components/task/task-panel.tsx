"use client";

import { useEffect, useState } from "react";
import { asaasBillingTypeLabel } from "@/lib/asaas/status";
import type { CobrancaDraft } from "@/lib/chat/cobranca-draft";
import { useTaskDraft } from "@/components/layout/task-draft";
import type { AsaasBillingType } from "@/lib/asaas/payments";

function brl(value?: number) {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDateBr(ymd?: string) {
  if (!ymd) return "—";
  const [y, m, d] = ymd.split("-");
  if (!y || !m || !d) return ymd;
  return `${d}/${m}/${y}`;
}

function formatCpfCnpj(raw?: string) {
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

function Pill({ draft }: { draft: CobrancaDraft }) {
  const tone =
    draft.status === "done"
      ? "bg-emerald-50 text-emerald-800"
      : draft.status === "failed"
        ? "bg-red-50 text-red-700"
        : draft.status === "pending_confirm" || draft.status === "ready"
          ? "bg-amber-50 text-amber-900"
          : "bg-white/80 text-ia-muted";
  const label =
    draft.status === "draft"
      ? "Montando"
      : draft.status === "ready"
        ? "Quase pronto"
        : draft.status === "pending_confirm"
          ? "Aguardando confirmação"
          : draft.status === "executing"
            ? "Criando…"
            : draft.status === "done"
              ? "Criada"
              : draft.status === "failed"
                ? "Falhou"
                : "Montando";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}
    >
      {label}
    </span>
  );
}

function EditableRow({
  label,
  display,
  editing,
  onStartEdit,
  disabled,
  children,
}: {
  label: string;
  display: string;
  editing: boolean;
  onStartEdit: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-ia-border/60 py-3 last:border-b-0">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-ia-primary">
            {label}
          </p>
          {editing ? (
            <div className="mt-1.5">{children}</div>
          ) : (
            <p className="mt-1 break-words text-sm text-ia-foreground">
              {display}
            </p>
          )}
        </div>
        {!disabled && !editing ? (
          <button
            type="button"
            className="cursor-pointer shrink-0 text-xs font-medium text-ia-muted hover:text-ia-primary"
            onClick={onStartEdit}
            aria-label={`Editar ${label}`}
          >
            ✎
          </button>
        ) : null}
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-ia-border bg-white px-2.5 py-1.5 text-sm outline-none focus:border-ia-primary";

const selectClass = `${inputClass} appearance-none bg-[length:12px] bg-[right_12px_center] bg-no-repeat pr-9`;

const SELECT_CHEVRON = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="8" viewBox="0 0 12 8" fill="none"><path d="M1 1.5L6 6.5L11 1.5" stroke="%236B7280" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
)}")`;

/** Painel = só resumo. Confirmação fica no chat. */
export function TaskPanel() {
  const { draft, missing, patchDraft, setPanelOpen } = useTaskDraft();
  const [editing, setEditing] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPanelOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setPanelOpen]);

  if (!draft || !draft.panelOpen) return null;
  const current = draft;
  const locked =
    current.status === "executing" || current.status === "done";

  return (
    <aside className="flex h-full w-full flex-col border-l border-ia-border bg-[#F4F7FB]">
      <header className="flex items-start justify-between gap-3 border-b border-ia-border/80 px-4 py-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ia-muted">
            Resumo
          </p>
          <h2 className="mt-1 text-base font-semibold text-ia-foreground">
            Nova cobrança
          </h2>
          <div className="mt-2">
            <Pill draft={current} />
          </div>
        </div>
        <button
          type="button"
          className="cursor-pointer rounded-lg px-2 py-1 text-sm text-ia-muted hover:bg-white/80"
          onClick={() => setPanelOpen(false)}
          aria-label="Recolher resumo"
          title="Recolher (não cancela)"
        >
          ✕
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
        <p className="mb-2 text-xs text-ia-muted">
          Acompanhe o que está sendo montado. Confirmação acontece no chat.
        </p>

        <EditableRow
          label="Cliente"
          display={current.cliente?.trim() || "—"}
          editing={editing === "cliente"}
          onStartEdit={() => setEditing("cliente")}
          disabled={locked}
        >
          <input
            className={inputClass}
            defaultValue={current.cliente ?? ""}
            autoFocus
            onBlur={(e) => {
              patchDraft({ cliente: e.target.value.trim() || undefined });
              setEditing(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
        </EditableRow>

        <EditableRow
          label="CPF/CNPJ"
          display={formatCpfCnpj(current.cpf_cnpj) || "—"}
          editing={editing === "cpf"}
          onStartEdit={() => setEditing("cpf")}
          disabled={locked}
        >
          <input
            className={inputClass}
            defaultValue={current.cpf_cnpj ?? ""}
            autoFocus
            onBlur={(e) => {
              patchDraft({
                cpf_cnpj: e.target.value.replace(/\D/g, "") || undefined,
              });
              setEditing(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
        </EditableRow>

        <EditableRow
          label="Valor"
          display={brl(current.valor)}
          editing={editing === "valor"}
          onStartEdit={() => setEditing("valor")}
          disabled={locked}
        >
          <input
            className={inputClass}
            inputMode="decimal"
            defaultValue={current.valor != null ? String(current.valor) : ""}
            autoFocus
            onBlur={(e) => {
              const raw = e.target.value.replace(/\./g, "").replace(",", ".");
              const n = Number(raw);
              patchDraft({
                valor: Number.isFinite(n) && n > 0 ? n : undefined,
              });
              setEditing(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
        </EditableRow>

        <EditableRow
          label="Vencimento"
          display={formatDateBr(current.vencimento)}
          editing={editing === "vencimento"}
          onStartEdit={() => setEditing("vencimento")}
          disabled={locked}
        >
          <input
            type="date"
            className={inputClass}
            defaultValue={current.vencimento ?? ""}
            autoFocus
            onBlur={(e) => {
              patchDraft({ vencimento: e.target.value || undefined });
              setEditing(null);
            }}
          />
        </EditableRow>

        <EditableRow
          label="Forma"
          display={asaasBillingTypeLabel(current.forma)}
          editing={editing === "forma"}
          onStartEdit={() => setEditing("forma")}
          disabled={locked}
        >
          <select
            className={selectClass}
            style={{ backgroundImage: SELECT_CHEVRON }}
            defaultValue={current.forma}
            autoFocus
            onChange={(e) => {
              patchDraft({ forma: e.target.value as AsaasBillingType });
              setEditing(null);
            }}
            onBlur={() => setEditing(null)}
          >
            <option value="UNDEFINED">Cliente escolhe</option>
            <option value="PIX">Pix</option>
            <option value="BOLETO">Boleto</option>
            <option value="CREDIT_CARD">Cartão de crédito</option>
          </select>
        </EditableRow>

        <EditableRow
          label="E-mail"
          display={current.email || "—"}
          editing={editing === "email"}
          onStartEdit={() => setEditing("email")}
          disabled={locked}
        >
          <input
            type="email"
            className={inputClass}
            defaultValue={current.email ?? ""}
            autoFocus
            onBlur={(e) => {
              patchDraft({ email: e.target.value.trim() || undefined });
              setEditing(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
        </EditableRow>

        <EditableRow
          label="WhatsApp"
          display={current.telefone || "—"}
          editing={editing === "telefone"}
          onStartEdit={() => setEditing("telefone")}
          disabled={locked}
        >
          <input
            type="tel"
            className={inputClass}
            defaultValue={current.telefone ?? ""}
            autoFocus
            onBlur={(e) => {
              patchDraft({
                telefone: e.target.value.replace(/\D/g, "") || undefined,
              });
              setEditing(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
        </EditableRow>

        <EditableRow
          label="Descrição"
          display={current.descricao || "—"}
          editing={editing === "descricao"}
          onStartEdit={() => setEditing("descricao")}
          disabled={locked}
        >
          <textarea
            className={`${inputClass} min-h-[72px]`}
            defaultValue={current.descricao ?? ""}
            autoFocus
            onBlur={(e) => {
              patchDraft({ descricao: e.target.value.trim() || undefined });
              setEditing(null);
            }}
          />
        </EditableRow>

        {missing.length > 0 ? (
          <p className="mt-3 text-xs text-amber-800">
            Falta: {missing.join(", ")}
          </p>
        ) : (
          <p className="mt-3 text-xs text-ia-muted">
            Confirme a cobrança no chat quando o bloco aparecer.
          </p>
        )}
      </div>
    </aside>
  );
}

export function TaskPanelHost() {
  const { draft, panelVisible, setPanelOpen } = useTaskDraft();

  if (!draft || !panelVisible) return null;

  return (
    <>
      <div className="hidden h-full w-[360px] shrink-0 xl:block">
        <TaskPanel />
      </div>
      <div className="xl:hidden">
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/30"
          aria-label="Recolher resumo"
          onClick={() => setPanelOpen(false)}
        />
        <div className="fixed inset-y-0 right-0 z-50 w-[min(100%,380px)] shadow-xl">
          <TaskPanel />
        </div>
      </div>
    </>
  );
}
