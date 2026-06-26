'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[GlobalError]', error);
  }, [error]);

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-space-bg text-text-primary">
      <p className="text-lg">Data temporarily unavailable.</p>
      <button
        type="button"
        onClick={reset}
        className="rounded-lg bg-space-btn px-4 py-2 text-sm font-medium text-white transition-all hover:bg-space-btnHover"
      >
        Try again
      </button>
    </div>
  );
}
