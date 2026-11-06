import { appendFileSync, mkdirSync } from 'node:fs';

const dir = new URL('../logs/', import.meta.url);
const file = new URL('../logs/activity.log', import.meta.url);

export function activity(event: string, data: Record<string, unknown> = {}): void {
  try {
    mkdirSync(dir, { recursive: true });
    appendFileSync(file, `${JSON.stringify({ at: new Date().toISOString(), event, ...data })}\n`);
  } catch {
    return;
  }
}
