"use client";

import { useEffect, useRef } from "react";

export function AuthMotionBackground() {
  const sceneRef = useRef<HTMLDivElement>(null);
  const clickTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const scene = sceneRef.current;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    if (!scene || reduceMotion || !finePointer) {
      return;
    }

    let frameId = 0;
    let currentX = 68;
    let currentY = 38;
    let targetX = currentX;
    let targetY = currentY;

    const setPointerVars = (x: number, y: number) => {
      scene.style.setProperty("--auth-pointer-x", `${x.toFixed(2)}%`);
      scene.style.setProperty("--auth-pointer-y", `${y.toFixed(2)}%`);
    };

    const readPointer = (event: PointerEvent) => {
      const rect = scene.getBoundingClientRect();
      return {
        x: Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100)),
        y: Math.min(100, Math.max(0, ((event.clientY - rect.top) / rect.height) * 100)),
      };
    };

    const render = () => {
      currentX += (targetX - currentX) * 0.14;
      currentY += (targetY - currentY) * 0.14;
      setPointerVars(currentX, currentY);
      frameId = window.requestAnimationFrame(render);
    };

    const handlePointerMove = (event: PointerEvent) => {
      const pointer = readPointer(event);
      targetX = pointer.x;
      targetY = pointer.y;
    };

    const handlePointerDown = (event: PointerEvent) => {
      const pointer = readPointer(event);
      scene.style.setProperty("--auth-click-x", `${pointer.x.toFixed(2)}%`);
      scene.style.setProperty("--auth-click-y", `${pointer.y.toFixed(2)}%`);
      scene.dataset.click = "on";

      if (clickTimerRef.current) {
        window.clearTimeout(clickTimerRef.current);
      }

      clickTimerRef.current = window.setTimeout(() => {
        scene.dataset.click = "off";
      }, 560);
    };

    const handlePointerLeave = () => {
      targetX = 68;
      targetY = 38;
    };

    frameId = window.requestAnimationFrame(render);
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerdown", handlePointerDown, { passive: true });
    window.addEventListener("pointerleave", handlePointerLeave);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointerleave", handlePointerLeave);

      if (clickTimerRef.current) {
        window.clearTimeout(clickTimerRef.current);
      }
    };
  }, []);

  return (
    <div ref={sceneRef} aria-hidden="true" className="auth-motion-scene" data-click="off">
      <span className="auth-runner" />
      <span className="auth-lane auth-lane--one" />
      <span className="auth-lane auth-lane--two" />
    </div>
  );
}
