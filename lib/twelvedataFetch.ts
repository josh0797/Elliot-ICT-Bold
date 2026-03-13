import { OHLCVBar } from './types';

const INTERVAL_MAP: Record<string, string> = {
  '15min': '15min',
  '1h':    '1h',
  '1day':  '1day',
  '1week': '1week',
};

function toTDSymbol(ticker: string, type: string): string {
  if (type === 'fx' && ticker.length === 6) {
    return `${ticker.slice(0, 3)}/${ticker.slice(3)}`;
  }
  if (type === 'crypto' && ticker.endsWith('USD') && ticker.length > 3) {
    return `${ticker.slice(0, -3)}/USD`;
  }
  return ticker;
}

export async function fetchTwelveData(
  ticker: string,
  type: string,
  tf: string,
  apiKey: string,
): Promise<OHLCVBar[]> {
  const interval = INTERVAL_MAP[tf];
  if (!interval) throw new Error(`Unknown timeframe: ${tf}`);

  const symbol = toTDSymbol(ticker, type);

  const url = new URL('https://api.twelvedata.com/time_series');
  url.searchParams.set('symbol', symbol);
  url.searchParams.set('interval', interval);
  url.searchParams.set('outputsize', '100');
  url.searchParams.set('apikey', apiKey);

  console.log('[TD] URL:', url.toString().replace(apiKey, '***'));

  const res = await fetch(url.toString(), { cache: 'no-store' });
  console.log('[TD] HTTP status:', res.status);
  if (!res.ok) throw new Error(`TwelveData HTTP ${res.status}`);

  const json = await res.json();
  console.log('[TD] status:', json.status ?? '(none)', '| values count:', json.values?.length ?? 0, json.message ? `| message: ${json.message}` : '');
  if (json.status === 'error') throw new Error(`TwelveData: ${json.message}`);
  if (!Array.isArray(json.values) || json.values.length === 0) {
    throw new Error('TwelveData: no values returned');
  }

  const sorted = [...json.values].reverse();

  return sorted.map((v: Record<string, string>) => ({
    time:   Math.floor(new Date(v.datetime).getTime() / 1000),
    open:   parseFloat(v.open),
    high:   parseFloat(v.high),
    low:    parseFloat(v.low),
    close:  parseFloat(v.close),
    volume: parseFloat(v.volume ?? '0'),
  }));
}

export async function fetchTwelveDataQuote(
  ticker: string,
  type: string,
  apiKey: string,
): Promise<number> {
  const symbol = toTDSymbol(ticker, type);

  const url = new URL('https://api.twelvedata.com/price');
  url.searchParams.set('symbol', symbol);
  url.searchParams.set('apikey', apiKey);

  console.log('[TD] Quote URL:', url.toString().replace(apiKey, '***'));

  const res = await fetch(url.toString(), { cache: 'no-store' });
  console.log('[TD] Quote HTTP status:', res.status);
  if (!res.ok) throw new Error(`TwelveData quote HTTP ${res.status}`);

  const json = await res.json();
  console.log('[TD] Quote response:', JSON.stringify(json));
  if (json.status === 'error') throw new Error(`TwelveData quote: ${json.message}`);
  if (!json.price) throw new Error('TwelveData: no price');

  return parseFloat(json.price);
}
