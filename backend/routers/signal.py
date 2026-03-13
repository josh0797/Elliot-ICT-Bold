from fastapi import APIRouter
router = APIRouter()
@router.get("/signal")
def get_signal(symbol: str = "EURUSD", timeframe: str = "1h"):
    return {"status":"success","symbol":symbol,"timeframe":timeframe,
            "signal":"BUY","confidence":0.85,"entry":1.0850,
            "sl":1.0800,"tp1":1.0920,"tp2":1.0980,"source":"mock"}
