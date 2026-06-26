'use client';

const LEGEND_ITEMS: Array<{ label: string; color: string; dot: string }> = [
  { label: 'ISS', color: 'text-orbit-iss', dot: 'bg-orbit-iss' },
  { label: 'LEO Satellites', color: 'text-orbit-leo', dot: 'bg-orbit-leo' },
  { label: 'MEO Satellites', color: 'text-orbit-meo', dot: 'bg-orbit-meo' },
  { label: 'GEO Satellites', color: 'text-orbit-geo', dot: 'bg-orbit-geo' },
  { label: 'Planets & Moon', color: 'text-orbit-planet', dot: 'bg-orbit-planet' },
];

export default function ColorLegend() {
  return (
    <div
      className="absolute bottom-4 right-4 z-20 rounded-xl border border-space-border bg-space-sidebar/60 backdrop-blur-md px-3 py-2.5 shadow-lg"
      role="region"
      aria-label="Trail color legend"
    >
      <ul className="flex flex-col gap-1.5">
        {LEGEND_ITEMS.map((item) => (
          <li key={item.label} className="flex items-center gap-2 text-xs font-mono text-text-secondary">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${item.dot} shrink-0`} aria-hidden="true" />
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
