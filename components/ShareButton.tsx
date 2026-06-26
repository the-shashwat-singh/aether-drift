'use client';

import { useState, useCallback } from 'react';

interface ShareButtonProps {
  buildUrl: () => string;
  onShared?: () => void;
}

export default function ShareButton({ buildUrl, onShared }: ShareButtonProps) {
  const [justCopied, setJustCopied] = useState(false);

  const handleShare = useCallback(async () => {
    const url = buildUrl();
    try {
      await navigator.clipboard.writeText(url);
    } catch (err) {
      console.error('[ShareButton] clipboard write failed:', err);
      // Fallback: select a temporary input so the user can copy manually.
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      try {
        document.execCommand('copy');
      } catch {
        // ignore — clipboard truly unavailable
      }
      document.body.removeChild(input);
    }
    setJustCopied(true);
    onShared?.();
    setTimeout(() => setJustCopied(false), 2000);
  }, [buildUrl, onShared]);

  return (
    <button
      type="button"
      onClick={handleShare}
      className="rounded-lg bg-space-btn px-4 py-2 text-sm font-medium text-white transition-all hover:bg-space-btnHover"
      aria-label="Copy shareable link to clipboard"
    >
      {justCopied ? '✓ Copied' : '🔗 Share'}
    </button>
  );
}
