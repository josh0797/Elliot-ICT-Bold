'use client';

import { useEffect, useState } from 'react';
import { RailwaySignal } from '@/lib/types';

interface SignalPanelProps {
  symbol:    string;
  timeframe: string;
}

const SIGNAL_COLORS: Record<string, { bg: string; color: string }> = {
  BUY_LIMIT:  { bg: 'rgba(38,166,154,0.15)',  color: '#26A69A' },
  BUY_STOP:   { bg: 'rgba(38,166,154,0.10)',  color: '#26A69A' },
  SELL_LIMIT: { bg: 'rgba(239,83,80,0.15)',   color: '#EF5350' },
  SELL_STOP:  { bg: 'rgba(239,83,80,0.10)',   color: '#EF5350' },
  NO_SIGNAL:  { bg: 'rgba(117,134,150,0.15)', color: '#758696' },
};

export default function SignalPanel({ symbol, timeframe }: SignalPanelProps) {
  const [data,    setData]    = useState<RailwaySignal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/signal?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => { setError('Error fetching signal'); setLoading(false); });
  }, [symbol, timeframe]);

  const colors = SIGNAL_COLORS[data?.signal_type ?? 'NO_SIGNAL'];

  return (
    <div
      className="flex flex-col w-full h-full overflow-y-auto"
      style={{ background: '#0D0E14', border: '1px solid #1E2130' }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 border-b text-sm font-semibold text-white flex items-center justify-between shrink-0"
        style={{ borderColor: '#1E2130' }}
      >
        <span>Signal</span>
        {data?.ict?.kill_zone && (
          <span
            className="text-xs px-2 py-0.5 rounded"
            style={{ background: 'rgba(255,209,102,0.15)', color: '#ffd166' }}
          >
            🕐 {data.ict.kill_zone}
          </span>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center flex-1 text-xs" style={{ color: '#758696' }}>
          Analyzing...
        </div>
      )}

      {error && (
        <div className="flex items-center justify-center flex-1 text-xs" style={{ color: '#EF5350' }}>
          {error}
        </div>
      )}

      {!loading && !error && data && (
        <div className="p-3 space-y-3 text-xs">

          {/* Signal Type Badge */}
          <div className="flex items-center justify-between">
            <span
              className="px-3 py-1 rounded font-bold text-sm"
              style={{ background: colors.bg, color: colors.color }}
            >
              {(data.signal_type ?? 'NO_SIGNAL').replace(/_/g, ' ')}
            </span>
            <span style={{ color: '#758696' }}>
              Conf: <span style={{ color: '#D1D4DC', fontWeight: 600 }}>
                {(data.confidence * 100).toFixed(0)}%
              </span>
            </span>
          </div>

          {/* Entry / SL / TP */}
          {data.signal_type !== 'NO_SIGNAL' && (
            <div
              className="rounded p-3 space-y-2"
              style={{ background: '#131722' }}
            >
              <Row label="Entry"  value={data.entry?.toFixed(5) ?? '—'} color="#D1D4DC" />
              <Row label="SL"     value={data.sl?.toFixed(5)    ?? '—'} color="#EF5350" />
              <Row label="TP1"    value={data.tp1?.toFixed(5)   ?? '—'} color="#26A69A" />
              <Row label="TP2"    value={data.tp2?.toFixed(5)   ?? '—'} color="#26A69A" />
              <Row label="R/R"    value={`${data.risk_reward}x`}         color="#D1D4DC" />
            </div>
          )}

          {/* Elliott Wave */}
          {data.elliott?.wave_type && (
            <div className="rounded p-3 space-y-2" style={{ background: '#131722' }}>
              <div className="font-semibold" style={{ color: '#758696' }}>Elliott Wave</div>
              <Row label="Type"        value={data.elliott.wave_type}            color="#D1D4DC" />
              <Row label="Bias"        value={data.elliott.bias ?? '—'}          color={data.elliott.bias === 'bullish' ? '#26A69A' : '#EF5350'} />
              <Row label="Wave"        value={String(data.elliott.current_wave)} color="#D1D4DC" />
              <Row
                label="Invalidation"
                value={data.elliott.invalidation_line?.toFixed(5) ?? '—'}
                color="#ffd166"
              />
              {data.elliott.waves.length > 0 && (
                <div className="pt-1" style={{ color: '#758696' }}>
                  Waves: {data.elliott.waves.map((w) => (
                    <span key={w.label} className="mr-2">
                      <span style={{ color: '#D1D4DC' }}>{w.label}</span>
                      <span style={{ color: '#758696' }}> {w.price.toFixed(5)}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ICT */}
          <div className="rounded p-3 space-y-2" style={{ background: '#131722' }}>
            <div className="font-semibold" style={{ color: '#758696' }}>ICT</div>
            <Row label="Order Blocks" value={String(data.ict.order_blocks.length)} color="#D1D4DC" />
            <Row label="FVGs"         value={String(data.ict.fvgs.length)}          color="#D1D4DC" />
            {data.ict.order_blocks.slice(-2).map((ob, i) => (
              <div key={i} style={{ color: ob.type === 'bullish_ob' ? '#26A69A' : '#EF5350' }}>
                {ob.type === 'bullish_ob' ? '▲' : '▼'} OB {ob.bottom.toFixed(5)} – {ob.top.toFixed(5)}
              </div>
            ))}
            {data.ict.fvgs.slice(-2).map((fvg, i) => (
              <div key={i} style={{ color: fvg.type === 'bullish_fvg' ? '#26A69A' : '#EF5350' }}>
                {fvg.type === 'bullish_fvg' ? '▲' : '▼'} FVG {fvg.bottom.toFixed(5)} – {fvg.top.toFixed(5)}
              </div>
            ))}
          </div>

          {/* Reasons */}
          {data.reason.length > 0 && (
            <div className="rounded p-3 space-y-1" style={{ background: '#131722' }}>
              <div className="font-semibold mb-1" style={{ color: '#758696' }}>Reasoning</div>
              {data.reason.map((r, i) => (
                <div key={i} style={{ color: '#D1D4DC' }}>• {r}</div>
              ))}
            </div>
          )}

        </div>
      )}
    </div>
  );
}

function Row({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex justify-between">
      <span style={{ color: '#758696' }}>{label}</span>
      <span style={{ color, fontWeight: 600 }}>{value}</span>
    </div>
  );
}
