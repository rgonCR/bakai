"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AccountSummaryProvider } from "./account-summary";
import { ConversationHistoryProvider } from "./conversation-history";
import { TaskDraftProvider } from "./task-draft";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

function AppShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [collapsed, setCollapsed] = useState(false);
  const activeConversationId = searchParams.get("c");

  return (
    <div className="flex h-screen overflow-hidden bg-ia-canvas">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((value) => !value)}
        activePath={pathname}
        activeConversationId={activeConversationId}
      />
      <main className="my-2 mr-2 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[20px] bg-white">
        <Topbar />
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      </main>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AccountSummaryProvider>
      <ConversationHistoryProvider>
        <TaskDraftProvider>
          <Suspense
            fallback={
              <div className="flex h-screen overflow-hidden bg-ia-canvas">
                <div className="w-[264px]" />
                <main className="my-2 mr-2 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[20px] bg-white" />
              </div>
            }
          >
            <AppShellInner>{children}</AppShellInner>
          </Suspense>
        </TaskDraftProvider>
      </ConversationHistoryProvider>
    </AccountSummaryProvider>
  );
}
