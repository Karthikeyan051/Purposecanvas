"""
PurposeCanvas — SQLite Request Logger + Stats
Logs every request. Provides aggregated stats for dashboard.
"""
import sqlite3
import time
import uuid
import logging
from dataclasses import dataclass, field
from typing import Optional
from pathlib import Path

from .config import settings

logger = logging.getLogger(__name__)

DB_PATH = settings.DB_PATH

# ── Seed schools ──────────────────────────────────────────────────────────────

SCHOOLS = [
    {"id": "s01", "name": "Springfield Elementary"},
    {"id": "s02", "name": "Shelbyville Middle School"},
    {"id": "s03", "name": "Ogdenville Primary"},
    {"id": "s04", "name": "North Haverbrook High"},
    {"id": "s05", "name": "Capital City Academy"},
    {"id": "s06", "name": "Brockway School"},
    {"id": "s07", "name": "Cypress Creek Elementary"},
    {"id": "s08", "name": "Waverly Hills School"},
    {"id": "s09", "name": "West Springfield School"},
    {"id": "s10", "name": "Shelbyville High"},
    {"id": "s11", "name": "Grandpa's School"},
    {"id": "s12", "name": "District Office Lab School"},
]


# ── Schema ─────────────────────────────────────────────────────────────────────

CREATE_TABLE = """
CREATE TABLE IF NOT EXISTS requests (
    id          TEXT PRIMARY KEY,
    ts          REAL NOT NULL,
    school_id   TEXT NOT NULL,
    school_name TEXT NOT NULL,
    prompt      TEXT NOT NULL,
    mode        TEXT NOT NULL,
    type        TEXT NOT NULL,
    profile     TEXT NOT NULL,
    cache_hit   INTEGER NOT NULL DEFAULT 0,
    escalated   INTEGER NOT NULL DEFAULT 0,
    gpu_seconds REAL NOT NULL DEFAULT 0,
    energy_wh   REAL NOT NULL DEFAULT 0,
    cost        REAL NOT NULL DEFAULT 0,
    latency_ms  REAL NOT NULL DEFAULT 0,
    image_path  TEXT NOT NULL,
    image_url   TEXT NOT NULL
);
"""

CREATE_SCHOOLS_TABLE = """
CREATE TABLE IF NOT EXISTS schools (
    id   TEXT PRIMARY KEY,
    name TEXT NOT NULL
);
"""


# ── Init ────────────────────────────────────────────────────────────────────────

def init():
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    with _conn() as con:
        con.execute(CREATE_TABLE)
        con.execute(CREATE_SCHOOLS_TABLE)
        # Seed schools
        for s in SCHOOLS:
            con.execute(
                "INSERT OR IGNORE INTO schools (id, name) VALUES (?, ?)",
                (s["id"], s["name"])
            )
    logger.info(f"DB initialised at {DB_PATH}")


def _conn():
    return sqlite3.connect(DB_PATH)


# ── Log request ──────────────────────────────────────────────────────────────

@dataclass
class RequestRecord:
    school_id: str
    school_name: str
    prompt: str
    mode: str
    type: str
    profile: str
    cache_hit: bool
    escalated: bool
    gpu_seconds: float
    energy_wh: float
    cost: float
    latency_ms: float
    image_path: str
    image_url: str
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    ts: float = field(default_factory=time.time)


def log_request(rec: RequestRecord) -> str:
    with _conn() as con:
        con.execute("""
            INSERT INTO requests
            (id, ts, school_id, school_name, prompt, mode, type, profile,
             cache_hit, escalated, gpu_seconds, energy_wh, cost, latency_ms,
             image_path, image_url)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            rec.id, rec.ts, rec.school_id, rec.school_name, rec.prompt, rec.mode,
            rec.type, rec.profile, int(rec.cache_hit), int(rec.escalated),
            rec.gpu_seconds, rec.energy_wh, rec.cost, rec.latency_ms,
            rec.image_path, rec.image_url,
        ))
    return rec.id


# ── Stats ───────────────────────────────────────────────────────────────────

def get_stats() -> dict:
    with _conn() as con:
        con.row_factory = sqlite3.Row

        # Totals
        row = con.execute("""
            SELECT
                COUNT(*)          AS total_requests,
                SUM(gpu_seconds)  AS total_gpu_s,
                SUM(energy_wh)    AS total_wh,
                SUM(cost)         AS total_cost,
                SUM(cache_hit)    AS total_cache_hits,
                SUM(escalated)    AS total_escalated,
                AVG(latency_ms)   AS avg_latency_ms
            FROM requests
        """).fetchone()

        total = dict(row) if row else {}
        total_requests = total.get("total_requests") or 0
        cache_hits = total.get("total_cache_hits") or 0

        # Savings vs baseline (22 GPU-s each)
        smart_rows = con.execute("""
            SELECT SUM(gpu_seconds) as s FROM requests WHERE mode='smart'
        """).fetchone()
        smart_gpu = (smart_rows["s"] or 0.0) if smart_rows else 0.0

        smart_count = (con.execute(
            "SELECT COUNT(*) as c FROM requests WHERE mode='smart'"
        ).fetchone() or {}).get("c", 0)
        baseline_equivalent = smart_count * 22.0
        saved_gpu_s = max(0.0, baseline_equivalent - smart_gpu)
        saved_cost = saved_gpu_s * 0.0004

        # Per-school
        per_school = []
        rows = con.execute("""
            SELECT school_id, school_name,
                   COUNT(*) as count,
                   SUM(gpu_seconds) as gpu_s,
                   SUM(cost) as cost,
                   SUM(cache_hit) as cache_hits
            FROM requests GROUP BY school_id
            ORDER BY gpu_s DESC LIMIT 12
        """).fetchall()
        for r in rows:
            school_baseline = r["count"] * 22.0
            school_saved = max(0.0, school_baseline - (r["gpu_s"] or 0.0))
            per_school.append({
                "school_id": r["school_id"],
                "school_name": r["school_name"],
                "count": r["count"],
                "gpu_seconds": r["gpu_s"] or 0.0,
                "cost": r["cost"] or 0.0,
                "cache_hits": r["cache_hits"] or 0,
                "saved_gpu_seconds": school_saved,
            })

        # Per-type
        per_type = []
        rows = con.execute("""
            SELECT type, COUNT(*) as count,
                   SUM(gpu_seconds) as gpu_s,
                   SUM(cost) as cost
            FROM requests GROUP BY type
        """).fetchall()
        for r in rows:
            per_type.append({
                "type": r["type"],
                "count": r["count"],
                "gpu_seconds": r["gpu_s"] or 0.0,
                "cost": r["cost"] or 0.0,
            })

        # Recent for time-series chart
        recent = []
        rows = con.execute("""
            SELECT ts, gpu_seconds, cache_hit, type, mode
            FROM requests ORDER BY ts DESC LIMIT 50
        """).fetchall()
        for r in rows:
            recent.append(dict(r))

        return {
            "totals": {
                "requests": total_requests,
                "gpu_seconds": total.get("total_gpu_s") or 0.0,
                "energy_wh": total.get("total_wh") or 0.0,
                "cost_usd": total.get("total_cost") or 0.0,
                "cache_hits": cache_hits,
                "cache_hit_rate": (cache_hits / total_requests) if total_requests else 0.0,
                "escalated": total.get("total_escalated") or 0,
                "avg_latency_ms": total.get("avg_latency_ms") or 0.0,
            },
            "savings": {
                "gpu_seconds_saved": saved_gpu_s,
                "cost_saved_usd": saved_cost,
                "pct_saved": (saved_gpu_s / baseline_equivalent * 100) if baseline_equivalent > 0 else 0.0,
                "baseline_gpu_seconds_equivalent": baseline_equivalent,
            },
            "per_school": per_school,
            "per_type": per_type,
            "recent": recent,
            "schools": SCHOOLS,
        }
