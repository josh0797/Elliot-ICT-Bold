const MAX_CALLS_PER_MINUTE = 6;
const WINDOW_MS = 60_000;

const callTimestamps: number[] = [];
const pendingByKey = new Map<string, AbortController>();

function countRecentCalls(): number {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  while (callTimestamps.length > 0 && callTimestamps[0]! < cutoff) {
    callTimestamps.shift();
  }
  return callTimestamps.length;
}

function msUntilSlotAvailable(): number {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  while (callTimestamps.length > 0 && callTimestamps[0]! < cutoff) {
    callTimestamps.shift();
  }
  if (callTimestamps.length < MAX_CALLS_PER_MINUTE) return 0;
  const oldest = callTimestamps[0]!;
  return oldest + WINDOW_MS - now + 50;
}

function recordCall() {
  callTimestamps.push(Date.now());
}

export type QueuedFetchResult<T> =
  | { status: 'ok'; data: T }
  | { status: 'throttled' }
  | { status: 'cancelled' }
  | { status: 'error'; error: unknown };

export async function queuedFetch<T>(
  key: string,
  fn: (signal: AbortSignal) => Promise<T>,
  onThrottleChange?: (throttled: boolean) => void,
): Promise<QueuedFetchResult<T>> {
  const existing = pendingByKey.get(key);
  if (existing) {
    existing.abort();
  }

  const controller = new AbortController();
  pendingByKey.set(key, controller);

  const wait = msUntilSlotAvailable();
  if (wait > 0) {
    onThrottleChange?.(true);
    await new Promise<void>((resolve) => setTimeout(resolve, wait));
    onThrottleChange?.(false);
  }

  if (controller.signal.aborted) {
    pendingByKey.delete(key);
    return { status: 'cancelled' };
  }

  if (countRecentCalls() >= MAX_CALLS_PER_MINUTE) {
    pendingByKey.delete(key);
    return { status: 'throttled' };
  }

  recordCall();

  try {
    const data = await fn(controller.signal);
    pendingByKey.delete(key);
    return { status: 'ok', data };
  } catch (error) {
    pendingByKey.delete(key);
    if (controller.signal.aborted) {
      return { status: 'cancelled' };
    }
    return { status: 'error', error };
  }
}

export function cancelPending(key: string) {
  const ctrl = pendingByKey.get(key);
  if (ctrl) {
    ctrl.abort();
    pendingByKey.delete(key);
  }
}
