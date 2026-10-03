import { CopyIconButton } from "@/components/ui/copy-button";
import type { ReportBlock } from "@/lib/chat/types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type ReportPanelProps = {
  report: ReportBlock;
  className?: string;
};

function MetaField({
  label,
  value,
  copyable = true,
}: {
  label: string;
  value: string;
  copyable?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-2 py-4 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <dt className="text-xs font-semibold uppercase tracking-wide text-ia-primary">
          {label}
        </dt>
        <dd className="mt-1 break-words text-sm leading-relaxed text-ia-foreground">
          {value}
        </dd>
      </div>
      {copyable && <CopyIconButton text={value} title={`Copiar ${label.toLowerCase()}`} />}
    </div>
  );
}

export function ReportPanel({ report, className }: ReportPanelProps) {
  return (
    <section
      className={`mb-6 rounded-xl border border-ia-border bg-ia-surface/60 p-4 sm:p-5 ${className ?? ""}`}
      aria-label={report.title}
    >
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-ia-muted">
        {report.title}
      </h2>
      <dl className="divide-y divide-ia-border">
        {report.fields.map((field) => (
          <MetaField
            key={field.label}
            label={field.label}
            value={field.value}
            copyable={field.copyable !== false}
          />
        ))}
      </dl>
      {report.bodyMarkdown ? (
        <div className="markdown-article mt-5 border-t border-ia-border pt-4">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {report.bodyMarkdown}
          </ReactMarkdown>
        </div>
      ) : null}
    </section>
  );
}
