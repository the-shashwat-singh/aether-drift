'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { TimeWindow } from '@/types';

interface TimeSliderProps {
  window: TimeWindow;
  onChange: (window: TimeWindow) => void;
  /** Reference "now" timestamp; -72h..+24h is computed relative to this. */
  now?: number;
}

const MIN_OFFSET_H = -72;
const MAX_OFFSET_H = 24;
const TOTAL_RANGE_H = MAX_OFFSET_H - MIN_OFFSET_H;
const HOUR_MS = 60 * 60 * 1000;
const PLAY_SPEED_MULTIPLIER = 10;
const DEBOUNCE_MS = 300;

function hoursToOffset(hours: number): number {
  return ((hours - MIN_OFFSET_H) / TOTAL_RANGE_H) * 100;
}

function pctToHours(pct: number): number {
  return MIN_OFFSET_H + (pct / 100) * TOTAL_RANGE_H;
}

function formatHandleLabel(timestampMs: number): string {
  return new Date(timestampMs).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function TimeSlider({ window: timeWindow, onChange, now: nowProp }: TimeSliderProps) {
  const now = useMemo(() => nowProp ?? Date.now(), [nowProp]);

  const startHours = (timeWindow.start - now) / HOUR_MS;
  const endHours = (timeWindow.end - now) / HOUR_MS;

  const [localStart, setLocalStart] = useState(startHours);
  const [localEnd, setLocalEnd] = useState(endHours);
  const [isPlaying, setIsPlaying] = useState(false);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const commitChange = useCallback(
    (start: number, end: number) => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        onChange({ start: now + start * HOUR_MS, end: now + end * HOUR_MS });
      }, DEBOUNCE_MS);
    },
    [now, onChange]
  );

  function handleStartChange(value: number) {
    const clamped = Math.min(value, localEnd - 0.1);
    setLocalStart(clamped);
    commitChange(clamped, localEnd);
  }

  function handleEndChange(value: number) {
    const clamped = Math.max(value, localStart + 0.1);
    setLocalEnd(clamped);
    commitChange(localStart, clamped);
  }

  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  useEffect(() => {
    if (!isPlaying) {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
      return;
    }

    playIntervalRef.current = setInterval(() => {
      setLocalStart((prevStart) => {
        const deltaHours = (PLAY_SPEED_MULTIPLIER * 1000) / HOUR_MS; // advance per real second
        const nextStart = prevStart + deltaHours;
        const span = localEnd - prevStart;

        if (nextStart + span > MAX_OFFSET_H) {
          setIsPlaying(false);
          return prevStart;
        }

        setLocalEnd(nextStart + span);
        commitChange(nextStart, nextStart + span);
        return nextStart;
      });
    }, 1000);

    return () => {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  // Global Space key toggles play, handled here as the slider owns play state.
  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      }
    }
    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, [togglePlay]);

  return (
    <div className="rounded-xl border border-space-border bg-space-sidebar/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-mono uppercase tracking-wide text-text-secondary">Time Window</p>
        <button
          type="button"
          onClick={togglePlay}
          aria-pressed={isPlaying}
          aria-label={isPlaying ? 'Pause time animation' : 'Play time animation'}
          className="rounded-lg bg-space-btn px-3 py-1.5 text-xs font-medium text-white transition-all hover:bg-space-btnHover"
        >
          {isPlaying ? '⏸ Pause' : '▶ Play 10x'}
        </button>
      </div>

      <div className="relative h-8">
        <div className="absolute top-1/2 left-0 right-0 h-1.5 -translate-y-1/2 rounded-full bg-space-border" />
        <div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-orbit-leo/70"
          style={{
            left: `${hoursToOffset(localStart)}%`,
            right: `${100 - hoursToOffset(localEnd)}%`,
          }}
        />
        {/* "Now" marker */}
        <div
          className="absolute top-0 bottom-0 w-px bg-orbit-iss/60"
          style={{ left: `${hoursToOffset(0)}%` }}
          aria-hidden="true"
        />

        <input
          type="range"
          min={MIN_OFFSET_H}
          max={MAX_OFFSET_H}
          step={0.1}
          value={localStart}
          onChange={(e) => handleStartChange(parseFloat(e.target.value))}
          aria-label="Window start time"
          className="pointer-events-auto absolute inset-0 w-full appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-orbit-leo [&::-webkit-slider-thumb]:cursor-pointer"
        />
        <input
          type="range"
          min={MIN_OFFSET_H}
          max={MAX_OFFSET_H}
          step={0.1}
          value={localEnd}
          onChange={(e) => handleEndChange(parseFloat(e.target.value))}
          aria-label="Window end time"
          className="pointer-events-auto absolute inset-0 w-full appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-orbit-geo [&::-webkit-slider-thumb]:cursor-pointer"
        />
      </div>

      <div className="mt-2 flex justify-between font-mono text-[11px] text-text-secondary">
        <span>{formatHandleLabel(now + localStart * HOUR_MS)}</span>
        <span>{formatHandleLabel(now + localEnd * HOUR_MS)}</span>
      </div>

      <p className="mt-1 text-[11px] text-text-secondary">
        Use <kbd className="font-mono">←</kbd>/<kbd className="font-mono">→</kbd> to scrub 30 min ·{' '}
        <kbd className="font-mono">Space</kbd> to play
      </p>
    </div>
  );
}
