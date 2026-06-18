'use client';
import { useEffect, useRef } from 'react';
import { OHLCVBar, RailwaySignal, AnalysisResult } from '@/lib/types';

export interface LayerFlags {
  fvg:       boolean;
  ob:        boolean;
  fibonacci: boolean;
  entry:     boolean;
  sl:        boolean;
  tp:        boolean;
  elliott:   boolean;
}

interface Props {
  data:      OHLCVBar[];
  symbol:    string;
  interval:  string;
  signal?:   RailwaySignal | null;
  analysis?: AnalysisResult | null;
  layers?:   LayerFlags;
}

export default function TradingChart({ data, symbol, interval, signal, analysis, layers }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<any>(null);
  const seriesRef    = useRef<any>(null);
  const overlaysRef  = useRef<any[]>([]);

  const L: LayerFlags = {
    fvg:       layers?.fvg       ?? true,
    ob:        layers?.ob        ?? true,
    fibonacci: layers?.fibonacci ?? false,
    entry:     layers?.entry     ?? true,
    sl:        layers?.sl        ?? true,
    tp:        layers?.tp        ?? true,
    elliott:   layers?.elliott   ?? true,
  };

  // ── Init chart ──────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    let resizeObserver: ResizeObserver;

    import('lightweight-charts').then(({ createChart, CrosshairMode }) => {
      if (!containerRef.current) return;

      const chart = createChart(containerRef.current, {
        width:  containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
        layout: {
          background: { color: '#0D0E14' },
          textColor:  '#758696',
        },
        grid: {
          vertLines: { color: '#1E2130' },
          horzLines: { color: '#1E2130' },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: { color: '#758696', labelBackgroundColor: '#1E2130' },
          horzLine: { color: '#758696', labelBackgroundColor: '#1E2130' },
        },
        rightPriceScale: { borderColor: '#1E2130', textColor: '#758696' },
        timeScale:       { borderColor: '#1E2130', timeVisible: true, secondsVisible: false },
      });

      chartRef.current = chart;

      const candleSeries = chart.addCandlestickSeries({
        upColor:         '#26A69A',
        downColor:       '#EF5350',
        borderUpColor:   '#26A69A',
        borderDownColor: '#EF5350',
        wickUpColor:     '#26A69A',
        wickDownColor:   '#EF5350',
      });
      seriesRef.current = candleSeries;

      if (data.length > 0) {
        const sorted = [...data].sort((a, b) => a.time - b.time);
        candleSeries.setData(sorted.map(barToLW));
        chart.timeScale().fitContent();
      }

      resizeObserver = new ResizeObserver(() => {
        if (containerRef.current && chartRef.current) {
          chartRef.current.applyOptions({
            width:  containerRef.current.clientWidth,
            height: containerRef.current.clientHeight,
          });
        }
      });
      resizeObserver.observe(containerRef.current);
    });

    return () => {
      resizeObserver?.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current    = null;
        seriesRef.current   = null;
        overlaysRef.current = [];
      }
    };
  }, []);

  // ── Update candles ───────────────────────────────────────
  useEffect(() => {
    if (!seriesRef.current || !chartRef.current || data.length === 0) return;
    const sorted = [...data].sort((a, b) => a.time - b.time);
    seriesRef.current.setData(sorted.map(barToLW));
    seriesRef.current.priceScale().applyOptions({ autoScale: true });
    chartRef.current.timeScale().fitContent();
  }, [data]);

  // ── Draw overlays ────────────────────────────────────────
  useEffect(() => {
    if (!chartRef.current || !seriesRef.current || data.length === 0) return;

    overlaysRef.current.forEach((s) => { try { chartRef.current.removeSeries(s); } catch {} });
    overlaysRef.current = [];

    const sorted = [...data].sort((a, b) => a.time - b.time);
    const firstT = sorted[0].time as number;
    const lastT  = sorted[sorted.length - 1].time as number;

    const addLine = (value: number, color: string, title: string, style = 1) => {
      const s = chartRef.current.addLineSeries({
        color, lineWidth: 1, lineStyle: style,
        priceLineVisible: false, lastValueVisible: true, title,
      });
      s.setData([{ time: firstT, value }, { time: lastT, value }]);
      overlaysRef.current.push(s);
    };

    if (signal && signal.signal_type !== 'NO_SIGNAL') {
      const isBuy = signal.signal_type.startsWith('BUY');

      if (L.entry && signal.entry)
        addLine(signal.entry, isBuy ? '#26A69A' : '#EF5350', 'Entry', 1);
      if (L.tp && signal.tp1)
        addLine(signal.tp1, '#26A69A', 'TP1', 3);
      if (L.tp && signal.tp2)
        addLine(signal.tp2, 'rgba(38,166,154,0.5)', 'TP2', 3);
      if (L.sl && signal.sl)
        addLine(signal.sl, '#EF5350', 'SL', 3);
      if (signal.elliott?.invalidation_line)
        addLine(signal.elliott.invalidation_line, '#ffd166', 'Invalidation', 2);

      if (L.elliott && signal.elliott?.waves && signal.elliott.waves.length > 1) {
        const waves = signal.elliott.waves;
        const isBull = signal.elliott.bias === 'bullish';
        const wavePoints = waves
          .map((w) => ({ time: toUnix(w.time), value: w.price, label: w.label }))
          .filter((w) => w.time >= firstT && w.time <= lastT);

        if (wavePoints.length > 1) {
          const s = chartRef.current.addLineSeries({
            color: isBull ? '#26A69A' : '#EF5350',
            lineWidth: 2,
            priceLineVisible: false, lastValueVisible: false, title: '',
            crosshairMarkerVisible: true,
          });
          s.setData(wavePoints.map((w) => ({ time: w.time, value: w.value })));
          s.setMarkers(wavePoints.map((w) => ({
            time:     w.time,
            position: isBull ? 'belowBar' : 'aboveBar',
            color:    isBull ? '#26A69A' : '#EF5350',
            shape:    'circle',
            text:     w.label,
            size:     1,
          })));
          overlaysRef.current.push(s);
        }
      }

      if (L.ob) {
        signal.ict?.order_blocks?.forEach((ob) => {
          const color = ob.type === 'bullish_ob' ? '#26A69A' : '#EF5350';
          addLine(ob.top,    color, ob.type === 'bullish_ob' ? 'OB▲' : 'OB▼', 0);
          addLine(ob.bottom, color, '', 0);
        });
      }

      if (L.fvg) {
        signal.ict?.fvgs?.forEach((fvg) => {
          const color = fvg.type === 'bullish_fvg' ? 'rgba(38,166,154,0.5)' : 'rgba(239,83,80,0.5)';
          addLine(fvg.top,    color, fvg.type === 'bullish_fvg' ? 'FVG▲' : 'FVG▼', 2);
          addLine(fvg.bottom, color, '', 2);
        });
      }
    }

    if (L.fibonacci && analysis && analysis.rng > 0) {
      const FIBS: [number, string, string][] = [
        [analysis.swH,   '#26A69A',  'SW H' ],
        [analysis.f382,  '#758696',  '0.382'],
        [analysis.f500,  '#758696',  '0.500'],
        [analysis.f618,  '#D1D4DC',  '0.618'],
        [analysis.f1272, '#ffd166',  '1.272'],
        [analysis.f1618, '#ffd166',  '1.618'],
        [analysis.f2618, '#ffa500',  '2.618'],
        [analysis.swL,   '#EF5350',  'SW L' ],
      ];
      FIBS.forEach(([val, color, label]) => {
        if (val) addLine(val, color, label, 2);
      });
    }

  }, [signal, analysis, data, L.fvg, L.ob, L.fibonacci, L.entry, L.sl, L.tp, L.elliott]);

  return (
    <div className="relative w-full h-full" style={{ background: '#0D0E14' }}>
      {data.length === 0 && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ color: '#758696', fontSize: 13 }}
        >
          {symbol} · {interval}
        </div>
      )}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}

function barToLW(bar: OHLCVBar) {
  return {
    time:  bar.time as import('lightweight-charts').Time,
    open:  bar.open,
    high:  bar.high,
    low:   bar.low,
    close: bar.close,
  };
}

function toUnix(datetime: string): number {
  return Math.floor(new Date(datetime.replace(' ', 'T') + 'Z').getTime() / 1000);
}
