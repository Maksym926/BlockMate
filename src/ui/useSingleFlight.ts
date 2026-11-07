import { useRef } from 'react';

/** Wraps an async action so a second tap or Enter while the first is running is ignored. */
export function useSingleFlight() {
  const running = useRef(false);
  return async (action: () => Promise<void>): Promise<void> => {
    if (running.current) return;
    running.current = true;
    try {
      await action();
    } finally {
      running.current = false;
    }
  };
}
