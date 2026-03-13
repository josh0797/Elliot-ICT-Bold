import {
  Candle, SymMeta, WavePivot, ICTZones, FVG, OrderBlock,
  Swing, Sweep, BOS, CHoCH, FVGQuality, ScoreBreakdown,
  TradeSetup, BuildSetupResult, StructureContext,
  AnalysisResult, RawScoreResult,
} from './types';

export function getMeta(sym: string): SymMeta {
  const [type, ticker, label] = sym.split('|');
  const precMap: Record<string, number> = {
    EURUSD:4,GBPUSD:4,USDJPY:3,AUDUSD:4,USDCAD:4,USDCHF:4,EURGBP:4,
    XAUUSD:2,BTCUSD:1,ETHUSD:2,SOLUSD:3,XRPUSD:4,
    SPY:2,QQQ:2,GLD:2,AAPL:2,TSLA:2,NVDA:2,META:2,MSFT:2,
  };
  const pipMap: Record<string, number> = {
    EURUSD:.0001,GBPUSD:.0001,USDJPY:.01,AUDUSD:.0001,
    USDCAD:.0001,USDCHF:.0001,EURGBP:.0001,XAUUSD:.1,
  };
  const prec = precMap[ticker] ?? 2;
  const pip  = pipMap[ticker]  ?? .01;
  return { type, ticker, label, prec, pip };
}

export function detectWaves(data: Candle[]): WavePivot[] {
  const n = data.length, cl = data.map(d => d.c);
  const win = Math.max(4, Math.floor(n / 18));
  const pivs: Array<{ i: number; p: number; type: 'H' | 'L' }> = [];

  for (let i = win; i < n - win; i++) {
    const s = cl.slice(i - win, i + win + 1);
    const mx = Math.max(...s), mn = Math.min(...s);
    if (cl[i] >= mx) pivs.push({ i, p: data[i].h, type: 'H' });
    else if (cl[i] <= mn) pivs.push({ i, p: data[i].l, type: 'L' });
  }

  const clean: Array<{ i: number; p: number; type: 'H' | 'L' }> = [];
  for (const pv of pivs) {
    if (!clean.length || clean.at(-1)!.type !== pv.type) clean.push(pv);
    else {
      const l = clean.at(-1)!;
      if (pv.type === 'H' && pv.p > l.p) clean[clean.length - 1] = pv;
      if (pv.type === 'L' && pv.p < l.p) clean[clean.length - 1] = pv;
    }
  }

  const labels = ['0','1','2','3','4','5','A','B','C'];
  const colors = ['#444','#00cfff','#9d6fff','#00e676','#ff9500','#e040fb','#ff3651','#ffd166','#ff7043'];

  return clean.slice(0, 9).map((p, i) => ({
    ...p,
    label: labels[i] || String(i),
    color: colors[i] || '#888',
    barIdx: p.i,
  }));
}

export function detectICT(data: Candle[]): ICTZones {
  const n = data.length;
  const fvgs: FVG[] = [], obs: OrderBlock[] = [], liqs: { type: 'high' | 'low'; price: number; barIdx: number }[] = [];

  for (let i = 1; i < n - 1; i++) {
    const a = data[i - 1], c = data[i + 1];
    if (c.l > a.h) fvgs.push({ type:'bull', top:c.l,  bottom:a.h, barL:i-1, barR:i+1 });
    if (c.h < a.l) fvgs.push({ type:'bear', top:a.l,  bottom:c.h, barL:i-1, barR:i+1 });
  }

  for (let i = 1; i < n - 4; i++) {
    const cv = data[i], nx = data.slice(i + 1, i + 5);
    const avg = nx.reduce((s, d) => s + d.c, 0) / nx.length;
    if (cv.c < cv.o && avg > cv.h * 1.001) obs.push({ type:'bull', top:cv.h, bottom:cv.l, barIdx:i });
    if (cv.c > cv.o && avg < cv.l * .999)  obs.push({ type:'bear', top:cv.h, bottom:cv.l, barIdx:i });
  }

  const sw = Math.max(3, Math.floor(n / 22));
  for (let i = sw; i < n - sw; i++) {
    const L = data.slice(i - sw, i), R = data.slice(i + 1, i + sw + 1);
    if (L.every(d => d.h <= data[i].h) && R.every(d => d.h <= data[i].h))
      liqs.push({ type:'high', price:data[i].h, barIdx:i });
    if (L.every(d => d.l >= data[i].l) && R.every(d => d.l >= data[i].l))
      liqs.push({ type:'low',  price:data[i].l, barIdx:i });
  }

  return { fvgs: fvgs.slice(0, 10), obs: obs.slice(0, 6), liqs: liqs.slice(0, 14) };
}

export function detectSwings(data: Candle[]): Swing[] {
  const n = data.length;
  if (n < 10) return [];

  const atr14: number[] = [];
  for (let i = 0; i < n; i++) {
    const start = Math.max(0, i - 13);
    let sum = 0, cnt = 0;
    for (let j = start + 1; j <= i; j++) {
      const tr = Math.max(
        data[j].h - data[j].l,
        Math.abs(data[j].h - data[j - 1].c),
        Math.abs(data[j].l - data[j - 1].c)
      );
      sum += tr; cnt++;
    }
    atr14.push(cnt > 0 ? sum / cnt : data[i].h - data[i].l);
  }

  const swings: Swing[] = [];

  for (let i = 2; i < n - 2; i++) {
    const atr = atr14[i];

    if (
      data[i].h > data[i-1].h &&
      data[i].h > data[i-2].h &&
      data[i].h > data[i+1].h &&
      data[i].h > data[i+2].h
    ) {
      const prevL = swings.filter(s => s.type === 'L' && s.idx < i).at(-1);
      const swingSize = prevL ? Math.abs(data[i].h - prevL.price) : atr * 2;
      const strength: 'major' | 'minor' | null =
        swingSize >= atr * 1.5 ? 'major' :
        swingSize >= atr * 0.5 ? 'minor' : null;
      if (strength) swings.push({ idx:i, price:data[i].h, type:'H', strength, atr });
    }

    if (
      data[i].l < data[i-1].l &&
      data[i].l < data[i-2].l &&
      data[i].l < data[i+1].l &&
      data[i].l < data[i+2].l
    ) {
      const prevH = swings.filter(s => s.type === 'H' && s.idx < i).at(-1);
      const swingSize = prevH ? Math.abs(prevH.price - data[i].l) : atr * 2;
      const strength: 'major' | 'minor' | null =
        swingSize >= atr * 1.5 ? 'major' :
        swingSize >= atr * 0.5 ? 'minor' : null;
      if (strength) swings.push({ idx:i, price:data[i].l, type:'L', strength, atr });
    }
  }

  return swings;
}

export function detectSweeps(data: Candle[], swings: Swing[]): Sweep[] {
  const n = data.length;
  const sweeps: Sweep[] = [];

  function sessionWeight(ts: Date): { w: number; name: string } {
    const h = new Date(ts).getUTCHours();
    if (h >= 7  && h < 10) return { w:1.0, name:'London' };
    if (h >= 13 && h < 16) return { w:1.0, name:'NY'     };
    if (h >= 16 && h < 19) return { w:0.6, name:'NY_PM'  };
    if (h >= 0  && h < 3)  return { w:0.5, name:'Asia'   };
    return { w:0.2, name:'Off' };
  }

  for (const swing of swings) {
    for (let i = swing.idx + 1; i < Math.min(swing.idx + 15, n - 3); i++) {
      const vela = data[i];
      const rango = vela.h - vela.l;
      if (rango === 0) continue;

      if (
        swing.type === 'H' &&
        vela.h > swing.price &&
        vela.c < swing.price
      ) {
        const cuerpo = Math.abs(vela.c - vela.o);
        const bodyRatio = cuerpo / rango;
        if (bodyRatio < 0.40) continue;

        let fvgConfirmed = false, fvgIdx: number | null = null;
        for (let f = i + 1; f <= Math.min(i + 3, n - 2); f++) {
          if (data[f - 1].l > data[f + 1].h) { fvgConfirmed = true; fvgIdx = f; break; }
        }

        const sess = sessionWeight(vela.t);
        sweeps.push({
          idx:i, type:'bear',
          sweptLevel:swing.price, sweptStrength:swing.strength,
          closeBack:true, bodyRatio,
          fvgConfirmed, fvgIdx,
          sessionWeight:sess.w, sessionName:sess.name,
          low_quality: swing.strength === 'minor' || !fvgConfirmed
        });
        break;
      }

      if (
        swing.type === 'L' &&
        vela.l < swing.price &&
        vela.c > swing.price
      ) {
        const cuerpo = Math.abs(vela.c - vela.o);
        const bodyRatio = cuerpo / rango;
        if (bodyRatio < 0.40) continue;

        let fvgConfirmed = false, fvgIdx: number | null = null;
        for (let f = i + 1; f <= Math.min(i + 3, n - 2); f++) {
          if (data[f - 1].h < data[f + 1].l) { fvgConfirmed = true; fvgIdx = f; break; }
        }

        const sess = sessionWeight(vela.t);
        sweeps.push({
          idx:i, type:'bull',
          sweptLevel:swing.price, sweptStrength:swing.strength,
          closeBack:true, bodyRatio,
          fvgConfirmed, fvgIdx,
          sessionWeight:sess.w, sessionName:sess.name,
          low_quality: swing.strength === 'minor' || !fvgConfirmed
        });
        break;
      }
    }
  }

  return sweeps;
}

export function detectBOS(
  data: Candle[],
  swings: Swing[],
  sweeps: Sweep[],
  waveContext: { currentWave: string | null } | null
): BOS[] {
  const n = data.length;
  const bosList: BOS[] = [];

  function avgVol(i: number): number {
    const slice = data.slice(Math.max(0, i - 20), i);
    const total = slice.reduce((s, d) => s + d.v, 0);
    return slice.length > 0 ? total / slice.length : 0;
  }

  function priorStructure(beforeIdx: number): string {
    const recent = swings.filter(s => s.idx < beforeIdx).slice(-4);
    if (recent.length < 3) return 'ranging';
    const lastH  = recent.filter(s => s.type === 'H').at(-1);
    const prevH  = recent.filter(s => s.type === 'H').at(-2);
    const lastL  = recent.filter(s => s.type === 'L').at(-1);
    const prevL  = recent.filter(s => s.type === 'L').at(-2);
    if (lastH && prevH && lastL && prevL) {
      if (lastH.price > prevH.price && lastL.price > prevL.price) return 'bullish';
      if (lastH.price < prevH.price && lastL.price < prevL.price) return 'bearish';
    }
    return 'ranging';
  }

  function elliottQuality(waveCtx: { currentWave: string | null } | null): 'high' | 'medium' | 'low' {
    if (!waveCtx) return 'medium';
    const w = waveCtx.currentWave;
    if (['3','5','C'].includes(w ?? '')) return 'high';
    if (w === '1') return 'medium';
    if (['2','4'].includes(w ?? '')) return 'low';
    return 'medium';
  }

  for (const sweep of sweeps) {
    if (sweep.low_quality) continue;

    const searchStart = sweep.idx + 1;
    const searchEnd   = Math.min(sweep.idx + 8, n - 1);

    const targetType = sweep.type === 'bull' ? 'H' : 'L';
    const targetSwing = swings
      .filter(s => s.type === targetType && s.idx < sweep.idx && s.strength === 'major')
      .at(-1);

    if (!targetSwing) continue;
    const brokenLevel = targetSwing.price;

    for (let i = searchStart; i <= searchEnd; i++) {
      const vela = data[i];
      const rango = vela.h - vela.l;
      if (rango === 0) continue;

      const av = avgVol(i);
      const volRatio = av > 0 ? vela.v / av : 1;

      if (
        sweep.type === 'bull' &&
        vela.c > brokenLevel  &&
        vela.c > vela.o
      ) {
        const cuerpo = vela.c - vela.o;
        const bodyRatio = cuerpo / rango;
        if (bodyRatio < 0.40) continue;

        const confirmed = bodyRatio >= 0.40 && volRatio >= 1.0;
        const prior = priorStructure(i);
        const quality: 'high' | 'medium' | 'low' = confirmed
          ? (prior === 'bearish' ? elliottQuality(waveContext) : 'low')
          : 'low';

        bosList.push({
          idx:i, type:'bull',
          brokenLevel, brokenStrength:targetSwing.strength,
          confirmed, bodyRatio,
          displacement_vol:volRatio,
          quality,
          waveContext: waveContext?.currentWave ?? null,
          sweepRef:sweep.idx,
          priorStructure:prior
        });
        break;
      }

      if (
        sweep.type === 'bear' &&
        vela.c < brokenLevel  &&
        vela.c < vela.o
      ) {
        const cuerpo = vela.o - vela.c;
        const bodyRatio = cuerpo / rango;
        if (bodyRatio < 0.40) continue;

        const confirmed = bodyRatio >= 0.40 && volRatio >= 1.0;
        const prior = priorStructure(i);
        const quality: 'high' | 'medium' | 'low' = confirmed
          ? (prior === 'bullish' ? elliottQuality(waveContext) : 'low')
          : 'low';

        bosList.push({
          idx:i, type:'bear',
          brokenLevel, brokenStrength:targetSwing.strength,
          confirmed, bodyRatio,
          displacement_vol:volRatio,
          quality,
          waveContext: waveContext?.currentWave ?? null,
          sweepRef:sweep.idx,
          priorStructure:prior
        });
        break;
      }
    }
  }

  return bosList;
}

export function detectCHoCH(data: Candle[], swings: Swing[], sweeps: Sweep[]): CHoCH[] {
  const n = data.length;
  const chochs: CHoCH[] = [];

  for (const sweep of sweeps) {
    if (sweep.low_quality) continue;

    const recentSwings = swings.filter(s => s.idx < sweep.idx).slice(-4);
    if (recentSwings.length < 3) continue;

    if (sweep.type === 'bull') {
      const recentH = swings
        .filter(s => s.type === 'H' && s.strength === 'major' && s.idx < sweep.idx)
        .slice(-2);
      if (recentH.length < 1) continue;

      const targetLevel = recentH.at(-1)!.price;

      for (let i = sweep.idx + 1; i <= Math.min(sweep.idx + 6, n - 1); i++) {
        const vela = data[i];
        const rango = vela.h - vela.l;
        if (rango === 0) continue;
        if (vela.c > targetLevel && vela.c > vela.o) {
          const cuerpo = vela.c - vela.o;
          const bodyRatio = cuerpo / rango;
          if (bodyRatio < 0.35) continue;
          chochs.push({
            idx:i, type:'bull',
            level:targetLevel,
            priorStructure:'bearish',
            sweepRef:sweep.idx,
            bodyRatio,
            confirmed:false,
            bosRef:null
          });
          break;
        }
      }
    }

    if (sweep.type === 'bear') {
      const recentL = swings
        .filter(s => s.type === 'L' && s.strength === 'major' && s.idx < sweep.idx)
        .slice(-2);
      if (recentL.length < 1) continue;

      const targetLevel = recentL.at(-1)!.price;

      for (let i = sweep.idx + 1; i <= Math.min(sweep.idx + 6, n - 1); i++) {
        const vela = data[i];
        const rango = vela.h - vela.l;
        if (rango === 0) continue;
        if (vela.c < targetLevel && vela.c < vela.o) {
          const cuerpo = vela.o - vela.c;
          const bodyRatio = cuerpo / rango;
          if (bodyRatio < 0.35) continue;
          chochs.push({
            idx:i, type:'bear',
            level:targetLevel,
            priorStructure:'bullish',
            sweepRef:sweep.idx,
            bodyRatio,
            confirmed:false,
            bosRef:null
          });
          break;
        }
      }
    }
  }

  return chochs;
}

export function retroLink(chochs: CHoCH[], bosList: BOS[]): CHoCH[] {
  for (const choch of chochs) {
    const matchBOS = bosList.find(b =>
      b.type      === choch.type    &&
      b.idx       >  choch.idx      &&
      b.idx       <= choch.idx + 12 &&
      b.confirmed === true          &&
      b.sweepRef  === choch.sweepRef
    );
    if (matchBOS) {
      choch.confirmed = true;
      choch.bosRef    = matchBOS.idx;
      matchBOS.chochRef = choch.idx;
    }
  }
  return chochs;
}

function qualifyFVG(
  fvg: FVG | null | undefined,
  sweepIdx: number,
  data: Candle[],
  atr: number
): FVGQuality {
  if (!fvg) return { valid:false, state:null, bonus:0 };

  const dist = Math.abs((fvg.barL + fvg.barR) / 2 - sweepIdx);
  if (dist > 3) return { valid:false, state:'too_far', bonus:0 };

  const gapSize = Math.abs(fvg.top - fvg.bottom);
  if (gapSize < atr * 0.3) return { valid:false, state:'too_small', bonus:0 };

  const lastC  = data[data.length - 1].c;
  const isBull = fvg.type === 'bull';
  let state: string, bonus: number;

  if (isBull) {
    if (lastC < fvg.bottom)      { state = 'untested'; bonus = 20; }
    else if (lastC < fvg.top)    { state = 'partial';  bonus = 10; }
    else                         { state = 'filled';   bonus = 0;  }
  } else {
    if (lastC > fvg.top)         { state = 'untested'; bonus = 20; }
    else if (lastC > fvg.bottom) { state = 'partial';  bonus = 10; }
    else                         { state = 'filled';   bonus = 0;  }
  }

  return { valid:true, state, bonus, gapSize };
}

export function calculateRawScore(
  sweep: Sweep | null | undefined,
  choch: CHoCH | null | undefined,
  bos: BOS | null | undefined,
  waveLabel: string | null,
  fvgQual: FVGQuality | null | undefined,
  poi: FVG | OrderBlock | null | undefined,
  isBull: boolean
): RawScoreResult {
  let score = 0;
  const breakdown: ScoreBreakdown = {
    sweep: '', choch: '', fvg: '', bos: '', elliott: '',
  };

  if (sweep) {
    if (sweep.fvgConfirmed) {
      score += 30;
      breakdown.sweep = '✓ Sweep + FVG (+30)';
    } else {
      score += 15;
      breakdown.sweep = '~ Sweep sin FVG (+15)';
    }
  } else {
    breakdown.sweep = '✗ Sin sweep (0)';
  }

  if (choch?.confirmed) {
    score += 25;
    breakdown.choch = '✓ CHoCH confirmado (+25)';
  } else {
    breakdown.choch = '✗ CHoCH no confirmado (0)';
  }

  if (fvgQual?.valid) {
    score += fvgQual.bonus;
    breakdown.fvg = fvgQual.bonus > 0
      ? `✓ FVG ${fvgQual.state} (+${fvgQual.bonus})`
      : `~ FVG filled (0)`;
  } else {
    breakdown.fvg = '✗ Sin FVG válido (0)';
  }

  if (bos?.quality === 'high') {
    score += 10;
    breakdown.bos = '✓ BOS alta calidad (+10)';
  } else if (bos?.quality === 'medium') {
    score += 5;
    breakdown.bos = '~ BOS calidad media (+5)';
  } else {
    breakdown.bos = '✗ BOS baja calidad (0)';
  }

  const wl = waveLabel;
  let elliottPts = 0;

  if (isBull) {
    if      (wl === '2') { elliottPts = 20;  breakdown.elliott = '✓ Fin Onda 2 — entrada en descuento (+20)'; }
    else if (wl === '3') { elliottPts = 25;  breakdown.elliott = '✓ Inicio Onda 3 — máximo momentum (+25)'; }
    else if (wl === '5') { elliottPts = -20; breakdown.elliott = '⚠ Onda 5 alcista — riesgo reversión (-20)'; }
    else if (wl === 'C') { elliottPts = 20;  breakdown.elliott = '✓ Fin Onda C — inicio nuevo ciclo (+20)'; }
    else if (wl === 'B') { elliottPts = -15; breakdown.elliott = '✗ Onda B — trampa de liquidez (-15)'; }
    else if (wl === '4') { elliottPts = 10;  breakdown.elliott = '~ Onda 4 — rango/consolidación (+10)'; }
    else                 { elliottPts = 0;   breakdown.elliott = '? Conteo ambiguo (0)'; }
  } else {
    if      (wl === '4') { elliottPts = 20;  breakdown.elliott = '✓ Fin Onda 4 — corrección terminada (+20)'; }
    else if (wl === '5') { elliottPts = 25;  breakdown.elliott = '✓ Inicio Onda 5 — impulso bajista (+25)'; }
    else if (wl === '2') { elliottPts = -20; breakdown.elliott = '⚠ Onda 2 — contra tendencia alcista (-20)'; }
    else if (wl === 'C') { elliottPts = 20;  breakdown.elliott = '✓ Fin Onda C bajista (+20)'; }
    else if (wl === 'B') { elliottPts = -15; breakdown.elliott = '✗ Onda B — fakeout (+15)'; }
    else if (wl === '3') { elliottPts = 10;  breakdown.elliott = '~ Onda 3 — momentum opuesto (+10)'; }
    else                 { elliottPts = 0;   breakdown.elliott = '? Conteo ambiguo (0)'; }
  }
  score += elliottPts;

  let setupType: 'impulso' | 'reversion' | 'pullback' | 'unknown' = 'unknown';
  if (['2','3'].includes(wl ?? '') && isBull)  setupType = 'impulso';
  if (['4','5'].includes(wl ?? '') && !isBull) setupType = 'impulso';
  if (['5','C'].includes(wl ?? '') && isBull  && sweep?.fvgConfirmed) setupType = 'reversion';
  if (['5','C'].includes(wl ?? '') && !isBull && sweep?.fvgConfirmed) setupType = 'reversion';
  if (['2','4'].includes(wl ?? '')) setupType = setupType === 'unknown' ? 'pullback' : setupType;

  score = Math.max(-30, Math.min(100, score));

  return { score, breakdown, setupType };
}

function shouldExecute(
  setup: { score: number; metadata: { inKillzone: boolean; isExpired: boolean; mode: string } }
): { execute: boolean; reason: string } {
  const MIN_SCORE = 70;

  if (setup.metadata.mode === 'REVIEW') return { execute:true, reason:'Modo revisión' };
  if (!setup.metadata.inKillzone)       return { execute:false, reason:'Fuera de Killzone' };
  if (setup.metadata.isExpired)         return { execute:false, reason:'Setup expirado' };
  if (setup.score < MIN_SCORE)          return { execute:false, reason:`Score insuficiente (${setup.score}/100)` };

  return { execute:true, reason:'Ejecutar' };
}

function buildContext(
  swings: Swing[],
  sweeps: Sweep[],
  bosList: BOS[],
  chochs: CHoCH[]
): StructureContext {
  const lastSweep = sweeps.filter(s => !s.low_quality).at(-1) ?? null;
  const lastBOS   = bosList.filter(b => b.confirmed).at(-1)   ?? null;
  const lastCHoCH = chochs.filter(c => c.confirmed).at(-1)    ?? null;

  const majors = swings.filter(s => s.strength === 'major').slice(-4);
  let structure: 'bullish' | 'bearish' | 'ranging' = 'ranging';
  if (majors.length >= 3) {
    const hs = majors.filter(s => s.type === 'H');
    const ls = majors.filter(s => s.type === 'L');
    if (hs.length >= 2 && ls.length >= 2) {
      if (hs.at(-1)!.price > hs.at(-2)!.price && ls.at(-1)!.price > ls.at(-2)!.price) structure = 'bullish';
      else if (hs.at(-1)!.price < hs.at(-2)!.price && ls.at(-1)!.price < ls.at(-2)!.price) structure = 'bearish';
    }
  }
  return { structure, lastSweep, lastBOS, lastCHoCH };
}

export function buildSetup(
  data: Candle[],
  swings: Swing[],
  sweeps: Sweep[],
  bosList: BOS[],
  chochs: CHoCH[],
  waves: WavePivot[],
  zones: ICTZones,
  sym: string = 'fx|EURUSD|EUR/USD'
): BuildSetupResult {
  const meta   = getMeta(sym);
  const n      = data.length;
  const last   = data[n - 1];
  const setups: TradeSetup[] = [];

  for (const choch of chochs) {
    const sweep = sweeps.find(s => s.idx === choch.sweepRef);
    const bos   = bosList.find(b => b.idx === choch.bosRef) ?? null;
    if (!sweep) continue;

    const isBull = choch.type === 'bull';

    const atr = swings.find(s => s.idx >= sweep.idx - 2 && s.idx <= sweep.idx)?.atr
      ?? (data.slice(-14).reduce((s, d) => s + (d.h - d.l), 0) / 14);

    const nearFVG = isBull
      ? zones.fvgs.filter(f => f.type === 'bull')
          .sort((a, b) => Math.abs((a.barL+a.barR)/2 - sweep.idx) - Math.abs((b.barL+b.barR)/2 - sweep.idx))[0]
      : zones.fvgs.filter(f => f.type === 'bear')
          .sort((a, b) => Math.abs((a.barL+a.barR)/2 - sweep.idx) - Math.abs((b.barL+b.barR)/2 - sweep.idx))[0];

    const fvgQual = qualifyFVG(nearFVG, sweep.idx, data, atr);

    const poi = isBull
      ? (zones.fvgs.find(f => f.type === 'bull' && f.bottom < last.c && f.top > last.c * 0.998)
        ?? zones.obs.find(o => o.type === 'bull' && o.bottom < last.c))
      : (zones.fvgs.find(f => f.type === 'bear' && f.top > last.c && f.bottom < last.c * 1.002)
        ?? zones.obs.find(o => o.type === 'bear' && o.top > last.c));

    const entry = poi
      ? +((poi.top + poi.bottom) / 2).toFixed(meta.prec)
      : last.c;

    const slRaw = isBull
      ? sweep.sweptLevel - atr * 0.5
      : sweep.sweptLevel + atr * 0.5;

    const sl = isBull
      ? +Math.min(slRaw, entry - atr * 0.3).toFixed(meta.prec)
      : +Math.max(slRaw, entry + atr * 0.3).toFixed(meta.prec);

    const risk = Math.abs(entry - sl);
    if (risk === 0) continue;

    const dir = isBull ? 1 : -1;

    const nextMajor = isBull
      ? swings.filter(s => s.type === 'H' && s.strength === 'major' && s.idx > choch.idx).at(0)
      : swings.filter(s => s.type === 'L' && s.strength === 'major' && s.idx > choch.idx).at(0);

    const nextMajorValid = nextMajor && (
      isBull ? nextMajor.price > entry : nextMajor.price < entry
    );

    const tp1raw = nextMajorValid
      ? +nextMajor.price.toFixed(meta.prec)
      : +(entry + dir * risk * 1.272).toFixed(meta.prec);

    const tp2raw = +(entry + dir * risk * 1.618).toFixed(meta.prec);
    const tp3raw = +(entry + dir * risk * 2.618).toFixed(meta.prec);

    const tpsSorted = isBull
      ? [tp1raw, tp2raw, tp3raw].sort((a, b) => a - b)
      : [tp1raw, tp2raw, tp3raw].sort((a, b) => b - a);

    const [tp1, tp2, tp3] = tpsSorted;
    const rr = (Math.abs(tp1 - entry) / risk).toFixed(1);

    const waveLabel = waves.at(-1)?.label ?? null;
    const { score, breakdown, setupType } = calculateRawScore(
      sweep, choch, bos, waveLabel, fvgQual, poi ?? null, isBull
    );

    const triggerIdx            = bos?.idx ?? choch.idx;
    const velasDesdeTrigger     = n - 1 - triggerIdx;
    const isExpired             = velasDesdeTrigger > 8;
    const expPct                = Math.max(0, Math.round((1 - velasDesdeTrigger / 8) * 100));
    const inKillzone            = sweep.sessionWeight >= 1.0;

    let uiState: TradeSetup['uiState'];
    if (!choch.confirmed)      uiState = 'unconfirmed';
    else if (isExpired)        uiState = 'expired';
    else if (!inKillzone)      uiState = 'off_session';
    else if (score >= 70)      uiState = 'active';
    else                       uiState = 'low_score';

    const execution = shouldExecute({
      score,
      metadata: { inKillzone, isExpired, mode:'LIVE' }
    });

    setups.push({
      type:      isBull ? 'buy' : 'sell',
      setupType,
      entry, sl, tp1, tp2, tp3,
      rr:        `1:${rr}`,
      score,
      breakdown,
      uiState,
      expPct,
      triggerIdx,
      sweep, bos, choch,
      fvgQual,
      waveLabel,
      metadata: {
        inKillzone,
        isExpired,
        sessionName:            sweep.sessionName,
        sessionWeight:          sweep.sessionWeight,
        velasDesdeTrigger,
        chochConfirmed:         choch.confirmed,
        invalidationReason:     execution.execute ? null : execution.reason,
        mode: 'LIVE'
      },
      execution
    });
  }

  const order: Record<string, number> = { active:0, off_session:1, unconfirmed:2, low_score:3, expired:4 };
  setups.sort((a, b) => {
    const oa = order[a.uiState] ?? 5, ob2 = order[b.uiState] ?? 5;
    if (oa !== ob2) return oa - ob2;
    return b.score - a.score;
  });

  return {
    setups,
    context: buildContext(swings, sweeps, bosList, chochs)
  };
}

export function analyze(
  data: Candle[],
  waves: WavePivot[],
  zones: ICTZones,
  sym: string = 'fx|EURUSD|EUR/USD'
): AnalysisResult {
  const meta = getMeta(sym);
  const n = data.length, last = data[n - 1], prev = data[n - 2] || data[n - 1];
  const sl = data.slice(-60);
  const swL = Math.min(...sl.map(d => d.l));
  const swH = Math.max(...sl.map(d => d.h));
  const rng = swH - swL;
  const F  = (m: number) => +(swH - rng * m).toFixed(meta.prec);
  const FE = (m: number) => +(swL + rng * m).toFixed(meta.prec);

  const fibs = {
    f382:F(.382), f500:F(.5), f618:F(.618),
    f1272:FE(1.272), f1618:FE(1.618), f2618:FE(2.618),
    swL, swH, rng,
  };

  const wl    = waves.at(-1)?.label ?? '?';
  const trend = last.c > data[Math.floor(n / 2)].c ? 'ALCISTA' : 'BAJISTA';
  const bull  = trend === 'ALCISTA';

  const nearOB  = zones.obs?.find(o => Math.abs(last.c - (o.top + o.bottom) / 2) / last.c < .005);
  const nearFVG = zones.fvgs?.find(f => Math.abs(last.c - (f.top + f.bottom) / 2) / last.c < .004);
  const hasLiq  = zones.liqs?.some(l => Math.abs(l.price - last.c) / last.c < .01) ?? false;

  let score = 0;
  if (['3','C'].includes(wl)) score += 2;
  if (nearOB)  score += 2;
  if (nearFVG) score += 2;
  if (bull)    score += 1;
  if (hasLiq)  score += 1;
  score = Math.min(score, 10);

  const entry  = bull ? fibs.f618 : fibs.f382;
  const slv    = bull
    ? +(entry - rng * .08).toFixed(meta.prec)
    : +(entry + rng * .08).toFixed(meta.prec);
  const rr     = ((fibs.f1272 - entry) / Math.abs(entry - slv)).toFixed(1);
  const sigType: 'buy' | 'sell' | 'wait' =
    score >= 7 ? (bull ? 'buy' : 'sell') : 'wait';

  return {
    ...fibs, trend, bull, wl, nearOB, nearFVG, hasLiq, score,
    entry, sl:slv, tp1:fibs.f1272, tp2:fibs.f1618, rr:`1:${rr}`,
    sigType,
    chg: +(last.c - prev.c).toFixed(meta.prec),
    pct: ((last.c - prev.c) / prev.c * 100).toFixed(2),
    isBull: last.c >= prev.c,
  };
}

export function makeDemo(
  meta: SymMeta,
  tf: string = 'minute',
  mult: number = 15
): Candle[] {
  const bases: Record<string, number> = {
    EURUSD:1.082,GBPUSD:1.268,USDJPY:149.5,AUDUSD:0.654,USDCAD:1.352,
    USDCHF:0.895,EURGBP:0.855,XAUUSD:2340,BTCUSD:67500,ETHUSD:3520,
    SOLUSD:182,XRPUSD:0.618,SPY:524,QQQ:445,GLD:218,AAPL:189,
    TSLA:175,NVDA:850,META:490,MSFT:415,
  };
  const base = bases[meta.ticker] ?? 100, amp = base * .012, n = 100;

  const tfMs =
    tf === 'minute' ? (mult * 60000) :
    tf === 'hour'   ? (mult * 3600000) :
    tf === 'day'    ? (mult * 86400000) :
    (mult * 604800000);

  const segs = [
    {d:1,b:12,p:.08},{d:-1,b:8,p:.05},{d:1,b:18,p:.16},{d:-1,b:10,p:.07},
    {d:1,b:11,p:.10},{d:-1,b:12,p:.09},{d:1,b:9,p:.05},{d:-1,b:11,p:.10},
  ];
  let seed = 99, px = base;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    return (seed >>> 0) / 4294967296;
  };
  const path: number[] = [];
  segs.forEach(w => {
    const step = amp * w.p * 10 * w.d / w.b;
    for (let i = 0; i < w.b && path.length < n; i++) {
      px += step + (rnd() - .5) * amp * .003;
      path.push(px);
    }
  });
  while (path.length < n) { px += (rnd() - .5) * amp * .002; path.push(px); }
  const now = Date.now();

  return path.map((p, i) => {
    const v = amp * .4, o = p + (rnd() - .5) * v * .4, c = p + (rnd() - .5) * v;
    return {
      t:  new Date(now - (n - i) * tfMs),
      o:  +o.toFixed(meta.prec),
      h:  +Math.max(o, c, p + rnd() * .7 * v).toFixed(meta.prec),
      l:  +Math.min(o, c, p - rnd() * .7 * v).toFixed(meta.prec),
      c:  +c.toFixed(meta.prec),
      v:  Math.floor(rnd() * 5000 + 500),
    };
  });
}
