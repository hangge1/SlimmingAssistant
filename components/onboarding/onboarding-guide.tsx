"use client";

import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const storageKey = "slimming-assistant-onboarding-seen-v2";
const gap = 14;

type TourStep = {
  title: string;
  text: string;
  targets: string[];
  placement: "top" | "right" | "bottom" | "left";
};

const tourSteps: TourStep[] = [
  {
    title: "第一步：先设置目标",
    text: "先设置目标体重和目标腰围。首页会用目标和当前值计算差距，让你知道该往哪里减。",
    targets: ["[data-tour='goal-weight']", "[data-tour='goal-waist']"],
    placement: "bottom",
  },
  {
    title: "第二步：今天先跑起来",
    text: "每天的核心动作是跑步。完成运动后，从这张卡片进入打卡页。",
    targets: ["[data-tour='today-checkin']"],
    placement: "right",
  },
  {
    title: "第三步：打卡留下证据",
    text: "跑步数据和身体数据都要记录。只有连续记录，系统才能判断你是否真的在靠近目标。",
    targets: ["[data-tour='today-checkin']"],
    placement: "left",
  },
  {
    title: "第四步：看变化再调整",
    text: "本周跑量看行动强度，累计跑量看长期坚持。点进去可以继续看数据分析和历史记录。",
    targets: ["[data-tour='week-run']", "[data-tour='total-run']"],
    placement: "top",
  },
];

type Rect = {
  height: number;
  left: number;
  top: number;
  width: number;
};

function getTargetRect(selectors: string[]): Rect | null {
  const rects = selectors
    .flatMap((selector) => Array.from(document.querySelectorAll<HTMLElement>(selector)))
    .map((element) => element.getBoundingClientRect())
    .filter((rect) => rect.width > 0 && rect.height > 0);

  if (rects.length === 0) {
    return null;
  }

  const left = Math.min(...rects.map((rect) => rect.left));
  const top = Math.min(...rects.map((rect) => rect.top));
  const right = Math.max(...rects.map((rect) => rect.right));
  const bottom = Math.max(...rects.map((rect) => rect.bottom));

  return {
    height: bottom - top,
    left,
    top,
    width: right - left,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getTipStyle(rect: Rect | null, placement: TourStep["placement"]) {
  const width = Math.min(360, window.innerWidth - 32);
  const fallback = {
    left: Math.max(16, (window.innerWidth - width) / 2),
    top: Math.max(88, window.innerHeight * 0.24),
    width,
  };

  if (!rect) {
    return fallback;
  }

  if (placement === "right") {
    return {
      left: clamp(rect.left + rect.width + gap, 16, window.innerWidth - width - 16),
      top: clamp(rect.top + rect.height / 2 - 90, 16, window.innerHeight - 220),
      width,
    };
  }

  if (placement === "left") {
    return {
      left: clamp(rect.left - width - gap, 16, window.innerWidth - width - 16),
      top: clamp(rect.top + rect.height / 2 - 90, 16, window.innerHeight - 220),
      width,
    };
  }

  if (placement === "top") {
    return {
      left: clamp(rect.left + rect.width / 2 - width / 2, 16, window.innerWidth - width - 16),
      top: clamp(rect.top - 178, 16, window.innerHeight - 220),
      width,
    };
  }

  return {
    left: clamp(rect.left + rect.width / 2 - width / 2, 16, window.innerWidth - width - 16),
    top: clamp(rect.top + rect.height + gap, 16, window.innerHeight - 220),
    width,
  };
}

export function OnboardingGuide() {
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const step = tourSteps[stepIndex];

  useEffect(() => {
    if (window.localStorage.getItem(storageKey) !== "1") {
      const timer = window.setTimeout(() => {
        setOpen(true);
      }, 0);

      return () => {
        window.clearTimeout(timer);
      };
    }
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    function updateRect() {
      setTargetRect(getTargetRect(step.targets));
    }

    updateRect();
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);

    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [open, step]);

  const tipStyle = useMemo(() => {
    if (!open || typeof window === "undefined") {
      return undefined;
    }

    return getTipStyle(targetRect, step.placement);
  }, [open, step.placement, targetRect]);

  function closeGuide() {
    window.localStorage.setItem(storageKey, "1");
    setOpen(false);
  }

  function nextStep() {
    if (stepIndex >= tourSteps.length - 1) {
      closeGuide();
      return;
    }

    setStepIndex((current) => current + 1);
  }

  function restartGuide() {
    setStepIndex(0);
    setOpen(true);
  }

  return (
    <>
      <button className="onboarding-trigger" onClick={restartGuide} type="button">
        使用引导
      </button>

      {open ? (
        <div className="tour-layer" onClick={nextStep} role="presentation">
          {targetRect ? (
            <div
              aria-hidden="true"
              className="tour-spotlight"
              style={{
                height: targetRect.height + 18,
                left: targetRect.left - 9,
                top: targetRect.top - 9,
                width: targetRect.width + 18,
              }}
            />
          ) : null}

          <section
            aria-label="使用引导"
            aria-live="polite"
            className={`tour-tip tour-tip--${step.placement}`}
            onClick={(event) => event.stopPropagation()}
            style={tipStyle}
          >
            <div className="tour-tip-head">
              <span className="tour-progress">
                {stepIndex + 1}/{tourSteps.length}
              </span>
              <button aria-label="关闭使用引导" className="tour-close" onClick={closeGuide} type="button">
                <X aria-hidden="true" className="size-4" />
              </button>
            </div>
            <h2 className="tour-title">{step.title}</h2>
            <p className="tour-text">{step.text}</p>
            <div className="tour-actions">
              <button className="tour-secondary" onClick={closeGuide} type="button">
                跳过
              </button>
              <button className="tour-primary" onClick={nextStep} type="button">
                {stepIndex >= tourSteps.length - 1 ? "完成" : "下一步"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
