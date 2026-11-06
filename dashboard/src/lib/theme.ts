import { useSyncExternalStore } from 'react';

export const THEMES = [
  { id: 'aurora', label: 'Aurora', swatch: ['#b794ff', '#2b1270'] },
  { id: 'forge', label: 'Forge', swatch: ['#ffb43a', '#5c3604'] },
  { id: 'mint', label: 'Mint', swatch: ['#4be59a', '#054b3a'] },
] as const;
export type ThemeId = (typeof THEMES)[number]['id'];

const listeners = new Set<() => void>();
let current: ThemeId = (document.documentElement.dataset.theme as ThemeId) || 'aurora';

export function setTheme(id: ThemeId): void {
  current = id;
  document.documentElement.dataset.theme = id;
  try {
    localStorage.setItem('pd-theme', id);
  } catch {
    // storage can be blocked; the theme still applies for this visit
  }
  listeners.forEach((l) => l());
}

export function useTheme(): ThemeId {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
  );
}
