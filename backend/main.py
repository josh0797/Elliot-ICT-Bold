from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import signal, health

app = FastAPI(title="Elliott ICT Pro API")
app.add_middleware(CORSMiddleware, allow_origins=["*"],
  allow_methods=["*"], allow_headers=["*"])
app.include_router(health.router)
app.include_router(signal.router, prefix="/api")
