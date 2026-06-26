'use client';

export interface OrbitalShellVisibility {
  LEO: boolean;
  MEO: boolean;
  GEO: boolean;
}

interface OrbitalShellToggleProps {
  visibility: OrbitalShellVisibility;
  onChange: (next: OrbitalShellVisibility) => void;
}

const SHELLS: Array<{ key: keyof OrbitalShellVisibility; label: string; dot: string }> = [
  { key: 'LEO', label: 'LEO ring (~400 km)', dot: 'bg-orbit-leo' },
  { key: 'MEO', label: 'MEO ring (~20,200 km)', dot: 'bg-orbit-meo' },
  { key: 'GEO', label: 'GEO ring (~35,786 km)', dot: 'bg-orbit-geo' },
];

export default function OrbitalShellToggle({ visibility, onChange }: OrbitalShellToggleProps) {
  function toggle(key: keyof OrbitalShellVisibility) {
    onChange({ ...visibility, [key]: !visibility[key] });
  }

  return (
    <div className="rounded-xl border border-space-border bg-space-sidebar/60 p-3" role="group" aria-label="Orbital shell visibility">
      <p className="mb-2 text-xs font-mono uppercase tracking-wide text-text-secondary">Orbital Shells</p>
      <div className="flex flex-col gap-2">
        {SHELLS.map((shell) => (
          <label key={shell.key} className="flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={visibility[shell.key]}
              onChange={() => toggle(shell.key)}
              className="h-4 w-4 accent-orbit-leo cursor-pointer"
            />
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${shell.dot}`} aria-hidden="true" />
            <span className="text-text-primary">{shell.label}</span>
          </label>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-text-secondary">Press <kbd className="font-mono">S</kbd> to toggle all shells</p>
    </div>
  );
}
