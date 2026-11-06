import { Agent, fetch as undiciFetch } from 'undici';

type Init = NonNullable<Parameters<typeof undiciFetch>[1]>;
type Res = Awaited<ReturnType<typeof undiciFetch>>;

const shared = new Agent({ connect: { timeout: 2500 }, keepAliveTimeout: 20000 });
const MAX_ATTEMPTS = 6;

function transient(err: unknown): boolean {
  const e = err as { name?: string; cause?: { code?: string } } | null;
  const code = e?.cause?.code;
  return e?.name === 'TimeoutError' || code === 'UND_ERR_CONNECT_TIMEOUT' || code === 'ECONNRESET' || code === 'EAI_AGAIN' || code === 'UND_ERR_SOCKET';
}

// This network sometimes stalls a connection for ten seconds or more. A normal 0G reply takes
// one to five seconds, so a stalled attempt is abandoned and retried on a fresh connection.
// The request is only repeated when no response arrived, and every attempt is bounded by the caller's overall signal.
export async function zgFetch(url: string, init: Init, attemptMs: number): Promise<Res> {
  const overall = init.signal as AbortSignal | null | undefined;
  for (let attempt = 1; ; attempt++) {
    const fresh = attempt > 1 ? new Agent({ connect: { timeout: 2500 }, keepAliveTimeout: 1 }) : shared;
    const signal = overall ? AbortSignal.any([overall, AbortSignal.timeout(attemptMs)]) : AbortSignal.timeout(attemptMs);
    try {
      return await undiciFetch(url, { ...init, signal, dispatcher: fresh });
    } catch (err) {
      if (attempt >= MAX_ATTEMPTS || overall?.aborted || !transient(err)) throw err;
    }
  }
}

// Some networks drop a connection that has been idle for around ten seconds. A small request every few
// seconds keeps the shared connection alive so the next real call does not need a new one.
let warmTimer: NodeJS.Timeout | undefined;
export function keepWarm(url: string, apiKey: string | undefined): void {
  if (warmTimer || !apiKey) return;
  const ping = () => undiciFetch(url, { headers: { Authorization: `Bearer ${apiKey}` }, dispatcher: shared, signal: AbortSignal.timeout(4000) }).then((r) => r.arrayBuffer()).catch(() => undefined);
  void ping();
  warmTimer = setInterval(ping, 4000);
  warmTimer.unref();
}
