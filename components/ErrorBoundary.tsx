'use client';

import { Component, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  label?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Wraps a component subtree and renders a friendly "Data temporarily
 * unavailable" fallback instead of crashing the whole page, per the
 * error-handling rules: never show raw error messages or stack traces.
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error(`[ErrorBoundary${this.props.label ? `:${this.props.label}` : ''}]`, error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-space-border bg-space-sidebar/60 p-4 text-center">
          <p className="text-sm text-text-secondary">Data temporarily unavailable.</p>
        </div>
      );
    }
    return this.props.children;
  }
}
