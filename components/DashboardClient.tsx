'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { OHLCVBar } from '@/lib/types';
import { generateMockOHLCV } from '@/lib/mockOHLCV';
import SignalPanel from '@/components/SignalPanel';
import { RailwaySignal } from '@/lib/types';

const TradingChart = dynamic(() => import('@/components/TradingChart'), {
  ssr: false,
  loading: () => <div className="w-full h-full" style={{ background: '#0D0E14' }} />,
});

type Source = 'twelvedata' | 'polygon' | 'demo';
type BadgeState = 'live' | 'throttled' | 'demo';

const SYMBOLS = [
  { group: 'Forex',  value: 'fx|EURUSD|EUR/USD',     label: 'EUR/USD' },
  { group: 'Forex',  value: 'fx|GBPUSD|GBP/USD',     label: 'GBP/USD' },
  { group: 'Forex',  value: 'fx|USDJPY|USD/JPY',     label: 'USD/JPY' },
  { group: 'Forex',  value: 'fx|USDCAD|USD/CAD',     label: 'USD/CAD' },
  { group: 'Forex',  value: 'fx|AUDUSD|AUD/USD',     label: 'AUD/USD' },
  { group: 'Metals', value: 'fx|XAUUSD|XAU/USD',     label: 'XAU/USD' },
  { group: 'Crypto', value: 'crypto|BTCUSD|BTC/USD',  label: 'BTC/USD' },
  { group: 'Crypto', value: 'crypto|ETHUSD|ETH/USD',  label: 'ETH/USD' },
  { group: 'Crypto', value: 'crypto|SOLUSD|SOL/USD',  label: 'SOL/USD' },
  { group: 'Stocks', value: 'stock|AAPL|AAPL',        label: 'AAPL' },
  { group: 'Stocks', value: 'stock|TSLA|TSLA',        label: 'TSLA' },
  { group: 'Stocks', value: 'stock|NVDA|NVDA',        label: 'NVDA' },
];

const TIMEFRAMES = [
  { label: '15M', value: '15min' },
  { label: '1H',  value: '1h' },
  { label: '1D',  value: '1day' },
  { label: '1W',  value: '1week' },
];

const PREC: Record<string, number> = {
  EURUSD: 5, GBPUSD: 5, USDJPY: 3, USDCAD: 5, AUDUSD: 5,
  XAUUSD: 2, BTCUSD: 2, ETHUSD: 2, SOLUSD: 3,
  AAPL: 2, TSLA: 2, NVDA: 2,
};

const BADGE_CFG: Record<BadgeState, { label: string; dot: string; bg: string; color: string }> = {
  live:      { label: 'LIVE · Twelve Data', dot: '#00e676', bg: 'rgba(0,230,118,0.1)',   color: '#00e676' },
  throttled: { label: 'Throttled',          dot: '#ffd166', bg: 'rgba(255,209,102,0.1)', color: '#ffd166' },
  demo:      { label: 'DEMO',               dot: '#ffd166', bg: 'rgba(255,209,102,0.1)', color: '#ffd166' },
};

function parseSym(sym: string) {
  const parts = sym.split('|');
  return { type: parts[0] ?? 'fx', ticker: parts[1] ?? '', label: parts[2] ?? parts[1] ?? '' };
}

export default function DashboardClient() {
  const [sym,       setSym]       = useState('fx|EURUSD|EUR/USD');
  const [tf,        setTf]        = useState('1h');
  const [bars,      setBars]      = useState<OHLCVBar[]>([]);
  const [source,    setSource]    = useState<Source>('demo');
  const [loading,   setLoading]   = useState(true);
  const [price,     setPrice]     = useState<number | null>(null);
  const [priceUp,   setPriceUp]   = useState<boolean | null>(null);
  const [throttled, setThrottled] = useState(false);
  const [signal, setSignal] = useState<RailwaySignal | null>(null);

  const symRef     = useRef(sym);
  const prevPrice  = useRef<number | null>(null);
  const quoteTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef   = useRef<AbortController | null>(null);

  useEffect(() => { symRef.current = sym; }, [sym]);

  const doLoad = useCallback(async (symVal: string, tfVal: string) => {
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const { type, ticker } = parseSym(symVal);
    setBars([]);
    setLoading(true);
    setThrottled(false);

    const timeoutId = setTimeout(() => {
      if (!ctrl.signal.aborted) {
        const { type: t } = parseSym(symVal);
        const base = t === 'crypto' ? 50000 : t === 'stock' ? 180 : 1.1;
        setBars(generateMockOHLCV(100, base));
        setSource('demo');
        setLoading(false);
        ctrl.abort();
      }
    }, 8000);

    try {
      const res = await fetch(
        `/api/twelvedata?ticker=${ticker}&type=${type}&tf=${tfVal}`,
        { signal: ctrl.signal }
      );
      const json = await res.json() as { candles?: OHLCVBar[]; source?: string };
      if (json.candles?.length) {
        setBars(json.candles);
        setSource((json.source as Source) ?? 'demo');
      }
    } catch {
      // aborted (timeout) or network error — keep whatever is showing
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  }, []);

  const pollQuote = useCallback(async () => {
    const { type, ticker } = parseSym(symRef.current);
    try {
      const res = await fetch(`/api/quote?ticker=${ticker}&type=${type}`);
      const json = await res.json() as { price?: number };
      if (typeof json.price === 'number') {
        const p = json.price;
        setPriceUp(prevPrice.current === null ? null : p >= prevPrice.current);
        prevPrice.current = p;
        setPrice(p);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    doLoad(sym, tf);
  }, [sym, tf, doLoad]);

  useEffect(() => {
    if (quoteTimer.current) clearInterval(quoteTimer.current);
    prevPrice.current = null;
    setPrice(null);
    pollQuote();
    quoteTimer.current = setInterval(pollQuote, 15_000);
    return () => {
      if (quoteTimer.current) clearInterval(quoteTimer.current);
    };
  }, [sym, pollQuote]);

  useEffect(() => {
  const { label } = parseSym(sym);
  fetch(`/api/signal?symbol=${encodeURIComponent(label)}&timeframe=${tf}`)
    .then((r) => r.json())
    .then((d) => setSignal(d))
    .catch(() => setSignal(null));
}, [sym, tf]);

  const { ticker, label: symLabel } = parseSym(sym);
  const prec = PREC[ticker] ?? 2;
  const groups = Array.from(new Set(SYMBOLS.map((s) => s.group)));
  const badgeState: BadgeState = throttled ? 'throttled' : source === 'demo' ? 'demo' : 'live';
  const badge = BADGE_CFG[badgeState];

  return (
    <main className="flex flex-col w-screen h-screen overflow-hidden" style={{ background: '#0D0E14' }}>
      <header
        className="flex items-center justify-between px-4 shrink-0"
        style={{ height: 48, borderBottom: '1px solid #1E2130', background: '#0D0E14' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center text-xs font-bold rounded shrink-0"
            style={{
              width: 26, height: 26,
              background: 'linear-gradient(135deg,#26A69A,#00cfff)',
              color: '#0D0E14',
            }}
          >
            E
          </div>

          <select
            value={sym}
            onChange={(e) => setSym(e.target.value)}
            style={{
              background: '#131722', border: '1px solid #1E2130', color: '#D1D4DC',
              borderRadius: 4, padding: '4px 8px', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', outline: 'none',
            }}
          >
            {groups.map((g) => (
              <optgroup key={g} label={g} style={{ color: '#758696' }}>
                {SYMBOLS.filter((s) => s.group === g).map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </optgroup>
            ))}
          </select>

          <div className="flex items-center gap-1">
            {TIMEFRAMES.map((t) => (
              <button
                key={t.value}
                onClick={() => setTf(t.value)}
                style={{
                  padding: '3px 10px', borderRadius: 4, fontSize: 12, fontWeight: 600,
                  border: 'none', cursor: 'pointer',
                  background: tf === t.value ? '#26A69A' : 'transparent',
                  color:      tf === t.value ? '#0D0E14'  : '#758696',
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {price !== null && (
            <div className="flex items-center gap-2" suppressHydrationWarning>
              <span
                suppressHydrationWarning
                style={{
                  fontSize: 14, fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums', letterSpacing: '0.02em',
                  color: priceUp === null ? '#D1D4DC' : priceUp ? '#26A69A' : '#EF5350',
                  transition: 'color 0.4s',
                }}
              >
                {price.toFixed(prec)}
              </span>
              <span style={{ fontSize: 11, color: '#758696' }}>{symLabel}</span>
            </div>
          )}

          <div
            suppressHydrationWarning
            className="flex items-center gap-1.5 rounded"
            style={{
              padding: '3px 10px',
              background: badge.bg,
              border: `1px solid ${badge.dot}44`,
              transition: 'background 0.3s, border-color 0.3s',
            }}
          >
            <span
              suppressHydrationWarning
              style={{
                width: 6, height: 6, borderRadius: '50%',
                background: badge.dot, display: 'inline-block', flexShrink: 0,
                boxShadow: badgeState === 'live' ? `0 0 5px ${badge.dot}` : 'none',
                animation: throttled ? 'badgePulse 1s ease-in-out infinite' : 'none',
              }}
            />
            <span suppressHydrationWarning style={{ fontSize: 11, fontWeight: 600, color: badge.color, transition: 'color 0.3s' }}>
              {badge.label}
            </span>
          </div>

          <button
            onClick={() => doLoad(sym, tf)}
            disabled={loading}
            style={{
              padding: '5px 14px', borderRadius: 4, fontSize: 12, fontWeight: 600,
              border: '1px solid #26A69A44',
              background: loading ? '#131722' : '#26A69A18',
              color:      loading ? '#758696' : '#26A69A',
              cursor:     loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
            }}
          >
            {loading ? 'Cargando...' : 'Cargar'}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
  {/* Signal Panel lateral */}
  <div className="shrink-0 overflow-hidden" style={{ width: 220, borderRight: '1px solid #1E2130' }}>
    <SignalPanel
      symbol={parseSym(sym).label}
      timeframe={tf}
    />
  </div>

  <div className="flex-1 overflow-hidden relative" style={{ minHeight: 0 }}>
          {loading && bars.length === 0 ? (
            <div
              className="absolute inset-0 flex flex-col gap-3 p-4"
              style={{ background: '#0D0E14' }}
            >
              <div
                className="w-full rounded"
                style={{
                  height: '70%',
                  background: 'linear-gradient(90deg, #1E2130 25%, #252836 50%, #1E2130 75%)',
                  backgroundSize: '200% 100%',
                  animation: 'skeletonShimmer 1.4s ease-in-out infinite',
                }}
              />
              <div className="flex gap-2" style={{ height: '12%' }}>
                {[40, 25, 55, 30, 45].map((w, i) => (
                  <div
                    key={i}
                    className="rounded"
                    style={{
                      width: `${w}%`, height: '100%',
                      background: 'linear-gradient(90deg, #1E2130 25%, #252836 50%, #1E2130 75%)',
                      backgroundSize: '200% 100%',
                      animation: `skeletonShimmer 1.4s ease-in-out ${i * 0.1}s infinite`,
                    }}
                  />
                ))}
              </div>
            </div>
          ) : (
            <>
              {loading && (
                <div
                  className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"
                  style={{ background: 'rgba(13,14,20,0.5)', backdropFilter: 'blur(1px)' }}
                >
                  <div
                    style={{
                      width: 28, height: 28,
                      border: '2px solid #26A69A33',
                      borderTop: '2px solid #26A69A',
                      borderRadius: '50%',
                      animation: 'chartSpin 0.7s linear infinite',
                    }}
                  />
                </div>
              )}
             <TradingChart data={bars} symbol={symLabel} interval={TIMEFRAMES.find((t) => t.value === tf)?.label ?? tf} signal={signal} />
            </>
          )}
        </div>
      </div>

      <style jsx global>{`
        @keyframes chartSpin { to { transform: rotate(360deg); } }
        @keyframes badgePulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes skeletonShimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
      `}</style>
    </main>
  );
}
