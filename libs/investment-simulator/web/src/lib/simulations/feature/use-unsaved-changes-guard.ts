import { useEffect } from 'react';
import { useBlocker } from 'react-router';

/**
 * Confirms leaving the page while `active`: in-app navigation through the
 * returned blocker, document exits through `beforeunload`. Changing only the
 * query string (such as the selected calculation) stays on the page.
 */
export function useUnsavedChangesGuard(active: boolean) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      active && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (!active) return;
    const confirmExit = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', confirmExit);
    return () => window.removeEventListener('beforeunload', confirmExit);
  }, [active]);

  return blocker;
}
