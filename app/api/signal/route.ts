import { NextRequest, NextResponse } from 'next/server';

const RAILWAY_URL = 'https://elliot-ict-bold-production.up.railway.app';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol    = searchParams.get('symbol')    ?? 'EUR/USD';
  const timeframe = searchParams.get('timeframe') ?? '1h';

  try {
    const res = await fetch(
      `${RAILWAY_URL}/api/signal?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}`,
      { next: { revalidate: 60 } }
    );
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: 'Backend unavailable' }, { status: 502 });
  }
}