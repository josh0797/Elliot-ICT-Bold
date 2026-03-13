'use client';

import { Signal } from '@/lib/types';

interface SignalPanelProps {
  signals?: Signal[];
}

export default function SignalPanel({ signals = [] }: SignalPanelProps) {
  return (
    <div
      className="flex flex-col w-full h-full"
      style={{ background: '#0D0E14', border: '1px solid #1E2130' }}
    >
      <div
        className="px-4 py-3 border-b text-sm font-semibold text-white"
        style={{ borderColor: '#1E2130' }}
      >
        Signals
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {signals.length === 0 ? (
          <div
            className="flex items-center justify-center h-full text-xs"
            style={{ color: '#758696' }}
          >
            No signals available
          </div>
        ) : (
          signals.map((signal) => (
            <div
              key={signal.id}
              className="p-3 rounded text-xs space-y-1"
              style={{ background: '#131722' }}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white">{signal.symbol}</span>
                <span
                  className="px-2 py-0.5 rounded font-medium"
                  style={{
                    background:
                      signal.side === 'long'
                        ? 'rgba(38,166,154,0.15)'
                        : 'rgba(239,83,80,0.15)',
                    color: signal.side === 'long' ? '#26A69A' : '#EF5350',
                  }}
                >
                  {signal.side.toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between" style={{ color: '#758696' }}>
                <span>Entry</span>
                <span style={{ color: '#D1D4DC' }}>{signal.entryPrice.toLocaleString()}</span>
              </div>
              <div className="flex justify-between" style={{ color: '#758696' }}>
                <span>SL</span>
                <span style={{ color: '#EF5350' }}>{signal.stopLoss.toLocaleString()}</span>
              </div>
              <div className="flex justify-between" style={{ color: '#758696' }}>
                <span>TP</span>
                <span style={{ color: '#26A69A' }}>{signal.takeProfit.toLocaleString()}</span>
              </div>
              <div className="flex justify-between" style={{ color: '#758696' }}>
                <span>Confidence</span>
                <span style={{ color: '#D1D4DC' }}>
                  {(signal.confidence * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
