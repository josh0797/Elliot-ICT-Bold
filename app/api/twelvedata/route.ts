import { NextRequest, NextResponse } from 'next/server';
import { fetchTwelveData } from '@/lib/twelvedataFetch';
import { fetchPolygon } from '@/lib/polygonFetch';
import { generateMockOHLCV } from '@/lib/mockOHLCV';

const TWELVE_DATA_KEY = '0a5d85ed50034ae2a02fbbd043328d30';
const POLYGON_KEY     = 'ZDgLz1qkTLYHhnMMvbzDk67iB1D4g1YV';

type Source = 'twelvedata' | 'polygon' | 'demo';

function demoCandles(type: string) {
  const base = type === 'crypto' ? 50000 : type === 'stock' ? 180 : 1.1;
  return generateMockOHLCV(200, base);
}

async function tryTwelveData(ticker: string, type: string, tf: string) {
  return fetchTwelveData(ticker, type, tf, TWELVE_DATA_KEY);
}

async function tryPolygon(ticker: string, type: string, tf: string) {
  return fetchPolygon(ticker, type, tf, POLYGON_KEY);
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const ticker = (searchParams.get('ticker') ?? '').toUpperCase();
  const type   = searchParams.get('type') ?? 'fx';
  const tf     = searchParams.get('tf') ?? '1h';

  if (!ticker) {
    return NextResponse.json({ error: 'ticker required' }, { status: 400 });
  }

  let candles: ReturnType<typeof demoCandles> | undefined;
  let source: Source = 'demo';

  try {
    if (type === 'crypto' || type === 'stock') {
      try {
        candles = await tryPolygon(ticker, type, tf);
        source = 'polygon';
      } catch {
        try {
          candles = await tryTwelveData(ticker, type, tf);
          source = 'twelvedata';
        } catch {
          // fall through to demo
        }
      }
    } else {
      try {
        candles = await tryTwelveData(ticker, type, tf);
        source = 'twelvedata';
      } catch {
        try {
          candles = await tryPolygon(ticker, type, tf);
          source = 'polygon';
        } catch {
          // fall through to demo
        }
      }
    }
  } catch {
    // fall through to demo
  }

  if (!candles || candles.length === 0) {
    candles = demoCandles(type);
    source = 'demo';
  }

  return NextResponse.json({ candles, source });
}
