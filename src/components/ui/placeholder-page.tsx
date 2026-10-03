import type { LucideIcon } from "lucide-react";

type PlaceholderPageProps = {
  title: string;
  description: string;
  icon: LucideIcon;
};

export function PlaceholderPage({
  title,
  description,
  icon: Icon,
}: PlaceholderPageProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-white px-8 text-center">
      <div className="mb-6 flex size-20 items-center justify-center rounded-full bg-ia-surface text-ia-primary">
        <Icon size={36} strokeWidth={1.5} />
      </div>
      <h1 className="text-3xl font-bold text-ia-foreground">{title}</h1>
      <p className="mt-3 max-w-md text-base text-ia-muted">{description}</p>
    </div>
  );
}
