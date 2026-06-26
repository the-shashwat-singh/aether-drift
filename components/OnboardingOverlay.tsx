'use client';

import { useState, useEffect, useCallback } from 'react';

interface OnboardingOverlayProps {
  onDismiss: () => void;
}

const STORAGE_KEY = 'aetherdrift_visited';
const STEP_DURATION_MS = 3000;

const STEPS = [
  {
    title: 'The globe remembers',
    body: 'This is where the ISS has been in the last 6 hours.',
  },
  {
    title: 'Your sky compass',
    body: 'This edge is your horizon. The center is directly overhead.',
  },
  {
    title: 'The Drift Report',
    body: 'This tells you what happened — and what\u2019s coming next.',
  },
];

/**
 * Checks localStorage for the visited flag. Returns null during SSR /
 * before mount to avoid hydration mismatches; callers should treat null as
 * "don't know yet, don't render."
 */
export function hasVisitedBefore(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return true; // if localStorage is unavailable, don't force onboarding
  }
}

function markVisited() {
  try {
    window.localStorage.setItem(STORAGE_KEY, 'true');
  } catch {
    // ignore — localStorage may be unavailable (private browsing, etc.)
  }
}

export default function OnboardingOverlay({ onDismiss }: OnboardingOverlayProps) {
  const [step, setStep] = useState(0);
  const isLastStep = step === STEPS.length - 1;

  const advance = useCallback(() => {
    setStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  }, []);

  const dismiss = useCallback(() => {
    markVisited();
    onDismiss();
  }, [onDismiss]);

  useEffect(() => {
    if (isLastStep) return;
    const timer = setTimeout(advance, STEP_DURATION_MS);
    return () => clearTimeout(timer);
  }, [step, isLastStep, advance]);

  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      if (e.key === 'Escape') dismiss();
    }
    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, [dismiss]);

  const current = STEPS[step];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-space-bg/80 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome tutorial"
    >
      <div className="max-w-md rounded-2xl border border-space-border bg-space-sidebar/95 p-8 text-center shadow-2xl">
        <div className="mb-4 flex justify-center gap-2">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 w-8 rounded-full transition-colors ${
                i <= step ? 'bg-orbit-leo' : 'bg-space-border'
              }`}
              aria-hidden="true"
            />
          ))}
        </div>

        <h2 className="mb-2 text-xl font-semibold text-text-primary">{current.title}</h2>
        <p className="mb-6 text-sm leading-relaxed text-text-secondary">{current.body}</p>

        <div className="flex justify-center gap-3">
          {!isLastStep ? (
            <>
              <button
                type="button"
                onClick={dismiss}
                className="rounded-lg border border-space-border px-4 py-2 text-sm text-text-secondary hover:bg-space-btnHover hover:text-white transition-all"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={advance}
                className="rounded-lg bg-space-btn px-4 py-2 text-sm font-medium text-white hover:bg-space-btnHover transition-all"
              >
                Next
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={dismiss}
              className="rounded-lg bg-orbit-leo px-6 py-2 text-sm font-medium text-space-bg hover:opacity-90 transition-all"
            >
              Got it →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
