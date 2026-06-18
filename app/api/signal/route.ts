import { NextRequest, NextResponse } from 'next/server';
import { RailwaySignal } from '@/lib/types';

const RAILWAY_URL = 'https://elliot-ict-bold-production.up.railway.app';

const FALLBACK: RailwaySignal = {
  status:      'unavailable',
  symbol:      '',
  timeframe:   '',
  price:       0,
  timestamp:   new Date().toISOString(),
  signal_type: 'NO_SIGNAL',
  entry:       null,
  sl:          null,
  tp1:         null,
  tp2:         null,
  confidence:  0,
  risk_reward: 0,
  reason:      ['Backend unavailable'],
  elliott: {
    wave_type:         null,
    bias:              null,
    current_wave:      null,
    invalidation_line: null,
    waves:             [],
  },
  ict: {
    order_blocks: [],
    fvgs:         [],
    kill_zone:    null,
  },
  source: 'fallback',
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol    = searchParams.get('symbol')    ?? 'EUR/USD';
  const timeframe = searchParams.get('timeframe') ?? '1h';

  try {
    const res = await fetch(
      `${RAILWAY_URL}/api/signal?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}`,
      { next: { revalidate: 60 }, signal: AbortSignal.timeout(8000) }
    );

    if (!res.ok) {
      return NextResponse.json({ ...FALLBACK, symbol, timeframe });
    }

    const data = await res.json();

    // Guard: if the response doesn't have signal_type it's not a valid signal
    if (!data || typeof data.signal_type !== 'string') {
      return NextResponse.json({ ...FALLBACK, symbol, timeframe });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ ...FALLBACK, symbol, timeframe });
  }
}
