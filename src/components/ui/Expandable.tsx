"use client";

// The one expansion pattern used by every card: the inline card morphs
// (shared layoutId) into a focused overlay sheet. Keyboard: Enter/Space on the
// header toggles, Escape closes, focus moves to the sheet and returns after.

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Maximize2, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useMounted } from "@/lib/hooks";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

const SPRING = { type: "spring", stiffness: 380, damping: 36, mass: 0.9 } as const;

interface ExpandableProps {
  id: string;
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  /** Extra controls in the header (collapsed only). */
  actions?: ReactNode;
  /** Collapsed body. */
  children: ReactNode;
  /** Expanded body; receives a close callback. */
  expanded: ReactNode | ((close: () => void) => ReactNode);
  className?: string;
  bodyClassName?: string;
  sheetClassName?: string;
  /** Hide the header's title block in the overlay (the content brings its own). */
  hideHeaderWhenExpanded?: boolean;
  /** Controlled open state (optional). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const SheetContext = createContext<{ close: () => void } | null>(null);
export const useSheet = () => useContext(SheetContext);

export function ExpandableCard({
  id,
  title,
  subtitle,
  icon,
  actions,
  children,
  expanded,
  className,
  bodyClassName,
  sheetClassName,
  hideHeaderWhenExpanded,
  open: controlledOpen,
  onOpenChange,
}: ExpandableProps) {
  const [uncontrolled, setUncontrolled] = useState(false);
  const open = controlledOpen ?? uncontrolled;
  const setOpen = useCallback(
    (v: boolean) => {
      onOpenChange?.(v);
      if (controlledOpen === undefined) setUncontrolled(v);
    },
    [controlledOpen, onOpenChange],
  );
  const close = useCallback(() => setOpen(false), [setOpen]);
  const headingId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const layoutId = `card-${id}`;

  return (
    <>
      <motion.section
        layoutId={layoutId}
        layout
        transition={SPRING}
        aria-labelledby={headingId}
        className={cn("glass group relative flex flex-col overflow-hidden", className)}
        whileHover={{ y: -2 }}
        style={{ borderRadius: "var(--radius)" }}
      >
        <header className="flex items-start gap-3 px-5 pt-4 pb-2">
          {icon && <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-brand">{icon}</span>}
          <div className="min-w-0 flex-1">
            <h2 id={headingId} className="truncate text-[15px] font-semibold tracking-tight text-ink">
              {title}
            </h2>
            {subtitle && <p className="truncate text-xs text-ink-3">{subtitle}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {actions}
            <button
              ref={triggerRef}
              type="button"
              aria-expanded={open}
              aria-label="Expand"
              onClick={() => setOpen(true)}
              className="ring-focus grid h-8 w-8 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <Maximize2 size={15} />
            </button>
          </div>
        </header>
        <div className={cn("flex-1 px-5 pb-5", bodyClassName)}>{children}</div>
      </motion.section>

      <Overlay
        open={open}
        onClose={() => {
          close();
          requestAnimationFrame(() => triggerRef.current?.focus());
        }}
        layoutId={layoutId}
        title={hideHeaderWhenExpanded ? undefined : title}
        subtitle={hideHeaderWhenExpanded ? undefined : subtitle}
        icon={icon}
        className={sheetClassName}
      >
        <SheetContext.Provider value={{ close }}>{typeof expanded === "function" ? expanded(close) : expanded}</SheetContext.Provider>
      </Overlay>
    </>
  );
}

/** Focused overlay sheet. Also used standalone (the memo). */
export function Overlay({
  open,
  onClose,
  layoutId,
  title,
  subtitle,
  icon,
  children,
  className,
  printable,
}: {
  open: boolean;
  onClose: () => void;
  layoutId?: string;
  title?: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  printable?: boolean;
}) {
  const reduced = useReducedMotion();
  const sheetRef = useRef<HTMLDivElement>(null);
  const mounted = useMounted();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => sheetRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus(), 50);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      clearTimeout(t);
    };
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className={cn("fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6", printable && "print-root")}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{ background: "var(--overlay)", backdropFilter: "blur(6px)" }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            layoutId={layoutId}
            layout
            transition={reduced ? { duration: 0 } : SPRING}
            initial={layoutId ? undefined : { opacity: 0, y: 24, scale: 0.98 }}
            animate={layoutId ? undefined : { opacity: 1, y: 0, scale: 1 }}
            exit={layoutId ? undefined : { opacity: 0, y: 24, scale: 0.98 }}
            className={cn(
              "glass-solid print-sheet relative flex max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-[var(--radius)] sm:rounded-[var(--radius)]",
              className,
            )}
            style={{ borderRadius: "var(--radius)" }}
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { delay: 0.12, duration: 0.25 } }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              className="flex min-h-0 flex-1 flex-col"
            >
              <header className="no-print flex items-start gap-3 border-b border-border px-5 py-4 sm:px-7">
                {icon && <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-brand">{icon}</span>}
                <div className="min-w-0 flex-1">
                  {title && <h2 className="text-lg font-semibold tracking-tight text-ink">{title}</h2>}
                  {subtitle && <p className="text-sm text-ink-3">{subtitle}</p>}
                </div>
                <button
                  type="button"
                  data-autofocus
                  onClick={onClose}
                  aria-label="Close"
                  className="ring-focus grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
                >
                  <X size={18} />
                </button>
              </header>
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">{children}</div>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** Inline accordion with smooth height, for rows inside a card. */
export function Collapse({ open, children, className }: { open: boolean; children: ReactNode; className?: string }) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="c"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ height: { type: "spring", stiffness: 300, damping: 34 }, opacity: { duration: 0.2 } }}
          className={cn("overflow-hidden", className)}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
