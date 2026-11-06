import { appendFileSync, mkdirSync } from 'node:fs';
import { publish } from './events.js';

const dir = new URL('../logs/', import.meta.url);
const file = new URL('../logs/activity.log', import.meta.url);

export function activity(event: string, data: Record<string, unknown> = {}): void {
  publish(event, data);
  const line = `${JSON.stringify({ at: new Date().toISOString(), event, ...data })}\n`;
  // Also on stdout, so a host's log viewer (Railway) shows these events. They hold short ids and reasons, never secrets.
  process.stdout.write(`[activity] ${line}`);
  try {
    mkdirSync(dir, { recursive: true });
    appendFileSync(file, line);
  } catch {
    return;
  }
}
