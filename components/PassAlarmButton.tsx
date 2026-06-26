'use client';

import { useISSAlarm } from '@/hooks/useISSAlarm';
import { NextISSPass } from '@/types';

interface PassAlarmButtonProps {
  nextISSPass: NextISSPass | null;
  locationLabel: string;
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function PassAlarmButton({ nextISSPass, locationLabel }: PassAlarmButtonProps) {
  const { permission, isArmed, secondsUntilNotification, setAlarm, cancelAlarm } = useISSAlarm();

  if (!nextISSPass) {
    return (
      <button
        type="button"
        disabled
        className="w-full rounded-lg bg-space-btn/40 px-4 py-2 text-sm text-text-secondary cursor-not-allowed"
      >
        No upcoming ISS pass to remind for
      </button>
    );
  }

  if (permission === 'unsupported') {
    return (
      <p className="text-xs text-text-secondary">
        Notifications aren&apos;t supported in this browser.
      </p>
    );
  }

  if (permission === 'denied') {
    return (
      <p className="text-xs text-text-secondary">
        Notifications are blocked. Enable them in your browser settings to use Remind Me.
      </p>
    );
  }

  if (isArmed && secondsUntilNotification !== null) {
    return (
      <div className="flex items-center gap-2">
        <span className="flex-1 rounded-lg bg-space-btn px-4 py-2 text-center text-sm font-mono text-orbit-iss shadow-issGlow">
          Reminder in {formatCountdown(secondsUntilNotification)}
        </span>
        <button
          type="button"
          onClick={cancelAlarm}
          className="rounded-lg border border-space-border px-3 py-2 text-sm text-text-secondary hover:bg-space-btnHover hover:text-white transition-all"
          aria-label="Cancel reminder"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setAlarm(nextISSPass, locationLabel)}
      className="w-full rounded-lg bg-space-btn px-4 py-2 text-sm font-medium text-white transition-all hover:bg-space-btnHover"
    >
      🔔 Remind Me 5 min before
    </button>
  );
}
