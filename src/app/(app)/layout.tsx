import { AppShell } from "@/components/layout/app-shell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <div className="h-full min-h-0">{children}</div>
    </AppShell>
  );
}
