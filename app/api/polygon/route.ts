import { NextRequest, NextResponse } from 'next/server';
import { fetchPolygon } from '@/lib/polygonFetch';
import { generateMockOHLCV } from '@/lib/mockOHLCV';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const ticker = (searchParams.get('ticker') ?? '').toUpperCase();
  const type   = searchParams.get('type') ?? 'stock';
  const tf     = searchParams.get('tf') ?? '1h';

  if (!ticker) {
    return NextResponse.json({ error: 'ticker required' }, { status: 400 });
  }

  const apiKey = process.env.POLYGON_API_KEY ?? process.env.NEXT_PUBLIC_POLYGON_API_KEY ?? '';

  if (!apiKey) {
    const base = type === 'crypto' ? 50000 : 180;
    const candles = generateMockOHLCV(200, base);
    return NextResponse.json({ candles, source: 'demo' });
  }

  try {
    const candles = await fetchPolygon(ticker, type, tf, apiKey);
    return NextResponse.json({ candles, source: 'polygon' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
