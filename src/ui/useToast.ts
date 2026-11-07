import { useCallback, useRef, useState } from 'react';

/** Simple toast state: show a message for 3.5 s then clear it. */
export function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((msg: string) => {
    if (timer.current) clearTimeout(timer.current);
    setMessage(msg);
    timer.current = setTimeout(() => setMessage(null), 3500);
  }, []);

  return { message, show };
}
