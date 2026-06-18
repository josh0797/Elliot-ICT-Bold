'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { RailwaySignal } from '@/lib/types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Alert {
  id:          string;
  symbol:      string;
  timeframe:   string;
  signal_type: string;
  confidence:  number;
  entry:       number | null;
  sl:          number | null;
  tp1:         number | null;
  source:      string | null;
  created_at:  string;
}

interface AlertsPanelProps {
  signal:    RailwaySignal | null;
  symbol:    string;
  timeframe: string;
}

const SIG_COLOR: Record<string, string> = {
  BUY_LIMIT:  '#26A69A',
  BUY_STOP:   '#26A69A',
  SELL_LIMIT: '#EF5350',
  SELL_STOP:  '#EF5350',
  NO_SIGNAL:  '#758696',
};

function formatTime(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

export default function AlertsPanel({ signal, symbol, timeframe }: AlertsPanelProps) {
  const [alerts, setAlerts]   = useState<Alert[]>([]);
  const prevSig = useRef<string | null>(null);

  // Load historical alerts on mount
  useEffect(() => {
    supabase
      .from('signal_alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) setAlerts(data as Alert[]);
      });
  }, []);

  // Insert new alert when signal type changes (and is not NO_SIGNAL)
  useEffect(() => {
    if (!signal) return;
    const key = `${symbol}|${timeframe}|${signal.signal_type}`;
    if (key === prevSig.current) return;
    prevSig.current = key;

    if (signal.signal_type === 'NO_SIGNAL') return;

    supabase
      .from('signal_alerts')
      .insert({
        symbol,
        timeframe,
        signal_type: signal.signal_type,
        confidence:  signal.confidence,
        entry:       signal.entry,
        sl:          signal.sl,
        tp1:         signal.tp1,
        source:      signal.source,
      })
      .select()
      .single()
      .then(({ data }) => {
        if (data) setAlerts((prev) => [data as Alert, ...prev].slice(0, 50));
      });
  }, [signal, symbol, timeframe]);

  const clearAll = async () => {
    await supabase.from('signal_alerts').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    setAlerts([]);
  };

  return (
    <div
      className="flex flex-col w-full h-full overflow-hidden"
      style={{ background: '#0D0E14', border: '1px solid #1E2130' }}
    >
      <div
        className="px-4 py-3 border-b text-sm font-semibold text-white flex items-center justify-between shrink-0"
        style={{ borderColor: '#1E2130' }}
      >
        <div className="flex items-center gap-2">
          <span>Alerts</span>
          {alerts.length > 0 && (
            <span
              className="text-xs font-bold rounded-full px-1.5 py-0.5"
              style={{ background: 'rgba(38,166,154,0.2)', color: '#26A69A' }}
            >
              {alerts.length}
            </span>
          )}
        </div>
        {alerts.length > 0 && (
          <button
            onClick={clearAll}
            className="text-xs"
            style={{ color: '#758696', cursor: 'pointer', background: 'none', border: 'none' }}
          >
            Clear
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {alerts.length === 0 ? (
          <div className="flex items-center justify-center h-full text-xs" style={{ color: '#758696' }}>
            No alerts yet
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: '#1E2130' }}>
            {alerts.map((a) => (
              <div key={a.id} className="px-3 py-2 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="text-xs font-bold"
                      style={{ color: SIG_COLOR[a.signal_type] ?? '#758696' }}
                    >
                      {a.signal_type.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs" style={{ color: '#758696' }}>
                      {a.symbol} · {a.timeframe}
                    </span>
                  </div>
                  <span className="text-xs" style={{ color: '#758696' }}>
                    {formatTime(a.created_at)}
                  </span>
                </div>
                {a.entry && (
                  <div className="flex gap-2 text-xs" style={{ color: '#758696' }}>
                    <span>E: <span style={{ color: '#D1D4DC' }}>{a.entry.toFixed(5)}</span></span>
                    {a.sl  && <span>SL: <span style={{ color: '#EF5350' }}>{a.sl.toFixed(5)}</span></span>}
                    {a.tp1 && <span>TP: <span style={{ color: '#26A69A' }}>{a.tp1.toFixed(5)}</span></span>}
                    <span>Conf: <span style={{ color: '#D1D4DC' }}>{((a.confidence ?? 0) * 100).toFixed(0)}%</span></span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
