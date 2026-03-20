'use client';
import { useEffect, useRef } from 'react';
import { OHLCVBar, RailwaySignal } from '@/lib/types';

interface Props {
  data:     OHLCVBar[];
  symbol:   string;
  interval: string;
  signal?:  RailwaySignal | null;
}

export default function TradingChart({ data, symbol, interval, signal }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<any>(null);
  const seriesRef    = useRef<any>(null);
  const overlaysRef  = useRef<any[]>([]);

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
        upColor:        '#26A69A',
        downColor:      '#EF5350',
        borderUpColor:  '#26A69A',
        borderDownColor:'#EF5350',
        wickUpColor:    '#26A69A',
        wickDownColor:  '#EF5350',
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
        chartRef.current  = null;
        seriesRef.current = null;
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

  // ── Draw overlays when signal changes ───────────────────
  useEffect(() => {
    if (!chartRef.current || !seriesRef.current || data.length === 0) return;

    // Remove previous overlays
    overlaysRef.current.forEach((s) => {
      try { chartRef.current.removeSeries(s); } catch {}
    });
    overlaysRef.current = [];

    if (!signal || signal.signal_type === 'NO_SIGNAL') return;

    const sorted   = [...data].sort((a, b) => a.time - b.time);
    const firstT   = sorted[0].time as number;
    const lastT    = sorted[sorted.length - 1].time as number;

    // ── Invalidation line ──────────────────────────────────
    if (signal.elliott?.invalidation_line) {
      const inv = signal.elliott.invalidation_line;
      const s = chartRef.current.addLineSeries({
        color:           '#ffd166',
        lineWidth:       1,
        lineStyle:       2, // dashed
        priceLineVisible: false,
        lastValueVisible: true,
        title:           'Invalidation',
      });
      s.setData([
        { time: firstT, value: inv },
        { time: lastT,  value: inv },
      ]);
      overlaysRef.current.push(s);
    }

    // ── Entry line ─────────────────────────────────────────
    if (signal.entry) {
      const isBuy = signal.signal_type.startsWith('BUY');
      const s = chartRef.current.addLineSeries({
        color:           isBuy ? '#26A69A' : '#EF5350',
        lineWidth:       1,
        lineStyle:       1,
        priceLineVisible: false,
        lastValueVisible: true,
        title:           'Entry',
      });
      s.setData([
        { time: firstT, value: signal.entry },
        { time: lastT,  value: signal.entry },
      ]);
      overlaysRef.current.push(s);
    }

    // ── TP1 line ───────────────────────────────────────────
    if (signal.tp1) {
      const s = chartRef.current.addLineSeries({
        color:           '#26A69A',
        lineWidth:       1,
        lineStyle:       3,
        priceLineVisible: false,
        lastValueVisible: true,
        title:           'TP1',
      });
      s.setData([
        { time: firstT, value: signal.tp1 },
        { time: lastT,  value: signal.tp1 },
      ]);
      overlaysRef.current.push(s);
    }

    // ── SL line ────────────────────────────────────────────
    if (signal.sl) {
      const s = chartRef.current.addLineSeries({
        color:           '#EF5350',
        lineWidth:       1,
        lineStyle:       3,
        priceLineVisible: false,
        lastValueVisible: true,
        title:           'SL',
      });
      s.setData([
        { time: firstT, value: signal.sl },
        { time: lastT,  value: signal.sl },
      ]);
      overlaysRef.current.push(s);
    }

    // ── Elliott Wave lines ─────────────────────────────────
    if (signal.elliott?.waves?.length > 1) {
      const waves = signal.elliott.waves;
      const isBull = signal.elliott.bias === 'bullish';

      // Convert wave times to unix timestamps
      const wavePoints = waves.map((w) => ({
        time:  toUnix(w.time),
        value: w.price,
        label: w.label,
      })).filter((w) => w.time >= firstT && w.time <= lastT);

      if (wavePoints.length > 1) {
        const s = chartRef.current.addLineSeries({
          color:            isBull ? '#26A69A' : '#EF5350',
          lineWidth:        2,
          priceLineVisible: false,
          lastValueVisible: false,
          title:            '',
          crosshairMarkerVisible: true,
        });
        s.setData(wavePoints.map((w) => ({ time: w.time, value: w.value })));

        // Markers for wave labels
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

    // ── Order Blocks (as horizontal bands) ─────────────────
    signal.ict?.order_blocks?.forEach((ob) => {
      const isBull = ob.type === 'bullish_ob';
      const color  = isBull ? '#26A69A' : '#EF5350';

      // Top line
      const sTop = chartRef.current.addLineSeries({
        color,
        lineWidth:        1,
        lineStyle:        0,
        priceLineVisible: false,
        lastValueVisible: false,
        title:            isBull ? 'OB▲' : 'OB▼',
      });
      sTop.setData([
        { time: firstT, value: ob.top },
        { time: lastT,  value: ob.top },
      ]);

      // Bottom line
      const sBot = chartRef.current.addLineSeries({
        color,
        lineWidth:        1,
        lineStyle:        0,
        priceLineVisible: false,
        lastValueVisible: false,
        title:            '',
      });
      sBot.setData([
        { time: firstT, value: ob.bottom },
        { time: lastT,  value: ob.bottom },
      ]);

      overlaysRef.current.push(sTop, sBot);
    });

    // ── FVGs (as horizontal bands) ─────────────────────────
    signal.ict?.fvgs?.forEach((fvg) => {
      const isBull = fvg.type === 'bullish_fvg';
      const color  = isBull ? 'rgba(38,166,154,0.5)' : 'rgba(239,83,80,0.5)';

      const sTop = chartRef.current.addLineSeries({
        color,
        lineWidth:        1,
        lineStyle:        2,
        priceLineVisible: false,
        lastValueVisible: false,
        title:            isBull ? 'FVG▲' : 'FVG▼',
      });
      sTop.setData([
        { time: firstT, value: fvg.top },
        { time: lastT,  value: fvg.top },
      ]);

      const sBot = chartRef.current.addLineSeries({
        color,
        lineWidth:        1,
        lineStyle:        2,
        priceLineVisible: false,
        lastValueVisible: false,
        title:            '',
      });
      sBot.setData([
        { time: firstT, value: fvg.bottom },
        { time: lastT,  value: fvg.bottom },
      ]);

      overlaysRef.current.push(sTop, sBot);
    });

  }, [signal, data]);

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

// ── Helpers ────────────────────────────────────────────────
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
  // "2026-03-19 13:00:00" → unix seconds
  return Math.floor(new Date(datetime.replace(' ', 'T') + 'Z').getTime() / 1000);
}
