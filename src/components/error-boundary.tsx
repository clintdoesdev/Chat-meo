"use client";

import { Component, type ReactNode } from "react";

type ErrorBoundaryProps = {
  children: ReactNode;
  /** Static content describing the crash (icon/copy/wrapper markup) — deliberately not a
   * render-prop function, since this gets used from Server Components and functions can't
   * cross that boundary as props. Strings (below) are fine to cross it, so styling for the
   * wrapper and retry button is passed as classNames instead. */
  fallback: ReactNode;
  wrapperClassName?: string;
  retryButtonClassName?: string;
  retryLabel?: string;
  /** Full page reload instead of just re-mounting `children` — for surfaces (like the widget
   * iframe) where a crash likely means client-side state got into a bad spot worth starting
   * over cleanly, rather than just retrying the same render. */
  reloadOnRetry?: boolean;
  /** Logged with a consistent prefix so a crash here shows up the same way server-side chat/
   * engine errors do — see [chat]/[engine] logging in src/lib/chat/run-turn.ts and
   * src/engine/executor.ts. */
  label: string;
};

type ErrorBoundaryState = { hasError: boolean };

/** Generic crash guard — React error boundaries have to be class components (no hook
 * equivalent yet). Catches render/lifecycle errors in `children` and shows `fallback` plus a
 * built-in retry button instead of leaving a blank screen. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: { componentStack?: string | null }) {
    console.error(`[ui] ${this.props.label} crashed`, error, info.componentStack);
  }

  handleRetry = () => {
    if (this.props.reloadOnRetry) {
      window.location.reload();
      return;
    }
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className={this.props.wrapperClassName}>
        {this.props.fallback}
        <button type="button" onClick={this.handleRetry} className={this.props.retryButtonClassName}>
          {this.props.retryLabel ?? "Try again"}
        </button>
      </div>
    );
  }
}
