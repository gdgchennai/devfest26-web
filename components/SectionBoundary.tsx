"use client";

import { Component, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  /**
   * Rendered in place of the children if they throw. Defaults to `null`, so a
   * broken section simply disappears rather than taking the whole page down —
   * the point of this boundary is containment, not a visible error per section.
   */
  fallback?: ReactNode;
  /** Names the section in the logged error, e.g. "hero". */
  label?: string;
};

type State = { hasError: boolean };

/**
 * Section-level error boundary. Wrap any client subtree that can throw at
 * runtime (the motion system, chiefly) so a failure there is contained to that
 * section and its siblings keep rendering. React error boundaries must be class
 * components; there is no hook equivalent, and we intentionally avoid adding a
 * dependency for this.
 */
export class SectionBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    // Contained on purpose: log for diagnostics, never rethrow.
    const tag = this.props.label ? `SectionBoundary: ${this.props.label}` : "SectionBoundary";
    console.error(`[${tag}]`, error);
  }

  render() {
    if (this.state.hasError) return this.props.fallback ?? null;
    return this.props.children;
  }
}
