'use client';

import { FAMOUS_PASSES } from '@/lib/famousPasses';
import { FamousPass } from '@/types';

interface FamousPassesPanelProps {
  onSelect: (pass: FamousPass) => void;
  activePassId?: string | null;
}

export default function FamousPassesPanel({ onSelect, activePassId }: FamousPassesPanelProps) {
  return (
    <div className="rounded-xl border border-space-border bg-space-sidebar/60 p-3">
      <p className="mb-2 text-xs font-mono uppercase tracking-wide text-text-secondary">Famous Passes</p>
      <ul className="space-y-2">
        {FAMOUS_PASSES.map((pass) => (
          <li key={pass.id}>
            <button
              type="button"
              onClick={() => onSelect(pass)}
              className={`w-full rounded-lg border px-3 py-2 text-left transition-all ${
                activePassId === pass.id
                  ? 'border-orbit-leo bg-orbit-leo/10'
                  : 'border-space-border hover:bg-space-btnHover'
              }`}
            >
              <p className="text-sm font-medium text-text-primary">{pass.title}</p>
              <p className="mt-1 text-xs text-text-secondary leading-relaxed">{pass.description}</p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
