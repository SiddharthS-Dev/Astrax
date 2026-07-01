"""
AstraX EB1 Control Tower – FastAPI Application Entrypoint
=========================================================
Assembles all routers, configures CORS, and exposes the app instance.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import engine, Base
from routers import auth, experiments, reports, users


# ── Lifespan: create tables on startup (dev convenience) ──────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    On startup, create any missing database tables.
    In production, use Alembic migrations instead.
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


# ── App Instance ──────────────────────────────────────────────────────────
app = FastAPI(
    title="AstraX EB1 Control Tower",
    description=(
        "Backend API for the AstraX EB1 hardware engineering project management "
        "dashboard. Provides authentication, role-based access control, "
        "experiment tracking, team management, and report generation."
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS (allow frontend dev server) ──────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # Vite dev server
        "http://localhost:3000",   # Alternate dev port
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register Routers ─────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(experiments.router)
app.include_router(reports.router)


# ── Health Check ──────────────────────────────────────────────────────────
@app.get("/health", tags=["System"])
async def health_check():
    """Simple liveness probe."""
    return {"status": "healthy", "service": "AstraX EB1 Control Tower"}
