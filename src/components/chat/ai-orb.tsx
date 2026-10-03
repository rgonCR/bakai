"use client";

import { useEffect, useRef } from "react";
import { PLASMA_SPHERE_CONFIG } from "./plasma-sphere-config";

type AiOrbProps = {
  size?: number;
  className?: string;
};

export function AiOrb({ size = 190, className = "" }: AiOrbProps) {
  const glowRef = useRef<HTMLDivElement>(null);
  const coreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const glowContainer = glowRef.current;
    const coreContainer = coreRef.current;
    if (!glowContainer || !coreContainer) return;

    let disposed = false;
    let cleanup: (() => void) | undefined;

    const glowPadding = Math.round(size * PLASMA_SPHERE_CONFIG.glowPaddingRatio);
    const canvasSize = size + glowPadding * 2;

    void import("./plasma-sphere").then(({ createPlasmaSphere }) => {
      if (disposed) return;

      const glowScene = createPlasmaSphere(glowContainer, size, {
        canvasSize,
        orbSize: size,
        glowLayer: true,
      });
      const coreScene = createPlasmaSphere(coreContainer, size, {
        canvasSize: size,
        orbSize: size,
      });

      cleanup = () => {
        glowScene.dispose();
        coreScene.dispose();
      };
    });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [size]);

  const glowPadding = Math.round(size * PLASMA_SPHERE_CONFIG.glowPaddingRatio);
  const glowCanvasSize = size + glowPadding * 2;
  const blurAmount = Math.round(size * PLASMA_SPHERE_CONFIG.glowBlurRatio);

  return (
    <div
      className={`relative shrink-0 overflow-visible ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <div
        ref={glowRef}
        className="pointer-events-none absolute"
        style={{
          width: glowCanvasSize,
          height: glowCanvasSize,
          left: -glowPadding,
          top: -glowPadding,
          filter: `blur(${blurAmount}px)`,
          opacity: PLASMA_SPHERE_CONFIG.glowOpacity,
        }}
      />
      <div
        ref={coreRef}
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-full"
      />
    </div>
  );
}
