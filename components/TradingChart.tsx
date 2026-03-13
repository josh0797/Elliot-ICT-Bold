'use client';

import { useEffect, useRef } from 'react';
import { OHLCVBar } from '@/lib/types';

interface Props {
  data: OHLCVBar[];
  symbol: string;
  interval: string;
}

export default function TradingChart({ data, symbol, interval }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<{ remove: () => void; applyOptions: (o: unknown) => void; timeScale: () => { fitContent: () => void } } | null>(null);
  const seriesRef = useRef<{ setData: (d: unknown[]) => void; priceScale: () => { applyOptions: (o: unknown) => void } } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let resizeObserver: ResizeObserver;

    import('lightweight-charts').then(({ createChart, CrosshairMode }) => {
      if (!containerRef.current) return;

      const chart = createChart(containerRef.current, {
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
        layout: {
          background: { color: '#0D0E14' },
          textColor: '#758696',
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
        rightPriceScale: {
          borderColor: '#1E2130',
          textColor: '#758696',
        },
        timeScale: {
          borderColor: '#1E2130',
          timeVisible: true,
          secondsVisible: false,
        },
      });

      chartRef.current = chart as unknown as typeof chartRef.current;

      const candleSeries = chart.addCandlestickSeries({
        upColor: '#26A69A',
        downColor: '#EF5350',
        borderUpColor: '#26A69A',
        borderDownColor: '#EF5350',
        wickUpColor: '#26A69A',
        wickDownColor: '#EF5350',
      });

      seriesRef.current = candleSeries as unknown as typeof seriesRef.current;

      if (data.length > 0) {
        const sorted = [...data].sort((a, b) => a.time - b.time);
        candleSeries.setData(
          sorted.map((bar) => ({
            time: bar.time as import('lightweight-charts').Time,
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
          }))
        );
        chart.timeScale().fitContent();
      }

      resizeObserver = new ResizeObserver(() => {
        if (containerRef.current && chartRef.current) {
          chartRef.current.applyOptions({
            width: containerRef.current.clientWidth,
            height: containerRef.current.clientHeight,
          });
        }
      });

      if (containerRef.current) {
        resizeObserver.observe(containerRef.current);
      }
    });

    return () => {
      resizeObserver?.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        seriesRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!seriesRef.current || !chartRef.current || data.length === 0) return;
    const sorted = [...data].sort((a, b) => a.time - b.time);
    seriesRef.current.setData(
      sorted.map((bar) => ({
        time: bar.time as import('lightweight-charts').Time,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
      }))
    );
    seriesRef.current.priceScale().applyOptions({ autoScale: true });
    chartRef.current.timeScale().fitContent();
  }, [data]);

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
