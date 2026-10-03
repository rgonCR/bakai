"use client";

type ComingSoonProps = {
  open: boolean;
  title: string;
  description: string;
  onClose: () => void;
};

export function ComingSoonModal({
  open,
  title,
  description,
  onClose,
}: ComingSoonProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4"
      role="dialog"
      aria-modal
      aria-labelledby="coming-soon-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-none"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ia-muted">
          Em breve
        </p>
        <h2
          id="coming-soon-title"
          className="text-lg font-semibold text-ia-foreground"
        >
          {title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ia-muted">
          {description}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-xl bg-ia-primary px-4 py-2.5 text-sm font-semibold text-white"
        >
          Entendi
        </button>
      </div>
    </div>
  );
}
