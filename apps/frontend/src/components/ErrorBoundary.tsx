// ErrorBoundary — classic React class-component wrapper.
// Wrap each route (not the whole app) so one crashed view doesn't kill the others.
// Fallback voice is case-file: "The case file cracked. Reload or head back to the dashboard."

import { Component, type ErrorInfo, type ReactNode } from "react";
import { QueryClient } from "@tanstack/react-query";
import { navigate } from "@/router";

type FallbackFn = (error: Error, reset: () => void) => ReactNode;

interface Props {
  children: ReactNode;
  fallback?: FallbackFn;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  error: Error | null;
}

// Trivial logger shim — console only, with a tagged prefix.
function logError(err: Error, info?: ErrorInfo) {
  // eslint-disable-next-line no-console
  console.error("[ErrorBoundary · case file cracked]", err, info?.componentStack ?? "");
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logError(error, info);
    this.props.onError?.(error, info);
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback(this.state.error, this.reset);
      return <DefaultFallback error={this.state.error} reset={this.reset} />;
    }
    return this.props.children;
  }
}

// ----- fallbacks -------------------------------------------------------------

// Module-level QueryClient ref — populated once via `attachQueryClient` from main.tsx.
// Keeps this file decoupled from the query client's construction site.
let qcRef: QueryClient | null = null;
export function attachQueryClient(qc: QueryClient) {
  qcRef = qc;
}

function clearCaches(reset: () => void) {
  try {
    qcRef?.clear();
  } catch {
    /* ignore */
  }
  reset();
}

export function DefaultFallback({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div
      role="alert"
      className="empty"
      style={{ minHeight: "60vh" }}
    >
      <div className="caseno">CASE · CRACKED</div>
      <div className="title" style={{ font: "400 28px/1.1 var(--font-display)" }}>
        The case file cracked.
      </div>
      <div className="sub">Reload or head back to the dashboard.</div>
      <details style={{ maxWidth: 520, color: "var(--fg3)", font: "400 12px/1.5 var(--font-mono)", marginTop: 8 }}>
        <summary style={{ cursor: "pointer" }}>Evidence</summary>
        <pre style={{ whiteSpace: "pre-wrap", marginTop: 6 }}>{error.message}</pre>
      </details>
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button className="btn btn-primary" onClick={() => clearCaches(reset)}>
          Reload
        </button>
      </div>
    </div>
  );
}

// Narrow fallback — for auth screens where the full-shell layout isn't mounted.
export function NarrowFallback({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div
      role="alert"
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "var(--bg)",
      }}
    >
      <div
        style={{
          maxWidth: 420,
          width: "100%",
          background: "var(--paper-0)",
          border: "1px solid var(--border-soft)",
          borderRadius: 14,
          padding: 24,
          boxShadow: "var(--sh-2)",
        }}
      >
        <div className="caseno">CASE · CRACKED</div>
        <h1 style={{ font: "400 28px/1.1 var(--font-display)", margin: "6px 0 10px" }}>
          The case file cracked.
        </h1>
        <div style={{ color: "var(--fg2)", font: "400 13px/1.5 var(--font-sans)" }}>
          Reload or head back to the dashboard.
        </div>
        <details style={{ color: "var(--fg3)", font: "400 12px/1.5 var(--font-mono)", marginTop: 12 }}>
          <summary style={{ cursor: "pointer" }}>Evidence</summary>
          <pre style={{ whiteSpace: "pre-wrap", marginTop: 6 }}>{error.message}</pre>
        </details>
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button className="btn btn-primary" onClick={() => clearCaches(reset)}>
            Reload
          </button>
        </div>
      </div>
    </div>
  );
}

// Full-shell fallback with "Back to dashboard" — for authenticated routes.
export function ShellFallback({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="empty" style={{ minHeight: "70vh" }}>
      <div className="caseno">CASE · CRACKED</div>
      <div style={{ font: "400 36px/1.05 var(--font-display)", color: "var(--fg1)" }}>
        The case file cracked.
      </div>
      <div className="sub">Reload or head back to the dashboard.</div>
      <details style={{ maxWidth: 560, color: "var(--fg3)", font: "400 12px/1.5 var(--font-mono)", marginTop: 8 }}>
        <summary style={{ cursor: "pointer" }}>Evidence</summary>
        <pre style={{ whiteSpace: "pre-wrap", marginTop: 6 }}>{error.message}</pre>
      </details>
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button
          className="btn btn-primary"
          onClick={() => {
            clearCaches(reset);
          }}
        >
          Reload
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => {
            clearCaches(reset);
            navigate("/");
          }}
        >
          Back to dashboard
        </button>
      </div>
    </div>
  );
}
