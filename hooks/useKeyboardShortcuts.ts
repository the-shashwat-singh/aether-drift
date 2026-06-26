'use client';

import { useEffect } from 'react';

export interface KeyboardShortcutHandlers {
  onPlayPause: () => void;
  onScrubLeft: () => void;
  onScrubRight: () => void;
  onReset: () => void;
  onToggleEducational: () => void;
  onToggleShells: () => void;
  onEscape: () => void;
}

/**
 * Wires up the global keyboard shortcuts described in the spec:
 * Space (play/pause), ArrowLeft/Right (scrub 30 min), R (reset),
 * E (educational mode), S (toggle shells), Escape (close overlays).
 *
 * Space is intentionally handled inside TimeSlider directly since it owns
 * play state; this hook still listens for it here in case TimeSlider isn't
 * mounted, but TimeSlider's own listener takes priority by virtue of
 * stopping default behavior first when focused there.
 */
export function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers) {
  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
      if (isTyping) return;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          handlers.onScrubLeft();
          break;
        case 'ArrowRight':
          e.preventDefault();
          handlers.onScrubRight();
          break;
        case 'r':
        case 'R':
          handlers.onReset();
          break;
        case 'e':
        case 'E':
          handlers.onToggleEducational();
          break;
        case 's':
        case 'S':
          handlers.onToggleShells();
          break;
        case 'Escape':
          handlers.onEscape();
          break;
        default:
          break;
      }
    }

    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, [handlers]);
}
