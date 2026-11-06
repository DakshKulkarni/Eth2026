import { useSyncExternalStore } from 'react';

export const THEMES = [
  { id: 'lime', label: 'Lime', swatch: ['#d4ff4f', '#111111'] },
  { id: 'cyan', label: 'Cyan', swatch: ['#52e0ff', '#0e141b'] },
  { id: 'light', label: 'Light', swatch: ['#c8f23a', '#ffffff'] },
] as const;
export type ThemeId = (typeof THEMES)[number]['id'];

const listeners = new Set<() => void>();
const known = THEMES.map((t) => t.id as string);
const initial = document.documentElement.dataset.theme ?? '';
let current: ThemeId = (known.includes(initial) ? initial : 'lime') as ThemeId;
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
