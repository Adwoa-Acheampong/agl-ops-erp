import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from "lucide-react";
import { cn } from "./cn";

/**
 * P16.3 — App-wide toast layer.
 *
 * Replaces the scattered `alert(...)` calls with a non-blocking, brand-
 * consistent stack. Mount the provider once at the root; use `useToast()`
 * anywhere below it.
 *
 *   const toast = useToast();
 *   toast.success("Saved");
 *   toast.error("Could not save", { duration: 8000 });
 */

type ToastTone = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  tone: ToastTone;
  message: string;
  /** Auto-dismiss delay; 0 = sticky. Defaults to 4000ms. */
  duration: number;
}

interface ToastApi {
  push: (
    tone: ToastTone,
    message: string,
    opts?: { duration?: number },
  ) => void;
  success: (message: string, opts?: { duration?: number }) => void;
  error: (message: string, opts?: { duration?: number }) => void;
  info: (message: string, opts?: { duration?: number }) => void;
  warning: (message: string, opts?: { duration?: number }) => void;
  dismiss: (id: string) => void;
}

const ToastCtx = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastCtx);
  if (!ctx) {
    throw new Error("useToast must be used inside <ToastProvider>");
  }
  return ctx;
}

const TONE_STYLES: Record<
  ToastTone,
  { ring: string; bg: string; text: string; Icon: typeof CheckCircle2 }
> = {
  success: {
    ring: "ring-emerald-200",
    bg: "bg-emerald-50",
    text: "text-emerald-900",
    Icon: CheckCircle2,
  },
  error: {
    ring: "ring-rose-200",
    bg: "bg-rose-50",
    text: "text-rose-900",
    Icon: XCircle,
  },
  info: {
    ring: "ring-sky-200",
    bg: "bg-sky-50",
    text: "text-sky-900",
    Icon: Info,
  },
  warning: {
    ring: "ring-amber-200",
    bg: "bg-amber-50",
    text: "text-amber-900",
    Icon: AlertTriangle,
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idCounter = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((ts) => ts.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (tone: ToastTone, message: string, opts?: { duration?: number }) => {
      const id = `t${++idCounter.current}`;
      const duration = opts?.duration ?? 4000;
      setToasts((ts) => [...ts, { id, tone, message, duration }]);
    },
    [],
  );

  const api = useMemo<ToastApi>(
    () => ({
      push,
      success: (m, o) => push("success", m, o),
      error: (m, o) => push("error", m, o),
      info: (m, o) => push("info", m, o),
      warning: (m, o) => push("warning", m, o),
      dismiss,
    }),
    [push, dismiss],
  );

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2"
        role="region"
        aria-label="Notifications"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} dismiss={dismiss} />
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

function ToastItem({
  toast,
  dismiss,
}: {
  toast: Toast;
  dismiss: (id: string) => void;
}) {
  useEffect(() => {
    if (toast.duration <= 0) return;
    const handle = window.setTimeout(() => dismiss(toast.id), toast.duration);
    return () => window.clearTimeout(handle);
  }, [toast, dismiss]);

  const { ring, bg, text, Icon } = TONE_STYLES[toast.tone];

  return (
    <div
      className={cn(
        "pointer-events-auto flex items-start gap-3 rounded-lg p-3 shadow-md ring-1",
        ring,
        bg,
        text,
      )}
      role="status"
      aria-live="polite"
    >
      <Icon size={18} className="mt-0.5 shrink-0" />
      <div className="flex-1 text-sm">{toast.message}</div>
      <button
        type="button"
        onClick={() => dismiss(toast.id)}
        className={cn(
          "rounded p-0.5 opacity-60 hover:opacity-100 focus:outline-none focus:ring-2",
          ring,
        )}
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}
