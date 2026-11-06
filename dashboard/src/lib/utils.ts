import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function shortHash(value: string | null | undefined, head = 10, tail = 6): string {
  if (!value) return '-';
  return value.length > head + tail + 3 ? `${value.slice(0, head)}…${value.slice(-tail)}` : value;
}

export function daysLeft(iso: string | null | undefined): string {
  if (!iso) return '—';
  const days = Math.round((Date.parse(iso) - Date.now()) / 86_400_000);
  if (days < 0) return `expired ${Math.abs(days)} d ago`;
  if (days === 0) return 'expires today';
  return `${days} days left`;
}
