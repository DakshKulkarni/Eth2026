import { useSyncExternalStore } from 'react';

export const THEMES = [
  { id: 'graphite', label: 'Graphite', swatch: ['#f5a800', '#141615'] },
  { id: 'blueprint', label: 'Blueprint', swatch: ['#6cc6ff', '#0c1c2b'] },
  { id: 'paper', label: 'Paper', swatch: ['#c47f00', '#f8f7f3'] },
] as const;
export type ThemeId = (typeof THEMES)[number]['id'];

const listeners = new Set<() => void>();
const known = THEMES.map((t) => t.id as string);
const initial = document.documentElement.dataset.theme ?? '';
let current: ThemeId = (known.includes(initial) ? initial : 'graphite') as ThemeId;
document.documentElement.dataset.theme = current;

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
