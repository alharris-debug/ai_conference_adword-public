"use client";

// Thin wrapper around lottie-react's svg player. Loaded client-only (the
// lottie-web engine expects a browser) and parked on its final frame when the
// viewer prefers reduced motion, so status icons still read correctly.

import dynamic from "next/dynamic";
import { useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, type ComponentType, type CSSProperties, type Ref } from "react";
import { useAnimationsEnabled } from "@/lib/motion-context";
import type { LottieHandle } from "lottie-react";

import statusCheck from "./status-check.json";
import statusWarn from "./status-warn.json";
import statusFail from "./status-fail.json";
import statusInfo from "./status-info.json";
import aiOrb from "./ai-orb.json";
import successBurst from "./success-burst.json";
import trendUp from "./trend-up.json";
import trendDown from "./trend-down.json";
import loading from "./loading.json";
import pulseGood from "./pulse-good.json";
import pulseWatch from "./pulse-watch.json";
import pulseBad from "./pulse-bad.json";

interface PlayerProps {
  src: object;
  loop?: boolean;
  autoplay?: boolean;
  className?: string;
  style?: CSSProperties;
  lottieRef?: Ref<LottieHandle>;
  rendererSettings?: { preserveAspectRatio?: string };
}

const Player = dynamic(() => import("lottie-react").then((m) => m.LottieSvg as unknown as ComponentType<PlayerProps>), { ssr: false });

export const ANIMATIONS = {
  "status-check": statusCheck,
  "status-warn": statusWarn,
  "status-fail": statusFail,
  "status-info": statusInfo,
  "ai-orb": aiOrb,
  "success-burst": successBurst,
  "trend-up": trendUp,
  "trend-down": trendDown,
  loading,
  "pulse-good": pulseGood,
  "pulse-watch": pulseWatch,
  "pulse-bad": pulseBad,
} as const;

export type AnimationName = keyof typeof ANIMATIONS;

export function Lottie({
  name,
  size = 24,
  loop = true,
  className,
  label,
}: {
  name: AnimationName;
  size?: number | string;
  loop?: boolean;
  className?: string;
  /** Accessible name; omit for purely decorative animations. */
  label?: string;
}) {
  const reduced = useReducedMotion();
  const enabled = useAnimationsEnabled();
  const still = reduced || !enabled;
  const handleRef = useRef<LottieHandle | null>(null);
  const onRef = useCallback(
    (handle: LottieHandle | null) => {
      handleRef.current = handle;
      if (handle && still) {
        // Show the finished state instead of animating.
        try {
          handle.seek({ percent: 100 });
        } catch {}
      }
    },
    [still],
  );
  useEffect(() => {
    const h = handleRef.current;
    if (!h) return;
    try {
      if (still) {
        h.pause();
        h.seek({ percent: 100 });
      } else h.play();
    } catch {}
  }, [still]);

  return (
    <span
      className={className}
      style={{ display: "inline-block", width: size, height: size, lineHeight: 0 }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <Player
        lottieRef={onRef}
        src={ANIMATIONS[name]}
        loop={still ? false : loop}
        autoplay={!still}
        style={{ width: "100%", height: "100%" }}
        rendererSettings={{ preserveAspectRatio: "xMidYMid meet" }}
      />
    </span>
  );
}
