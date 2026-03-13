from fastapi import APIRouter, HTTPException
from typing import Optional
import httpx
import numpy as np
from datetime import datetime, timezone

router = APIRouter()

TWELVE_DATA_API_KEY = "0a5d85ed50034ae2a02fbbd043328d30"
POLYGON_API_KEY = "ZDgLz1qkTLYHhnMMvbzDk67iB1D4g1YV"

TIMEFRAME_MAP = {
    "15min": "15min",
    "1h": "1h",
    "4h": "4h",
    "1D": "1day",
}

KILL_ZONES = {
    "London Open": (7, 10),
    "New York Open": (12, 15),
    "Asian Session": (0, 3),
}


# ─────────────────────────────────────────
# DATA FETCHING
# ─────────────────────────────────────────

async def fetch_candles(symbol: str, timeframe: str, outputsize: int = 100):
    tf = TIMEFRAME_MAP.get(timeframe, "1h")
    url = (
        f"https://api.twelvedata.com/time_series"
        f"?symbol={symbol}&interval={tf}&outputsize={outputsize}"
        f"&apikey={TWELVE_DATA_API_KEY}&format=JSON"
    )
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(url)
        data = r.json()

    if "values" not in data:
        raise HTTPException(status_code=502, detail=f"Twelve Data error: {data.get('message', 'unknown')}")

    candles = []
    for v in reversed(data["values"]):
        candles.append({
            "time": v["datetime"],
            "open":  float(v["open"]),
            "high":  float(v["high"]),
            "low":   float(v["low"]),
            "close": float(v["close"]),
        })
    return candles


# ─────────────────────────────────────────
# PIVOT / SWING DETECTION
# ─────────────────────────────────────────

def find_pivots(candles, left=3, right=3):
    highs = [c["high"] for c in candles]
    lows  = [c["low"]  for c in candles]
    pivot_highs, pivot_lows = [], []

    for i in range(left, len(candles) - right):
        if all(highs[i] >= highs[i - j] for j in range(1, left + 1)) and \
           all(highs[i] >= highs[i + j] for j in range(1, right + 1)):
            pivot_highs.append({"index": i, "price": highs[i], "time": candles[i]["time"]})

        if all(lows[i] <= lows[i - j] for j in range(1, left + 1)) and \
           all(lows[i] <= lows[i + j] for j in range(1, right + 1)):
            pivot_lows.append({"index": i, "price": lows[i], "time": candles[i]["time"]})

    return pivot_highs, pivot_lows


# ─────────────────────────────────────────
# ELLIOTT WAVE DETECTION
# ─────────────────────────────────────────

def detect_elliott_waves(candles):
    pivot_highs, pivot_lows = find_pivots(candles, left=3, right=3)

    result = {
        "wave_count": None,
        "wave_type": None,
        "waves": [],
        "invalidation_line": None,
        "current_wave": None,
        "bias": None,
    }

    all_pivots = sorted(
        [{"type": "high", **p} for p in pivot_highs] +
        [{"type": "low",  **p} for p in pivot_lows],
        key=lambda x: x["index"]
    )

    if len(all_pivots) < 5:
        return result

    filtered = []
    for p in all_pivots:
        if not filtered or p["type"] != filtered[-1]["type"]:
            filtered.append(p)

    if len(filtered) < 5:
        return result

    recent = filtered[-6:] if len(filtered) >= 6 else filtered

    # Bullish impulse: low-high-low-high-low-high
    if (len(recent) >= 6 and
        recent[0]["type"] == "low" and recent[1]["type"] == "high" and
        recent[2]["type"] == "low" and recent[3]["type"] == "high" and
        recent[4]["type"] == "low" and recent[5]["type"] == "high"):

        w0, w1, w2, w3, w4, w5 = recent[0], recent[1], recent[2], recent[3], recent[4], recent[5]
        wave1 = w1["price"] - w0["price"]
        wave3 = w3["price"] - w2["price"]

        if (w2["price"] > w0["price"] and
            w3["price"] > w1["price"] and
            w4["price"] > w0["price"] and
            wave3 > wave1 * 0.618):

            result["wave_type"] = "impulse"
            result["bias"] = "bullish"
            result["current_wave"] = 5
            result["invalidation_line"] = w4["price"]
            result["waves"] = [
                {"label": "0", "price": w0["price"], "time": w0["time"]},
                {"label": "1", "price": w1["price"], "time": w1["time"]},
                {"label": "2", "price": w2["price"], "time": w2["time"]},
                {"label": "3", "price": w3["price"], "time": w3["time"]},
                {"label": "4", "price": w4["price"], "time": w4["time"]},
                {"label": "5", "price": w5["price"], "time": w5["time"]},
            ]
            return result

    # Bearish impulse: high-low-high-low-high-low
    if (len(recent) >= 6 and
        recent[0]["type"] == "high" and recent[1]["type"] == "low" and
        recent[2]["type"] == "high" and recent[3]["type"] == "low" and
        recent[4]["type"] == "high" and recent[5]["type"] == "low"):

        w0, w1, w2, w3, w4, w5 = recent[0], recent[1], recent[2], recent[3], recent[4], recent[5]

        if (w2["price"] < w0["price"] and
            w3["price"] < w1["price"] and
            w4["price"] < w0["price"]):

            result["wave_type"] = "impulse"
            result["bias"] = "bearish"
            result["current_wave"] = 5
            result["invalidation_line"] = w4["price"]
            result["waves"] = [
                {"label": "0", "price": w0["price"], "time": w0["time"]},
                {"label": "1", "price": w1["price"], "time": w1["time"]},
                {"label": "2", "price": w2["price"], "time": w2["time"]},
                {"label": "3", "price": w3["price"], "time": w3["time"]},
                {"label": "4", "price": w4["price"], "time": w4["time"]},
                {"label": "5", "price": w5["price"], "time": w5["time"]},
            ]
            return result

    # Corrective A-B-C
    if len(recent) >= 3:
        last3 = recent[-3:]
        if last3[0]["type"] == "high" and last3[1]["type"] == "low" and last3[2]["type"] == "high":
            result["wave_type"] = "corrective"
            result["bias"] = "bullish"
            result["current_wave"] = "C"
            result["invalidation_line"] = last3[1]["price"]
            result["waves"] = [
                {"label": "A", "price": last3[0]["price"], "time": last3[0]["time"]},
                {"label": "B", "price": last3[1]["price"], "time": last3[1]["time"]},
                {"label": "C", "price": last3[2]["price"], "time": last3[2]["time"]},
            ]
            return result

        if last3[0]["type"] == "low" and last3[1]["type"] == "high" and last3[2]["type"] == "low":
            result["wave_type"] = "corrective"
            result["bias"] = "bearish"
            result["current_wave"] = "C"
            result["invalidation_line"] = last3[1]["price"]
            result["waves"] = [
                {"label": "A", "price": last3[0]["price"], "time": last3[0]["time"]},
                {"label": "B", "price": last3[1]["price"], "time": last3[1]["time"]},
                {"label": "C", "price": last3[2]["price"], "time": last3[2]["time"]},
            ]
            return result

    return result


# ─────────────────────────────────────────
# ICT CONCEPTS
# ─────────────────────────────────────────

def detect_order_blocks(candles, lookback=20):
    obs = []
    recent = candles[-lookback:]
    for i in range(1, len(recent) - 1):
        c = recent[i]
        next_c = recent[i + 1]
        if c["close"] < c["open"] and next_c["close"] > next_c["open"]:
            move = next_c["close"] - next_c["open"]
            candle_range = c["open"] - c["close"]
            if move > candle_range * 1.5:
                obs.append({
                    "type": "bullish_ob",
                    "top": c["open"],
                    "bottom": c["close"],
                    "time": c["time"],
                })
        elif c["close"] > c["open"] and next_c["close"] < next_c["open"]:
            move = next_c["open"] - next_c["close"]
            candle_range = c["close"] - c["open"]
            if move > candle_range * 1.5:
                obs.append({
                    "type": "bearish_ob",
                    "top": c["close"],
                    "bottom": c["open"],
                    "time": c["time"],
                })
    return obs[-3:]


def detect_fvg(candles, lookback=30):
    fvgs = []
    recent = candles[-lookback:]
    for i in range(1, len(recent) - 1):
        prev = recent[i - 1]
        curr = recent[i]
        nxt  = recent[i + 1]
        if nxt["low"] > prev["high"]:
            fvgs.append({
                "type": "bullish_fvg",
                "top": nxt["low"],
                "bottom": prev["high"],
                "time": curr["time"],
            })
        elif nxt["high"] < prev["low"]:
            fvgs.append({
                "type": "bearish_fvg",
                "top": prev["low"],
                "bottom": nxt["high"],
                "time": curr["time"],
            })
    return fvgs[-3:]


def detect_kill_zone(candles):
    last_time = candles[-1]["time"]
    try:
        dt = datetime.fromisoformat(last_time.replace(" ", "T"))
        hour = dt.hour
        for name, (start, end) in KILL_ZONES.items():
            if start <= hour < end:
                return name
    except Exception:
        pass
    return None


# ─────────────────────────────────────────
# TRADE SIGNAL GENERATOR
# ─────────────────────────────────────────

def generate_trade_signal(candles, elliott, order_blocks, fvgs, kill_zone):
    last = candles[-1]
    price = last["close"]
    bias = elliott.get("bias")
    invalidation = elliott.get("invalidation_line")

    if not bias or not invalidation:
        return {
            "signal_type": "NO_SIGNAL",
            "entry": None, "sl": None, "tp1": None, "tp2": None,
            "confidence": 0.0, "risk_reward": 0.0,
            "reason": ["Insufficient Elliott Wave data"]
        }

    relevant_obs = [ob for ob in order_blocks if
                    (bias == "bullish" and ob["type"] == "bullish_ob") or
                    (bias == "bearish" and ob["type"] == "bearish_ob")]

    relevant_fvgs = [fvg for fvg in fvgs if
                     (bias == "bullish" and fvg["type"] == "bullish_fvg") or
                     (bias == "bearish" and fvg["type"] == "bearish_fvg")]

    atr = np.mean([c["high"] - c["low"] for c in candles[-14:]])
    reason = []
    signal_type = None
    entry = None

    if bias == "bullish":
        if relevant_obs:
            ob = relevant_obs[-1]
            entry = round((ob["top"] + ob["bottom"]) / 2, 5)
            signal_type = "BUY_LIMIT"
            reason.append("Price near bullish Order Block")
        elif relevant_fvgs:
            fvg = relevant_fvgs[-1]
            entry = round((fvg["top"] + fvg["bottom"]) / 2, 5)
            signal_type = "BUY_LIMIT"
            reason.append("Price in bullish Fair Value Gap")
        else:
            entry = round(price, 5)
            signal_type = "BUY_STOP"
            reason.append("Breakout entry — no OB/FVG nearby")

        sl  = round(invalidation - atr * 0.3, 5)
        tp1 = round(entry + atr * 2, 5)
        tp2 = round(entry + atr * 4, 5)

    else:
        if relevant_obs:
            ob = relevant_obs[-1]
            entry = round((ob["top"] + ob["bottom"]) / 2, 5)
            signal_type = "SELL_LIMIT"
            reason.append("Price near bearish Order Block")
        elif relevant_fvgs:
            fvg = relevant_fvgs[-1]
            entry = round((fvg["top"] + fvg["bottom"]) / 2, 5)
            signal_type = "SELL_LIMIT"
            reason.append("Price in bearish Fair Value Gap")
        else:
            entry = round(price, 5)
            signal_type = "SELL_STOP"
            reason.append("Breakout entry — no OB/FVG nearby")

        sl  = round(invalidation + atr * 0.3, 5)
        tp1 = round(entry - atr * 2, 5)
        tp2 = round(entry - atr * 4, 5)

    confidence = 0.4
    if relevant_obs:   confidence += 0.2
    if relevant_fvgs:  confidence += 0.15
    if kill_zone:
        confidence += 0.15
        reason.append(f"Active Kill Zone: {kill_zone}")
    if elliott.get("wave_type") == "impulse":
        confidence += 0.1
        reason.append("Impulse wave structure confirmed")

    confidence = round(min(confidence, 0.99), 2)
    rr = round(abs(tp1 - entry) / abs(entry - sl), 2) if entry != sl else 0

    return {
        "signal_type": signal_type,
        "entry": entry,
        "sl": sl,
        "tp1": tp1,
        "tp2": tp2,
        "confidence": confidence,
        "risk_reward": rr,
        "reason": reason,
    }


# ─────────────────────────────────────────
# MAIN ENDPOINT
# ─────────────────────────────────────────

@router.get("/signal")
async def get_signal(symbol: str = "EUR/USD", timeframe: str = "1h"):
    candles = await fetch_candles(symbol, timeframe, outputsize=100)

    elliott   = detect_elliott_waves(candles)
    obs       = detect_order_blocks(candles)
    fvgs      = detect_fvg(candles)
    kill_zone = detect_kill_zone(candles)
    trade     = generate_trade_signal(candles, elliott, obs, fvgs, kill_zone)

    return {
        "status": "success",
        "symbol": symbol,
        "timeframe": timeframe,
        "price": candles[-1]["close"],
        "timestamp": candles[-1]["time"],
        "signal_type": trade["signal_type"],
        "entry": trade["entry"],
        "sl": trade["sl"],
        "tp1": trade["tp1"],
        "tp2": trade["tp2"],
        "confidence": trade["confidence"],
        "risk_reward": trade["risk_reward"],
        "reason": trade["reason"],
        "elliott": {
            "wave_type": elliott["wave_type"],
            "bias": elliott["bias"],
            "current_wave": elliott["current_wave"],
            "invalidation_line": elliott["invalidation_line"],
            "waves": elliott["waves"],
        },
        "ict": {
            "order_blocks": obs,
            "fvgs": fvgs,
            "kill_zone": kill_zone,
        },
        "source": "live",
    }
