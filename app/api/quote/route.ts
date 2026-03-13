import { NextRequest, NextResponse } from 'next/server';

const TWELVE_DATA_KEY = '0a5d85ed50034ae2a02fbbd043328d30';
const POLYGON_KEY     = 'ZDgLz1qkTLYHhnMMvbzDk67iB1D4g1YV';

function toTDSymbol(ticker: string, type: string): string {
  if (type === 'fx' && ticker.length === 6) {
    return `${ticker.slice(0, 3)}/${ticker.slice(3)}`;
  }
  if (type === 'crypto' && ticker.endsWith('USD') && ticker.length > 3) {
    return `${ticker.slice(0, -3)}/USD`;
  }
  return ticker;
}

async function quoteTwelveData(ticker: string, type: string): Promise<number> {
  const symbol = toTDSymbol(ticker, type);
  const url = `https://api.twelvedata.com/price?symbol=${encodeURIComponent(symbol)}&apikey=${TWELVE_DATA_KEY}`;
  const res  = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`TD quote HTTP ${res.status}`);
  const json = await res.json();
  if (json.status === 'error') throw new Error(json.message);
  if (!json.price) throw new Error('TD: no price field');
  return parseFloat(json.price);
}

async function quotePolygon(ticker: string, type: string): Promise<number> {
  let url: string;
  if (type === 'crypto') {
    url = `https://api.polygon.io/v2/last/trade/X:${ticker}?apiKey=${POLYGON_KEY}`;
  } else if (type === 'stock') {
    url = `https://api.polygon.io/v2/last/trade/${ticker}?apiKey=${POLYGON_KEY}`;
  } else {
    throw new Error('Polygon quote not supported for forex');
  }
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Polygon quote HTTP ${res.status}`);
  const json = await res.json();
  const price = json.results?.p ?? json.last?.price;
  if (!price) throw new Error('Polygon: no price');
  return price as number;
}

const FALLBACK_PRICES: Record<string, number> = {
  EURUSD: 1.0845, GBPUSD: 1.2710, USDJPY: 149.50, USDCAD: 1.3520,
  AUDUSD: 0.6540, XAUUSD: 2340, BTCUSD: 67500, ETHUSD: 3520,
  SOLUSD: 182, AAPL: 189, TSLA: 175, NVDA: 850,
};

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const ticker = (searchParams.get('ticker') ?? '').toUpperCase();
  const type   = searchParams.get('type') ?? 'fx';

  if (!ticker) {
    return NextResponse.json({ error: 'ticker required' }, { status: 400 });
  }

  if (type === 'crypto' || type === 'stock') {
    try {
      const price = await quotePolygon(ticker, type);
      return NextResponse.json({ price, source: 'polygon' });
    } catch {
      try {
        const price = await quoteTwelveData(ticker, type);
        return NextResponse.json({ price, source: 'twelvedata' });
      } catch {
        // fall through to static fallback
      }
    }
  } else {
    try {
      const price = await quoteTwelveData(ticker, type);
      return NextResponse.json({ price, source: 'twelvedata' });
    } catch {
      try {
        const price = await quotePolygon(ticker, type);
        return NextResponse.json({ price, source: 'polygon' });
      } catch {
        // fall through to static fallback
      }
    }
  }

  const fallback = FALLBACK_PRICES[ticker] ?? 1.0;
  return NextResponse.json({ price: fallback, source: 'static' });
}
