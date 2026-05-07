/**
 * useShortcuts — React hook for context-aware keyboard shortcuts.
 *
 * Registers a `keydown` listener on mount and removes it on unmount.
 * Determines the active scope from the provided parameter and delegates
 * to `shortcutRegistry.handleKeyDown()`.
 */

import { useEffect } from 'react';
import { shortcutRegistry } from './registry';

/**
 * Attach keyboard shortcut handling for the given scope.
 *
 * - `'global'` scope should be used in the root layout so that
 *   global shortcuts fire everywhere.
 * - Route-specific scopes (`'board'`, `'chat'`, `'ide'`) should be
 *   used in the corresponding route component so that scoped shortcuts
 *   activate only while that route is mounted.
 */
export function useShortcuts(scope: string): void {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      shortcutRegistry.handleKeyDown(event, scope);
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [scope]);
}
