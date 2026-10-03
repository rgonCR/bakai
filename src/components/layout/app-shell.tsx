"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { Sidebar } from "./sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-ia-canvas">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((value) => !value)}
        activePath={pathname}
      />
      <main className="my-2 mr-2 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[20px] bg-white">
        {children}
      </main>
    </div>
  );
}
