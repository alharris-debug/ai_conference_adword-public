"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** false during SSR and hydration, true once the client has taken over. */
export function useMounted(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}

export type Theme = "dark" | "light";

function readTheme(): Theme {
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "light" || attr === "dark") return attr;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function subscribeTheme(cb: () => void) {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const mq = window.matchMedia("(prefers-color-scheme: light)");
  mq.addEventListener("change", cb);
  return () => {
    mo.disconnect();
    mq.removeEventListener("change", cb);
  };
}

/** The resolved theme (toggle wins over the OS preference). Server renders dark. */
export function useTheme(): [Theme, () => void] {
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => "dark" as Theme);
  const toggle = () => {
    const next: Theme = readTheme() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("av-theme", next);
    } catch {}
  };
  return [theme, toggle];
}
