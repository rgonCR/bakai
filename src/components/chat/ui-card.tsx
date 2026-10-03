import type { UICard } from "@/lib/agent/types";
import { CopyIconButton } from "@/components/ui/copy-button";

function brl(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function CardShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6 rounded-xl border border-ia-border bg-ia-surface/60 p-4 sm:p-5">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-ia-muted">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
  copyable,
}: {
  label: string;
  value: string;
  copyable?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-2 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <dt className="text-xs font-semibold uppercase tracking-wide text-ia-primary">
          {label}
        </dt>
        <dd className="mt-1 break-words text-sm text-ia-foreground">{value}</dd>
      </div>
      {copyable ? <CopyIconButton text={value} title={`Copiar ${label}`} /> : null}
    </div>
  );
}

export type ConfirmMeta = {
  cta: string;
  titulo: string;
};

export function UiCardView({
  card,
  onChip,
  onConfirm,
  onCancel,
  onChoice,
  onBatchAction,
  busy,
  resolved,
}: {
  card: UICard;
  onChip?: (option: string) => void;
  onConfirm?: (pendingActionId: string, meta: ConfirmMeta) => void;
  onCancel?: (pendingActionId: string, meta: ConfirmMeta) => void;
  onChoice?: (id: string, label: string) => void;
  onBatchAction?: (tool: string, ids: string[]) => void;
  busy?: boolean;
  /** pending já confirmada/cancelada nesta sessão */
  resolved?: boolean;
}) {
  if (card.type === "saldo") {
    return (
      <section className="mb-4 rounded-xl border border-ia-border bg-ia-surface/60 px-4 py-4 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-ia-primary">
              Saldo disponível
            </p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-ia-foreground tabular-nums">
              {card.props.formatado}
            </p>
            <p className="mt-2 text-xs text-ia-muted">Atualizado agora</p>
          </div>
          <CopyIconButton
            text={card.props.formatado}
            title="Copiar saldo"
          />
        </div>
      </section>
    );
  }

  if (card.type === "dados_conta") {
    return (
      <CardShell title="Dados da conta">
        <dl className="divide-y divide-ia-border">
          <Field label="Banco" value={card.props.banco} copyable />
          <Field label="Agência" value={card.props.agencia} copyable />
          <Field label="Conta" value={card.props.conta} copyable />
          {card.props.titular ? (
            <Field label="Titular" value={card.props.titular} />
          ) : null}
        </dl>
      </CardShell>
    );
  }

  if (card.type === "extrato") {
    return (
      <CardShell title="Extrato">
        <dl className="mb-4 divide-y divide-ia-border">
          <Field label="Período" value={card.props.periodo} />
          <Field label="Entradas" value={brl(card.props.entradas)} copyable />
          <Field label="Saídas" value={brl(card.props.saidas)} copyable />
        </dl>
        {card.props.itens.length > 0 ? (
          <ul className="space-y-2 text-sm text-ia-foreground">
            {card.props.itens.map((item, i) => (
              <li
                key={`${item.data}-${i}`}
                className="flex justify-between gap-3 border-t border-ia-border/60 pt-2"
              >
                <span className="min-w-0">
                  <span className="text-ia-muted">{item.data}</span>
                  {" · "}
                  {item.descricao}
                </span>
                <span className="shrink-0 font-medium">{brl(item.valor)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ia-muted">Nenhum lançamento no período.</p>
        )}
      </CardShell>
    );
  }

  // chips / task_draft: painel e chips cuidam disso
  if (card.type === "chips" || card.type === "task_draft") return null;

  if (card.type === "confirmacao") {
    const meta: ConfirmMeta = {
      cta: card.props.cta,
      titulo: card.props.titulo,
    };
    return (
      <CardShell title={card.props.titulo}>
        <dl className="mb-4 divide-y divide-ia-border">
          {card.props.linhas.map((linha) => (
            <Field key={linha.label} label={linha.label} value={linha.valor} />
          ))}
        </dl>
        {resolved ? (
          <p className="text-sm text-ia-muted">Ação já tratada nesta conversa.</p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy}
              className="cursor-pointer rounded-xl bg-ia-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              onClick={() =>
                onConfirm?.(card.props.pending_action_id, meta)
              }
            >
              {busy ? "Confirmando…" : card.props.cta}
            </button>
            <button
              type="button"
              disabled={busy}
              className="cursor-pointer rounded-xl border border-ia-border bg-white px-4 py-2.5 text-sm font-medium text-ia-muted disabled:opacity-50"
              onClick={() =>
                onCancel?.(card.props.pending_action_id, meta)
              }
            >
              Cancelar
            </button>
          </div>
        )}
      </CardShell>
    );
  }

  if (card.type === "escolha") {
    return (
      <CardShell title={card.props.pergunta}>
        {resolved ? (
          <p className="text-sm text-ia-muted">Escolha já registrada.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {card.props.opcoes.map((op) => (
              <button
                key={op.id}
                type="button"
                disabled={busy}
                className="cursor-pointer rounded-xl border border-ia-border bg-white px-4 py-3 text-left text-sm transition-colors hover:bg-ia-surface disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => onChoice?.(op.id, op.label)}
              >
                <span className="font-medium text-ia-foreground">{op.label}</span>
                {op.sub ? (
                  <span className="mt-0.5 block text-xs text-ia-muted">
                    {op.sub}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        )}
      </CardShell>
    );
  }

  if (card.type === "sucesso") {
    return (
      <CardShell title={card.props.titulo}>
        <dl className="divide-y divide-ia-border">
          {card.props.linhas.map((linha) => {
            const label = linha.label.toLowerCase();
            const copyable =
              label.includes("link") ||
              label.includes("pix") ||
              label.includes("id");
            return (
              <Field
                key={linha.label}
                label={linha.label}
                value={linha.valor}
                copyable={copyable}
              />
            );
          })}
        </dl>
        {card.props.link ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <a
              href={card.props.link}
              target="_blank"
              rel="noreferrer"
              className="cursor-pointer rounded-xl bg-ia-primary px-4 py-2.5 text-sm font-semibold text-white"
            >
              Abrir link da cobrança
            </a>
            <CopyIconButton text={card.props.link} title="Copiar link" />
          </div>
        ) : null}
      </CardShell>
    );
  }

  if (card.type === "status_conta") {
    const labels = {
      dados: "Dados enviados",
      documentos: "Documentos",
      analise: "Em análise",
      aprovada: "Aprovada",
      recusada: "Recusada",
    } as const;
    return (
      <CardShell title="Situação da conta">
        <p className="mb-3 text-sm font-medium text-ia-foreground">
          Etapa: {labels[card.props.etapa]}
        </p>
        {card.props.pendencias.length > 0 ? (
          <ul className="mb-3 list-disc space-y-1 pl-5 text-sm text-ia-muted">
            {card.props.pendencias.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        ) : null}
        <p className="mb-3 text-xs text-ia-muted">
          Conta de pagamento fornecida por Asaas
        </p>
        {card.props.link_documentos ? (
          <a
            href={card.props.link_documentos}
            target="_blank"
            rel="noreferrer"
            className="inline-flex rounded-xl bg-ia-primary px-4 py-2.5 text-sm font-semibold text-white"
          >
            Enviar documentos
          </a>
        ) : null}
      </CardShell>
    );
  }

  if (card.type === "lista_cobrancas") {
    return (
      <CardShell title="Cobranças">
        <dl className="mb-4 divide-y divide-ia-border">
          <Field label="Filtro" value={card.props.status} />
          <Field label="Total" value={String(card.props.total)} />
          <Field label="Soma" value={brl(card.props.soma)} copyable />
        </dl>
        {card.props.itens.length > 0 ? (
          <ul className="space-y-3">
            {card.props.itens.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border border-ia-border/80 px-3 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ia-foreground">
                      {item.cliente}
                    </p>
                    <p className="mt-0.5 text-xs text-ia-muted">
                      {item.status} · vence {item.vencimento}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold tabular-nums text-ia-foreground">
                    {brl(item.valor)}
                  </p>
                </div>
                {item.link ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-medium text-ia-primary hover:underline"
                    >
                      Abrir link
                    </a>
                    <CopyIconButton text={item.link} title="Copiar link" />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ia-muted">Nenhuma cobrança encontrada.</p>
        )}
        {card.props.acao_lote && card.props.itens.length > 0 ? (
          <button
            type="button"
            disabled={busy}
            className="mt-4 w-full cursor-pointer rounded-xl bg-ia-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto"
            onClick={() =>
              onBatchAction?.(
                card.props.acao_lote!.tool,
                card.props.itens.map((i) => i.id),
              )
            }
          >
            {card.props.acao_lote.label}
          </button>
        ) : null}
      </CardShell>
    );
  }

  if (card.type === "relatorio") {
    const series = card.props.series[0];
    const maxY = Math.max(
      1,
      ...(series?.y.map((v) => Math.abs(v)) ?? [1]),
    );
    return (
      <CardShell title={card.props.resumo || "Relatório"}>
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {card.props.kpis.map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-xl border border-ia-border/80 px-3 py-2.5"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ia-muted">
                {kpi.label}
              </p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-ia-foreground">
                {brl(kpi.valor)}
              </p>
            </div>
          ))}
        </div>
        {series && series.y.length > 0 ? (
          <div className="mb-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ia-muted">
              {series.nome}
            </p>
            <div className="flex h-28 items-end gap-0.5 rounded-xl border border-ia-border/60 bg-ia-surface/40 px-2 py-2 sm:gap-1">
              {series.y.map((v, i) => {
                // altura em px (h-28 ≈ 112; padding → ~96 úteis) — % no flex some
                const barH =
                  v === 0 ? 0 : Math.max(6, Math.round((Math.abs(v) / maxY) * 96));
                return (
                  <div
                    key={`${series.x[i]}-${i}`}
                    className="flex h-full min-w-0 flex-1 flex-col items-center justify-end"
                    title={`${series.x[i]}: ${brl(v)}`}
                  >
                    <div
                      className={`w-full max-w-[14px] rounded-t-sm ${
                        v > 0
                          ? "bg-ia-primary"
                          : v < 0
                            ? "bg-red-400"
                            : "bg-transparent"
                      }`}
                      style={{ height: `${barH}px` }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
        {card.props.destaques.length > 0 ? (
          <ul className="space-y-1.5 text-sm text-ia-foreground">
            {card.props.destaques.map((d) => (
              <li key={d} className="flex gap-2">
                <span className="text-ia-primary">•</span>
                <span>{d}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </CardShell>
    );
  }

  // cobranca_detalhe — stub
  return (
    <CardShell title={card.type}>
      <pre className="overflow-x-auto text-xs text-ia-muted">
        {JSON.stringify(card.props, null, 2)}
      </pre>
    </CardShell>
  );
}
