import { useEffect, useState } from "react";

/**
 * Debounces rapidly-changing values (e.g. text input) to avoid
 * refetch/render storms. Returns the latest value after `delay` ms of quiet.
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}