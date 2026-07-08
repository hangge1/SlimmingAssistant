"use client";

import { useEffect, useRef } from "react";

export function HomeMotionBackground() {
  const layerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const layer = layerRef.current;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    if (!layer || reduceMotion || !finePointer) {
      return;
    }

    let frameId = 0;
    let currentX = 50;
    let currentY = 42;
    let targetX = currentX;
    let targetY = currentY;

    const render = () => {
      currentX += (targetX - currentX) * 0.12;
      currentY += (targetY - currentY) * 0.12;
      layer.style.setProperty("--home-pointer-x", `${currentX.toFixed(2)}%`);
      layer.style.setProperty("--home-pointer-y", `${currentY.toFixed(2)}%`);
      frameId = window.requestAnimationFrame(render);
    };

    const handlePointerMove = (event: PointerEvent) => {
      const rect = layer.getBoundingClientRect();
      targetX = ((event.clientX - rect.left) / rect.width) * 100;
      targetY = ((event.clientY - rect.top) / rect.height) * 100;
      targetX = Math.min(100, Math.max(0, targetX));
      targetY = Math.min(100, Math.max(0, targetY));
    };

    const handlePointerLeave = () => {
      targetX = 50;
      targetY = 42;
    };

    frameId = window.requestAnimationFrame(render);
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerleave", handlePointerLeave);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerleave", handlePointerLeave);
    };
  }, []);

  return (
    <div ref={layerRef} aria-hidden="true" className="home-motion-field">
      <span className="home-motion-field__wake home-motion-field__wake--one" />
      <span className="home-motion-field__wake home-motion-field__wake--two" />
      <span className="home-motion-field__marker" />
    </div>
  );
}
