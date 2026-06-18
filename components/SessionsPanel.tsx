'use client';

import { useEffect, useState } from 'react';

interface Session {
  name:  string;
  start: number; // UTC hour
  end:   number;
  color: string;
}

const SESSIONS: Session[] = [
  { name: 'Tokyo',    start: 0,  end: 9,  color: '#00cfff' },
  { name: 'London',   start: 7,  end: 16, color: '#ffd166' },
  { name: 'New York', start: 13, end: 22, color: '#26A69A' },
];

function isActive(s: Session, h: number, m: number): boolean {
  const t = h + m / 60;
  return t >= s.start && t < s.end;
}

function progress(s: Session, h: number, m: number): number {
  const t = h + m / 60;
  if (t < s.start || t >= s.end) return 0;
  return Math.min(100, ((t - s.start) / (s.end - s.start)) * 100);
}

function pad(n: number) { return String(n).padStart(2, '0'); }

export default function SessionsPanel() {
  const [utc, setUtc] = useState<Date>(new Date());

  useEffect(() => {
    const id = setInterval(() => setUtc(new Date()), 10_000);
    return () => clearInterval(id);
  }, []);

  const h = utc.getUTCHours();
  const m = utc.getUTCMinutes();
  const timeStr = `${pad(h)}:${pad(m)} UTC`;

  return (
    <div
      className="flex flex-col w-full"
      style={{ background: '#0D0E14', borderBottom: '1px solid #1E2130' }}
    >
      <div
        className="px-4 py-2 border-b text-sm font-semibold text-white flex items-center justify-between"
        style={{ borderColor: '#1E2130' }}
      >
        <span>Sessions</span>
        <span className="text-xs font-mono" style={{ color: '#758696' }}>{timeStr}</span>
      </div>

      <div className="px-3 py-2 space-y-2">
        {SESSIONS.map((s) => {
          const active = isActive(s, h, m);
          const pct    = progress(s, h, m);
          return (
            <div key={s.name} className="space-y-0.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span
                    style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: active ? s.color : '#1E2130',
                      display: 'inline-block',
                      boxShadow: active ? `0 0 5px ${s.color}` : 'none',
                      transition: 'background 0.3s, box-shadow 0.3s',
                    }}
                  />
                  <span className="text-xs font-medium" style={{ color: active ? s.color : '#758696' }}>
                    {s.name}
                  </span>
                </div>
                <span className="text-xs" style={{ color: '#758696' }}>
                  {pad(s.start)}:00 – {pad(s.end)}:00
                </span>
              </div>
              {active && (
                <div
                  className="rounded overflow-hidden"
                  style={{ background: '#131722', height: 3 }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${pct}%`,
                      background: s.color,
                      transition: 'width 1s linear',
                      opacity: 0.7,
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
