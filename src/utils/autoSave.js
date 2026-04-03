import { useRef, useCallback, useEffect } from 'react';

export function useAutoSave(saveFn, delay = 3000) {
  const timerRef = useRef(null);
  const saveFnRef = useRef(saveFn);

  useEffect(() => {
    saveFnRef.current = saveFn;
  });

  const triggerSave = useCallback((value) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      saveFnRef.current(value);
    }, delay);
  }, [delay]);

  const flushSave = useCallback((value) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    return saveFnRef.current(value);
  }, []);

  return { triggerSave, flushSave };
}
