'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { NextISSPass } from '@/types';
import { azimuthToCompassLabel } from '@/lib/coordinates';

export type NotificationPermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

interface UseISSAlarmResult {
  permission: NotificationPermissionState;
  isArmed: boolean;
  secondsUntilNotification: number | null;
  setAlarm: (pass: NextISSPass, locationLabel: string, leadMinutes?: number) => Promise<void>;
  cancelAlarm: () => void;
}

/**
 * Manages a single armed "Remind Me" notification for the next ISS pass.
 * Uses the browser-native Web Notifications API — no server push, no
 * service worker — so the alarm only fires while this tab/window remains
 * open, which is communicated in the UI by PassAlarmButton.
 */
export function useISSAlarm(): UseISSAlarmResult {
  const [permission, setPermission] = useState<NotificationPermissionState>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return Notification.permission as NotificationPermissionState;
  });
  const [isArmed, setIsArmed] = useState(false);
  const [secondsUntilNotification, setSecondsUntilNotification] = useState<number | null>(null);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    timeoutRef.current = null;
    intervalRef.current = null;
  }, []);

  const cancelAlarm = useCallback(() => {
    clearTimers();
    setIsArmed(false);
    setSecondsUntilNotification(null);
  }, [clearTimers]);

  const setAlarm = useCallback(
    async (pass: NextISSPass, locationLabel: string, leadMinutes = 5) => {
      if (typeof window === 'undefined' || !('Notification' in window)) {
        setPermission('unsupported');
        return;
      }

      let currentPermission = Notification.permission;
      if (currentPermission === 'default') {
        currentPermission = await Notification.requestPermission();
      }
      setPermission(currentPermission as NotificationPermissionState);

      if (currentPermission !== 'granted') return;

      clearTimers();

      const notifyAt = pass.time - leadMinutes * 60 * 1000;
      const msUntilNotify = notifyAt - Date.now();

      if (msUntilNotify <= 0) {
        // Pass is already imminent or past the lead window — notify immediately.
        fireNotification(pass, locationLabel);
        setIsArmed(false);
        setSecondsUntilNotification(null);
        return;
      }

      setIsArmed(true);
      setSecondsUntilNotification(Math.round(msUntilNotify / 1000));

      intervalRef.current = setInterval(() => {
        const remaining = Math.round((notifyAt - Date.now()) / 1000);
        setSecondsUntilNotification(remaining > 0 ? remaining : 0);
      }, 1000);

      timeoutRef.current = setTimeout(() => {
        fireNotification(pass, locationLabel);
        clearTimers();
        setIsArmed(false);
        setSecondsUntilNotification(null);
      }, msUntilNotify);
    },
    [clearTimers]
  );

  useEffect(() => clearTimers, [clearTimers]);

  return { permission, isArmed, secondsUntilNotification, setAlarm, cancelAlarm };
}

function fireNotification(pass: NextISSPass, locationLabel: string) {
  const direction = pass.direction || azimuthToCompassLabel(0);
  try {
    new Notification('ISS pass in 5 minutes', {
      body: `Over ${locationLabel}. Face ${direction}, look ${Math.round(pass.maxAlt)}° up.`,
      icon: '/favicon.ico',
      tag: 'iss-pass-alarm',
    });
  } catch (err) {
    console.error('[useISSAlarm] failed to fire notification:', err);
  }
}
