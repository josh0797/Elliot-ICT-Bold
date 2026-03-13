import { Signal } from './types';

export const mockSignals: Signal[] = [
  {
    id: 'sig-001',
    symbol: 'BTC/USD',
    side: 'long',
    entryPrice: 48500,
    stopLoss: 47000,
    takeProfit: 52000,
    confidence: 0.82,
    timestamp: Date.now() - 3600000,
    status: 'active',
  },
  {
    id: 'sig-002',
    symbol: 'ETH/USD',
    side: 'short',
    entryPrice: 2650,
    stopLoss: 2800,
    takeProfit: 2400,
    confidence: 0.71,
    timestamp: Date.now() - 7200000,
    status: 'pending',
  },
  {
    id: 'sig-003',
    symbol: 'BTC/USD',
    side: 'long',
    entryPrice: 46200,
    stopLoss: 45000,
    takeProfit: 49500,
    confidence: 0.91,
    timestamp: Date.now() - 86400000,
    status: 'closed',
  },
];
