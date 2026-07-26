import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  /** Optional fallback to render in place of the default UI. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
  /** Hook to forward to error reporting (Sentry, etc). */
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  error: Error | null;
}

/**
 * App-wide error boundary. Wrap the route tree so a crash in any page renders
 * a recoverable UI instead of a white screen. Use sub-instances around
 * heavy widgets (charts, inventory tables) to scope the blast radius.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", error, info.componentStack);
    this.props.onError?.(error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-lg border border-rose-200 bg-rose-50/60 p-6 text-center">
          <div className="mx-auto mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-rose-600">
            <AlertTriangle size={20} />
          </div>
          <h2 className="text-lg font-semibold text-rose-900">
            Something went wrong
          </h2>
          <p className="mt-2 text-sm text-rose-700">
            {error.message || "An unexpected error occurred."}
          </p>
          <button
            type="button"
            onClick={this.reset}
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700"
          >
            <RefreshCw size={14} />
            Try again
          </button>
        </div>
      </div>
    );
  }
}
