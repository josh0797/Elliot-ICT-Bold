'use client';

import { RiskMetrics } from '@/lib/types';

interface RiskPanelProps {
  metrics?: RiskMetrics;
}

const defaultMetrics: RiskMetrics = {
  riskRewardRatio: 0,
  positionSize: 0,
  maxDrawdown: 0,
  winRate: 0,
  profitFactor: 0,
};

export default function RiskPanel({ metrics = defaultMetrics }: RiskPanelProps) {
  const rows: { label: string; value: string; color?: string }[] = [
    {
      label: 'Risk/Reward',
      value: metrics.riskRewardRatio > 0 ? `1:${metrics.riskRewardRatio.toFixed(2)}` : '—',
    },
    {
      label: 'Position Size',
      value: metrics.positionSize > 0 ? `${metrics.positionSize.toFixed(2)}%` : '—',
    },
    {
      label: 'Max Drawdown',
      value: metrics.maxDrawdown > 0 ? `${metrics.maxDrawdown.toFixed(2)}%` : '—',
      color: metrics.maxDrawdown > 0 ? '#EF5350' : undefined,
    },
    {
      label: 'Win Rate',
      value: metrics.winRate > 0 ? `${(metrics.winRate * 100).toFixed(1)}%` : '—',
      color: metrics.winRate > 0.5 ? '#26A69A' : '#EF5350',
    },
    {
      label: 'Profit Factor',
      value: metrics.profitFactor > 0 ? metrics.profitFactor.toFixed(2) : '—',
      color: metrics.profitFactor >= 1.5 ? '#26A69A' : '#EF5350',
    },
  ];

  return (
    <div
      className="flex flex-col w-full h-full"
      style={{ background: '#0D0E14', border: '1px solid #1E2130' }}
    >
      <div
        className="px-4 py-3 border-b text-sm font-semibold text-white"
        style={{ borderColor: '#1E2130' }}
      >
        Risk Metrics
      </div>
      <div className="flex-1 p-3 space-y-3">
        {rows.map(({ label, value, color }) => (
          <div key={label} className="flex items-center justify-between">
            <span className="text-xs" style={{ color: '#758696' }}>
              {label}
            </span>
            <span
              className="text-xs font-medium"
              style={{ color: color ?? '#D1D4DC' }}
            >
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
