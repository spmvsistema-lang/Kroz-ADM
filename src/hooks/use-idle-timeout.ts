'use client';

import { useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook to detect user inactivity and trigger a callback.
 * @param onIdle The function to call when the user is idle.
 * @param idleTime The amount of time in milliseconds to wait before considering the user idle.
 */
export const useIdleTimeout = (onIdle: () => void, idleTime: number) => {
  const timeoutId = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Memoize the onIdle callback to prevent re-running the effect unnecessarily
  const handleIdle = useCallback(() => {
    onIdle();
  }, [onIdle]);

  useEffect(() => {
    const resetTimer = () => {
      if (timeoutId.current) {
        clearTimeout(timeoutId.current);
      }
      timeoutId.current = setTimeout(handleIdle, idleTime);
    };

    const handleActivity = () => {
      resetTimer();
    };

    // List of events that indicate user activity
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];

    // Initialize timer on mount
    resetTimer();

    // Add event listeners
    events.forEach(event => window.addEventListener(event, handleActivity));

    // Cleanup function to remove listeners and clear timer on unmount
    return () => {
      if (timeoutId.current) {
        clearTimeout(timeoutId.current);
      }
      events.forEach(event => window.removeEventListener(event, handleActivity));
    };
  }, [idleTime, handleIdle]); // Re-run the effect if idleTime or the onIdle function changes
};
