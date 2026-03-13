import { OHLCVBar } from './types';

const TF_MAP: Record<string, { multiplier: number; timespan: string }> = {
  '15min': { multiplier: 15, timespan: 'minute' },
  '1h':    { multiplier: 1,  timespan: 'hour' },
  '1day':  { multiplier: 1,  timespan: 'day' },
  '1week': { multiplier: 1,  timespan: 'week' },
};

function toPolygonSymbol(ticker: string, type: string): string {
  if (type === 'crypto') return `X:${ticker}`;
  if (type === 'fx') return `C:${ticker}`;
  return ticker;
}

function getDateRange(tf: string): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  if (tf === '15min')     from.setMinutes(from.getMinutes() - 200 * 15);
  else if (tf === '1h')   from.setHours(from.getHours() - 200);
  else if (tf === '1day') from.setDate(from.getDate() - 200);
  else                    from.setDate(from.getDate() - 200 * 7);
  return {
    from: from.toISOString().split('T')[0],
    to:   to.toISOString().split('T')[0],
  };
}

export async function fetchPolygon(
  ticker: string,
  type: string,
  tf: string,
  apiKey: string,
): Promise<OHLCVBar[]> {
  const tfCfg = TF_MAP[tf];
  if (!tfCfg) throw new Error(`Unknown timeframe: ${tf}`);

  const polySym = toPolygonSymbol(ticker, type);
  const { from, to } = getDateRange(tf);

  const url = new URL(
    `https://api.polygon.io/v2/aggs/ticker/${polySym}/range/${tfCfg.multiplier}/${tfCfg.timespan}/${from}/${to}`
  );
  url.searchParams.set('adjusted', 'true');
  url.searchParams.set('sort', 'asc');
  url.searchParams.set('limit', '200');
  url.searchParams.set('apiKey', apiKey);

  console.log('[Polygon] URL:', url.toString().replace(apiKey, '***'));

  const res = await fetch(url.toString(), { cache: 'no-store' });
  console.log('[Polygon] HTTP status:', res.status);
  if (!res.ok) throw new Error(`Polygon HTTP ${res.status}`);

  const json = await res.json();
  console.log('[Polygon] status:', json.status, '| resultsCount:', json.resultsCount ?? json.results?.length ?? 0, json.error ? `| error: ${json.error}` : '', json.message ? `| message: ${json.message}` : '');
  if (json.status === 'ERROR' || !json.results?.length) {
    throw new Error(`Polygon: ${json.error ?? json.message ?? 'no results'}`);
  }

  return (json.results as Array<Record<string, number>>).map((r) => ({
    time:   Math.floor(r.t / 1000),
    open:   r.o,
    high:   r.h,
    low:    r.l,
    close:  r.c,
    volume: r.v ?? 0,
  }));
}
