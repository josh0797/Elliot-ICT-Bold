'use client';

import { useState } from 'react';
import React from 'react';
import { RailwaySignal } from '@/lib/types';
import { AnalysisResult, StructureContext, TradeSetup } from '@/lib/types';

type Tab = 'signal' | 'elliott' | 'ict' | 'structure' | 'setup';

interface AnalysisPanelProps {
  signal:    RailwaySignal | null;
  analysis:  AnalysisResult | null;
  structure: StructureContext | null;
  setup:     TradeSetup | null;
  loading:   boolean;
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between items-center py-0.5">
      <span style={{ color: '#758696' }}>{label}</span>
      <span style={{ color: color ?? '#D1D4DC', fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-semibold pt-1 pb-0.5" style={{ color: '#758696', borderBottom: '1px solid #1E2130' }}>
      {children}
    </div>
  );
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'signal',    label: 'Signal'    },
  { id: 'elliott',   label: 'Elliott'   },
  { id: 'ict',       label: 'ICT'       },
  { id: 'structure', label: 'Structure' },
  { id: 'setup',     label: 'Setup'     },
];

const SIGNAL_COLORS: Record<string, { bg: string; color: string }> = {
  BUY_LIMIT:  { bg: 'rgba(38,166,154,0.15)',  color: '#26A69A' },
  BUY_STOP:   { bg: 'rgba(38,166,154,0.10)',  color: '#26A69A' },
  SELL_LIMIT: { bg: 'rgba(239,83,80,0.15)',   color: '#EF5350' },
  SELL_STOP:  { bg: 'rgba(239,83,80,0.10)',   color: '#EF5350' },
  NO_SIGNAL:  { bg: 'rgba(117,134,150,0.15)', color: '#758696' },
};

export default function AnalysisPanel({ signal, analysis, structure, setup, loading }: AnalysisPanelProps) {
  const [tab, setTab] = useState<Tab>('signal');

  const sigType = signal?.signal_type ?? 'NO_SIGNAL';
  const colors  = SIGNAL_COLORS[sigType] ?? SIGNAL_COLORS.NO_SIGNAL;

  return (
    <div
      className="flex flex-col w-full h-full overflow-hidden"
      style={{ background: '#0D0E14', border: '1px solid #1E2130' }}
    >
      {/* Tab bar */}
      <div
        className="flex shrink-0 overflow-x-auto"
        style={{ borderBottom: '1px solid #1E2130' }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="px-3 py-2 text-xs font-semibold whitespace-nowrap shrink-0"
            style={{
              color:        tab === t.id ? '#D1D4DC' : '#758696',
              borderBottom: tab === t.id ? '2px solid #26A69A' : '2px solid transparent',
              background:   'transparent',
              cursor:       'pointer',
              transition:   'color 0.15s, border-color 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3 text-xs space-y-2">
        {loading && (
          <div className="flex items-center justify-center py-8" style={{ color: '#758696' }}>
            Analyzing…
          </div>
        )}

        {!loading && tab === 'signal' && signal && (
          <>
            <div className="flex items-center justify-between">
              <span
                className="px-3 py-1 rounded font-bold text-sm"
                style={{ background: colors.bg, color: colors.color }}
              >
                {sigType.replace(/_/g, ' ')}
              </span>
              <span style={{ color: '#758696' }}>
                Conf: <span style={{ color: '#D1D4DC', fontWeight: 600 }}>
                  {(signal.confidence * 100).toFixed(0)}%
                </span>
              </span>
            </div>

            {sigType !== 'NO_SIGNAL' && (
              <div className="rounded p-3 space-y-1.5" style={{ background: '#131722' }}>
                <Row label="Entry"  value={signal.entry?.toFixed(5) ?? '—'} color="#D1D4DC" />
                <Row label="SL"     value={signal.sl?.toFixed(5)    ?? '—'} color="#EF5350" />
                <Row label="TP1"    value={signal.tp1?.toFixed(5)   ?? '—'} color="#26A69A" />
                <Row label="TP2"    value={signal.tp2?.toFixed(5)   ?? '—'} color="#26A69A" />
                <Row label="R/R"    value={`${signal.risk_reward}x`}         color="#D1D4DC" />
              </div>
            )}

            {signal.reason.length > 0 && (
              <div className="rounded p-3 space-y-1" style={{ background: '#131722' }}>
                <SectionTitle>Reasoning</SectionTitle>
                {signal.reason.map((r, i) => (
                  <div key={i} style={{ color: '#D1D4DC' }}>• {r}</div>
                ))}
              </div>
            )}
          </>
        )}

        {!loading && tab === 'elliott' && (
          <>
            {signal?.elliott?.wave_type ? (
              <div className="rounded p-3 space-y-1.5" style={{ background: '#131722' }}>
                <SectionTitle>Elliott Wave</SectionTitle>
                <Row label="Type"        value={signal.elliott.wave_type}             color="#D1D4DC" />
                <Row label="Bias"        value={signal.elliott.bias ?? '—'}           color={signal.elliott.bias === 'bullish' ? '#26A69A' : '#EF5350'} />
                <Row label="Wave"        value={String(signal.elliott.current_wave ?? '—')} color="#D1D4DC" />
                <Row label="Invalidation" value={signal.elliott.invalidation_line?.toFixed(5) ?? '—'} color="#ffd166" />
              </div>
            ) : null}

            {analysis && (
              <div className="rounded p-3 space-y-1.5" style={{ background: '#131722' }}>
                <SectionTitle>Fibonacci (60 bars)</SectionTitle>
                <Row label="SW High"  value={analysis.swH.toFixed(5)} color="#26A69A" />
                <Row label="SW Low"   value={analysis.swL.toFixed(5)} color="#EF5350" />
                <Row label="0.382"    value={analysis.f382.toFixed(5)}  />
                <Row label="0.500"    value={analysis.f500.toFixed(5)}  />
                <Row label="0.618"    value={analysis.f618.toFixed(5)}  />
                <Row label="1.272"    value={analysis.f1272.toFixed(5)} color="#ffd166" />
                <Row label="1.618"    value={analysis.f1618.toFixed(5)} color="#ffd166" />
                <Row label="2.618"    value={analysis.f2618.toFixed(5)} color="#ffd166" />
              </div>
            )}

            {!signal?.elliott?.wave_type && !analysis && (
              <div style={{ color: '#758696' }}>No wave data</div>
            )}
          </>
        )}

        {!loading && tab === 'ict' && signal?.ict && (
          <>
            {signal.ict.kill_zone && (
              <div
                className="rounded px-3 py-1.5 text-xs font-semibold"
                style={{ background: 'rgba(255,209,102,0.1)', color: '#ffd166', border: '1px solid rgba(255,209,102,0.2)' }}
              >
                Kill Zone: {signal.ict.kill_zone}
              </div>
            )}

            <div className="rounded p-3 space-y-1.5" style={{ background: '#131722' }}>
              <SectionTitle>Order Blocks ({signal.ict.order_blocks.length})</SectionTitle>
              {signal.ict.order_blocks.length === 0 && (
                <span style={{ color: '#758696' }}>None detected</span>
              )}
              {signal.ict.order_blocks.map((ob, i) => (
                <div key={i} className="flex justify-between" style={{ color: ob.type === 'bullish_ob' ? '#26A69A' : '#EF5350' }}>
                  <span>{ob.type === 'bullish_ob' ? '▲ Bull OB' : '▼ Bear OB'}</span>
                  <span>{ob.bottom.toFixed(5)} – {ob.top.toFixed(5)}</span>
                </div>
              ))}
            </div>

            <div className="rounded p-3 space-y-1.5" style={{ background: '#131722' }}>
              <SectionTitle>FVGs ({signal.ict.fvgs.length})</SectionTitle>
              {signal.ict.fvgs.length === 0 && (
                <span style={{ color: '#758696' }}>None detected</span>
              )}
              {signal.ict.fvgs.map((fvg, i) => (
                <div key={i} className="flex justify-between" style={{ color: fvg.type === 'bullish_fvg' ? '#26A69A' : '#EF5350' }}>
                  <span>{fvg.type === 'bullish_fvg' ? '▲ Bull FVG' : '▼ Bear FVG'}</span>
                  <span>{fvg.bottom.toFixed(5)} – {fvg.top.toFixed(5)}</span>
                </div>
              ))}
            </div>

            {analysis && (
              <div className="rounded p-3 space-y-1.5" style={{ background: '#131722' }}>
                <SectionTitle>ICT Confluence</SectionTitle>
                <Row label="Score"     value={`${analysis.score}/10`} color={analysis.score >= 7 ? '#26A69A' : '#ffd166'} />
                <Row label="Trend"     value={analysis.trend}         color={analysis.bull ? '#26A69A' : '#EF5350'} />
                <Row label="Near OB"   value={analysis.nearOB  ? 'Yes' : 'No'} color={analysis.nearOB  ? '#26A69A' : '#758696'} />
                <Row label="Near FVG"  value={analysis.nearFVG ? 'Yes' : 'No'} color={analysis.nearFVG ? '#26A69A' : '#758696'} />
                <Row label="Liquidity" value={analysis.hasLiq  ? 'Yes' : 'No'} color={analysis.hasLiq  ? '#ffd166' : '#758696'} />
              </div>
            )}
          </>
        )}

        {!loading && tab === 'structure' && (
          <>
            {structure ? (
              <>
                <div className="rounded p-3 space-y-1.5" style={{ background: '#131722' }}>
                  <SectionTitle>Market Structure</SectionTitle>
                  <Row
                    label="Structure"
                    value={structure.structure.toUpperCase()}
                    color={structure.structure === 'bullish' ? '#26A69A' : structure.structure === 'bearish' ? '#EF5350' : '#758696'}
                  />
                  {structure.lastSweep && (
                    <>
                      <Row label="Last Sweep"   value={structure.lastSweep.type.toUpperCase()} color="#ffd166" />
                      <Row label="Session"      value={structure.lastSweep.sessionName} />
                      <Row label="FVG confirm" value={structure.lastSweep.fvgConfirmed ? 'Yes' : 'No'} color={structure.lastSweep.fvgConfirmed ? '#26A69A' : '#758696'} />
                    </>
                  )}
                </div>

                <div className="rounded p-3 space-y-1.5" style={{ background: '#131722' }}>
                  <SectionTitle>BOS / CHoCH</SectionTitle>
                  {structure.lastBOS ? (
                    <>
                      <Row label="Last BOS"    value={structure.lastBOS.type.toUpperCase()}         color={structure.lastBOS.type === 'bull' ? '#26A69A' : '#EF5350'} />
                      <Row label="BOS Quality" value={structure.lastBOS.quality.toUpperCase()}      color={structure.lastBOS.quality === 'high' ? '#26A69A' : '#ffd166'} />
                      <Row label="Confirmed"   value={structure.lastBOS.confirmed ? 'Yes' : 'No'}   />
                    </>
                  ) : <span style={{ color: '#758696' }}>No BOS</span>}

                  {structure.lastCHoCH && (
                    <>
                      <div className="pt-1" />
                      <Row label="Last CHoCH"  value={structure.lastCHoCH.type.toUpperCase()}       color={structure.lastCHoCH.type === 'bull' ? '#26A69A' : '#EF5350'} />
                      <Row label="CHoCH conf." value={structure.lastCHoCH.confirmed ? 'Yes' : 'No'} color={structure.lastCHoCH.confirmed ? '#26A69A' : '#758696'} />
                    </>
                  )}
                </div>
              </>
            ) : (
              <div style={{ color: '#758696' }}>Load chart data to see structure</div>
            )}
          </>
        )}

        {!loading && tab === 'setup' && (
          <>
            {setup ? (
              <>
                <div className="flex items-center justify-between">
                  <span
                    className="px-2 py-0.5 rounded text-xs font-bold uppercase"
                    style={{
                      background: setup.type === 'buy' ? 'rgba(38,166,154,0.15)' : 'rgba(239,83,80,0.15)',
                      color:      setup.type === 'buy' ? '#26A69A' : '#EF5350',
                    }}
                  >
                    {setup.type.toUpperCase()} · {setup.setupType}
                  </span>
                  <span
                    className="px-2 py-0.5 rounded text-xs font-bold"
                    style={{
                      background: setup.uiState === 'active' ? 'rgba(38,166,154,0.15)' : 'rgba(255,209,102,0.1)',
                      color:      setup.uiState === 'active' ? '#26A69A' : '#ffd166',
                    }}
                  >
                    {setup.uiState.replace(/_/g, ' ').toUpperCase()}
                  </span>
                </div>

                <div className="rounded p-3 space-y-1.5" style={{ background: '#131722' }}>
                  <SectionTitle>Setup Institucional</SectionTitle>
                  <Row label="Entry"  value={String(setup.entry)}  color="#D1D4DC" />
                  <Row label="SL"     value={String(setup.sl)}     color="#EF5350" />
                  <Row label="TP1"    value={String(setup.tp1)}    color="#26A69A" />
                  <Row label="TP2"    value={String(setup.tp2)}    color="#26A69A" />
                  <Row label="TP3"    value={String(setup.tp3)}    color="#26A69A" />
                  <Row label="R/R"    value={setup.rr}             color="#D1D4DC" />
                  <Row label="Score" value={`${setup.score}/100`} color={setup.score >= 70 ? '#26A69A' : setup.score >= 50 ? '#ffd166' : '#EF5350'} />
                </div>

                <div className="rounded p-3 space-y-1" style={{ background: '#131722' }}>
                  <SectionTitle>Score Breakdown</SectionTitle>
                  {Object.entries(setup.breakdown).map(([k, v]) => (
                    <div key={k} style={{ color: v.startsWith('✓') ? '#26A69A' : v.startsWith('⚠') ? '#ffd166' : '#758696' }}>
                      {v}
                    </div>
                  ))}
                </div>

                {setup.metadata.invalidationReason && (
                  <div
                    className="rounded px-3 py-2 text-xs"
                    style={{ background: 'rgba(239,83,80,0.1)', color: '#EF5350', border: '1px solid rgba(239,83,80,0.2)' }}
                  >
                    {setup.metadata.invalidationReason}
                  </div>
                )}
              </>
            ) : (
              <div style={{ color: '#758696' }}>
                {structure ? 'No institutional setup detected' : 'Load chart data to detect setups'}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
