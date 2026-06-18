'use client';

import { useState, useEffect } from 'react';
import { RailwaySignal } from '@/lib/types';

interface RiskPanelProps {
  signal: RailwaySignal | null;
  ticker: string;
}

const PIP: Record<string, number> = {
  EURUSD: 0.0001, GBPUSD: 0.0001, USDJPY: 0.01,
  USDCAD: 0.0001, AUDUSD: 0.0001, XAUUSD: 0.1,
  BTCUSD: 1, ETHUSD: 0.1, SOLUSD: 0.01,
  AAPL: 0.01, TSLA: 0.01, NVDA: 0.01,
};

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs" style={{ color: '#758696' }}>{label}</span>
      <span className="text-xs font-semibold" style={{ color: color ?? '#D1D4DC' }}>{value}</span>
    </div>
  );
}

export default function RiskPanel({ signal, ticker }: RiskPanelProps) {
  const [capital,    setCapital]    = useState(10000);
  const [riskPct,    setRiskPct]    = useState(1.0);
  const [dailyLosses, setDailyLosses] = useState(0);
  const maxDailyRisk = capital * 0.05;

  const pip = PIP[ticker] ?? 0.01;
  const entry = signal?.entry ?? null;
  const sl    = signal?.sl    ?? null;
  const tp1   = signal?.tp1   ?? null;

  const riskDollars   = capital * (riskPct / 100);
  const slPips        = entry && sl  ? Math.abs(entry - sl)  / pip : 0;
  const tp1Pips       = entry && tp1 ? Math.abs(tp1 - entry) / pip : 0;
  const lotSize       = slPips > 0 ? riskDollars / (slPips * 10) : 0;
  const rrRatio       = slPips > 0 ? (tp1Pips / slPips).toFixed(1) : '—';
  const maxReached    = dailyLosses >= maxDailyRisk;

  useEffect(() => {
    setDailyLosses(0);
  }, [ticker]);

  return (
    <div
      className="flex flex-col w-full h-full overflow-y-auto"
      style={{ background: '#0D0E14', border: '1px solid #1E2130' }}
    >
      <div
        className="px-4 py-3 border-b text-sm font-semibold text-white shrink-0"
        style={{ borderColor: '#1E2130' }}
      >
        Risk Management
      </div>

      <div className="p-3 space-y-3 text-xs">

        {maxReached && (
          <div
            className="rounded px-3 py-2 text-xs font-semibold text-center"
            style={{ background: 'rgba(239,83,80,0.15)', color: '#EF5350', border: '1px solid rgba(239,83,80,0.3)' }}
          >
            Max daily risk reached
          </div>
        )}

        {/* Capital input */}
        <div className="space-y-1">
          <label className="text-xs" style={{ color: '#758696' }}>Capital ($)</label>
          <input
            type="number"
            value={capital}
            onChange={(e) => setCapital(Math.max(100, Number(e.target.value)))}
            className="w-full rounded px-2 py-1 text-xs outline-none"
            style={{
              background: '#131722', border: '1px solid #1E2130',
              color: '#D1D4DC', fontVariantNumeric: 'tabular-nums',
            }}
          />
        </div>

        {/* Risk % slider */}
        <div className="space-y-1">
          <div className="flex justify-between">
            <label className="text-xs" style={{ color: '#758696' }}>Risk (%)</label>
            <span className="text-xs font-semibold" style={{ color: '#D1D4DC' }}>{riskPct.toFixed(1)}%</span>
          </div>
          <input
            type="range"
            min={0.1} max={5} step={0.1}
            value={riskPct}
            onChange={(e) => setRiskPct(Number(e.target.value))}
            className="w-full"
            style={{ accentColor: '#26A69A' }}
          />
        </div>

        {/* Calculated fields */}
        <div className="rounded p-3 space-y-2" style={{ background: '#131722' }}>
          <Row label="Risk $"   value={`$${riskDollars.toFixed(2)}`}                 color="#ffd166" />
          <Row label="Pips SL"  value={slPips  > 0 ? slPips.toFixed(1)  : '—'} />
          <Row label="Pips TP1" value={tp1Pips > 0 ? tp1Pips.toFixed(1) : '—'} color="#26A69A" />
          <Row label="Lot size" value={lotSize > 0 ? lotSize.toFixed(2) : '—'}  color="#D1D4DC" />
          <Row
            label="R/R setup"
            value={rrRatio !== '—' ? `1:${rrRatio}` : '—'}
            color={rrRatio !== '—' && Number(rrRatio) >= 2 ? '#26A69A' : '#D1D4DC'}
          />
        </div>

        {/* Daily loss tracker */}
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-xs" style={{ color: '#758696' }}>Daily P&L ($)</span>
            <div className="flex gap-1">
              <button
                onClick={() => setDailyLosses((p) => Math.min(p + riskDollars, maxDailyRisk * 2))}
                className="rounded px-1.5 py-0.5 text-xs"
                style={{ background: 'rgba(239,83,80,0.15)', color: '#EF5350', border: '1px solid rgba(239,83,80,0.25)' }}
              >
                −
              </button>
              <button
                onClick={() => setDailyLosses((p) => Math.max(0, p - riskDollars))}
                className="rounded px-1.5 py-0.5 text-xs"
                style={{ background: 'rgba(38,166,154,0.15)', color: '#26A69A', border: '1px solid rgba(38,166,154,0.25)' }}
              >
                +
              </button>
            </div>
          </div>
          <div
            className="rounded overflow-hidden"
            style={{ background: '#131722', height: 6 }}
          >
            <div
              style={{
                height: '100%',
                width: `${Math.min(100, (dailyLosses / maxDailyRisk) * 100)}%`,
                background: dailyLosses >= maxDailyRisk * 0.8 ? '#EF5350' : '#26A69A',
                transition: 'width 0.3s, background 0.3s',
              }}
            />
          </div>
          <div className="flex justify-between text-xs" style={{ color: '#758696' }}>
            <span>-${dailyLosses.toFixed(0)}</span>
            <span>max -${maxDailyRisk.toFixed(0)}</span>
          </div>
        </div>

      </div>
    </div>
  );
}
