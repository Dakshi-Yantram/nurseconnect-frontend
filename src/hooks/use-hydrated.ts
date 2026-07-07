/**
 * Phase 7B microfix — hydration coordination primitive.
 *
 * Returns `false` during SSR and the first client render, `true` thereafter.
 * Reviewer/trainer surfaces gate time-sensitive renders (SLA-derived queue
 * items, competency review timestamps) behind this flag so the SSR snapshot
 * and the client snapshot always match, eliminating post-hydration crashes
 * caused by `Date.now()` drift inside orchestration queue selectors.
 */
import { useEffect, useState } from "react";

export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => { setHydrated(true); }, []);
  return hydrated;
}
