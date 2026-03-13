import { OHLCVBar } from './types';

export function generateMockOHLCV(
  count: number = 100,
  basePrice: number = 50000,
  startTime: number = Date.now() - count * 60 * 1000
): OHLCVBar[] {
  const bars: OHLCVBar[] = [];
  let price = basePrice;

  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.5) * price * 0.02;
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * price * 0.005;
    const low = Math.min(open, close) - Math.random() * price * 0.005;
    const volume = Math.random() * 1000 + 100;

    bars.push({
      time: Math.floor((startTime + i * 60 * 1000) / 1000),
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume: parseFloat(volume.toFixed(2)),
    });

    price = close;
  }

  return bars;
}

export const mockOHLCV = generateMockOHLCV();
