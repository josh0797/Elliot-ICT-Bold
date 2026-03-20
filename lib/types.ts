export interface OHLCVBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Signal {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  confidence: number;
  timestamp: number;
  status: 'pending' | 'active' | 'closed';
}

export interface RiskMetrics {
  riskRewardRatio: number;
  positionSize: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
}

export interface ChartConfig {
  symbol: string;
  interval: string;
  from: number;
  to: number;
}

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

export interface Candle {
  t: Date;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface SymMeta {
  type: string;
  ticker: string;
  label: string;
  prec: number;
  pip: number;
}

export interface WavePivot {
  i: number;
  p: number;
  type: 'H' | 'L';
  label: string;
  color: string;
  barIdx: number;
}

export interface FVG {
  type: 'bull' | 'bear';
  top: number;
  bottom: number;
  barL: number;
  barR: number;
}

export interface OrderBlock {
  type: 'bull' | 'bear';
  top: number;
  bottom: number;
  barIdx: number;
}

export interface LiquidityLevel {
  type: 'high' | 'low';
  price: number;
  barIdx: number;
}

export interface ICTZones {
  fvgs: FVG[];
  obs: OrderBlock[];
  liqs: LiquidityLevel[];
}

export interface Swing {
  idx: number;
  price: number;
  type: 'H' | 'L';
  strength: 'major' | 'minor';
  atr: number;
}

export interface Sweep {
  idx: number;
  type: 'bull' | 'bear';
  sweptLevel: number;
  sweptStrength: 'major' | 'minor';
  closeBack: boolean;
  bodyRatio: number;
  fvgConfirmed: boolean;
  fvgIdx: number | null;
  sessionWeight: number;
  sessionName: string;
  low_quality: boolean;
}

export interface BOS {
  idx: number;
  type: 'bull' | 'bear';
  brokenLevel: number;
  brokenStrength: 'major' | 'minor';
  confirmed: boolean;
  bodyRatio: number;
  displacement_vol: number;
  quality: 'high' | 'medium' | 'low';
  waveContext: string | null;
  sweepRef: number;
  priorStructure: string;
  chochRef?: number;
}

export interface CHoCH {
  idx: number;
  type: 'bull' | 'bear';
  level: number;
  priorStructure: string;
  sweepRef: number;
  bodyRatio: number;
  confirmed: boolean;
  bosRef: number | null;
}

export interface FVGQuality {
  valid: boolean;
  state: string | null;
  bonus: number;
  gapSize?: number;
}

export interface ScoreBreakdown {
  sweep: string;
  choch: string;
  fvg: string;
  bos: string;
  elliott: string;
  [key: string]: string;
}

export interface SetupMetadata {
  inKillzone: boolean;
  isExpired: boolean;
  sessionName: string;
  sessionWeight: number;
  velasDesdeTrigger: number;
  chochConfirmed: boolean;
  invalidationReason: string | null;
  mode: string;
}

export interface TradeSetup {
  type: 'buy' | 'sell';
  setupType: 'impulso' | 'reversion' | 'pullback' | 'unknown';
  entry: number;
  sl: number;
  tp1: number;
  tp2: number;
  tp3: number;
  rr: string;
  score: number;
  breakdown: ScoreBreakdown;
  uiState: 'active' | 'off_session' | 'unconfirmed' | 'low_score' | 'expired';
  expPct: number;
  triggerIdx: number;
  sweep: Sweep;
  bos: BOS | null;
  choch: CHoCH;
  fvgQual: FVGQuality;
  waveLabel: string | null;
  metadata: SetupMetadata;
  execution: { execute: boolean; reason: string };
}

export interface StructureContext {
  structure: 'bullish' | 'bearish' | 'ranging';
  lastSweep: Sweep | null;
  lastBOS: BOS | null;
  lastCHoCH: CHoCH | null;
}

export interface BuildSetupResult {
  setups: TradeSetup[];
  context: StructureContext;
}

export interface AnalysisResult {
  f382: number;
  f500: number;
  f618: number;
  f1272: number;
  f1618: number;
  f2618: number;
  swL: number;
  swH: number;
  rng: number;
  trend: string;
  bull: boolean;
  wl: string;
  nearOB: OrderBlock | undefined;
  nearFVG: FVG | undefined;
  hasLiq: boolean;
  score: number;
  entry: number;
  sl: number;
  tp1: number;
  tp2: number;
  rr: string;
  sigType: 'buy' | 'sell' | 'wait';
  chg: number;
  pct: string;
  isBull: boolean;
}

export interface RawScoreResult {
  score: number;
  breakdown: ScoreBreakdown;
  setupType: 'impulso' | 'reversion' | 'pullback' | 'unknown';
}
// ── Railway Backend Signal ──────────────────────────────
export interface ElliottWave {
  wave_type:        'impulse' | 'corrective' | null;
  bias:             'bullish' | 'bearish' | null;
  current_wave:     string | number | null;
  invalidation_line: number | null;
  waves: {
    label: string;
    price: number;
    time:  string;
  }[];
}

export interface ICTData {
  order_blocks: {
    type:   'bullish_ob' | 'bearish_ob';
    top:    number;
    bottom: number;
    time:   string;
  }[];
  fvgs: {
    type:   'bullish_fvg' | 'bearish_fvg';
    top:    number;
    bottom: number;
    time:   string;
  }[];
  kill_zone: string | null;
}

export interface RailwaySignal {
  status:       string;
  symbol:       string;
  timeframe:    string;
  price:        number;
  timestamp:    string;
  signal_type:  'BUY_LIMIT' | 'SELL_LIMIT' | 'BUY_STOP' | 'SELL_STOP' | 'NO_SIGNAL';
  entry:        number | null;
  sl:           number | null;
  tp1:          number | null;
  tp2:          number | null;
  confidence:   number;
  risk_reward:  number;
  reason:       string[];
  elliott:      ElliottWave;
  ict:          ICTData;
  source:       string;
}
