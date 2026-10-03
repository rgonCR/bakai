"use client";

import { useEffect, useState } from "react";
import { stripStatusEllipsis } from "@/lib/strip-status-ellipsis";
import { GradientSpinner } from "./gradient-spinner";

type GenerationStatusProps = {
  label: string;
  status: "thinking" | "error";
  detail?: string;
};

function ThinkingDots() {
  const [dots, setDots] = useState("");

  useEffect(() => {
    const frames = ["", ".", "..", "..."];
    let index = 0;
    const interval = window.setInterval(() => {
      index = (index + 1) % frames.length;
      setDots(frames[index] ?? "");
    }, 420);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <span className="inline-block w-[1.25em] text-left" aria-hidden>
      {dots}
    </span>
  );
}

export function GenerationStatus({
  label,
  status,
  detail,
}: GenerationStatusProps) {
  if (status === "error") {
    return (
      <div className="mb-8">
        <p className="text-sm font-medium text-ia-foreground">{label}</p>
        {detail && detail !== label && (
          <p className="mt-2 text-sm leading-relaxed text-ia-muted">{detail}</p>
        )}
      </div>
    );
  }

  const cleanLabel = stripStatusEllipsis(label);

  return (
    <div className="mb-8 flex items-center gap-2 text-sm text-ia-muted">
      <GradientSpinner />
      <p className="leading-relaxed">
        {cleanLabel}
        <ThinkingDots />
      </p>
    </div>
  );
}
