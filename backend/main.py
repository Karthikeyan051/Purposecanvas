"""
PurposeCanvas — FastAPI Main Application
All routes: generate, stats, benchmark, WebSocket events, static images.
"""
import asyncio
import json
import logging
import time
import uuid
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .config import settings
from . import db, intent, cache, cost as cost_module
from .generator import generate, manager
from .postprocess import postprocess
from .quality import check as quality_check
from .profiles import get_profile, BASELINE_PROFILE

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logger = logging.getLogger("purposecanvas")

# ── App setup ────────────────────────────────────────────────────────────────

app = FastAPI(title="PurposeCanvas API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve generated images statically
img_dir = Path(settings.GENERATED_IMAGES_DIR)
img_dir.mkdir(parents=True, exist_ok=True)
app.mount("/images", StaticFiles(directory=str(img_dir)), name="images")


@app.on_event("startup")
async def startup():
    db.init()
    logger.info("PurposeCanvas API ready")


# ── WebSocket manager ─────────────────────────────────────────────────────────

class ConnectionManager:
    def __init__(self):
        self.active: dict[str, WebSocket] = {}

    async def connect(self, ws: WebSocket, client_id: str):
        await ws.accept()
        self.active[client_id] = ws
        logger.info(f"WS connected: {client_id} (total={len(self.active)})")

    def disconnect(self, client_id: str):
        self.active.pop(client_id, None)
        logger.info(f"WS disconnected: {client_id}")

    async def broadcast(self, data: dict):
        dead = []
        for cid, ws in self.active.items():
            try:
                await ws.send_text(json.dumps(data))
            except Exception:
                dead.append(cid)
        for cid in dead:
            self.disconnect(cid)


ws_manager = ConnectionManager()


@app.websocket("/ws/events")
async def websocket_events(ws: WebSocket):
    client_id = str(uuid.uuid4())
    await ws_manager.connect(ws, client_id)
    try:
        while True:
            await ws.receive_text()   # keep-alive ping
    except WebSocketDisconnect:
        ws_manager.disconnect(client_id)


# ── Models ────────────────────────────────────────────────────────────────────

class GenerateRequest(BaseModel):
    prompt: str
    school_id: str = "s01"
    mode: str = "smart"           # "smart" | "baseline"
    clarification: Optional[str] = None   # from purpose chips


class GenerateResponse(BaseModel):
    request_id: str
    image_url: str
    intent: dict
    profile: str
    cache_hit: bool
    escalated: bool
    gpu_seconds: float
    energy_wh: float
    cost_usd: float
    baseline_gpu_seconds: float
    saved_pct: float
    latency_ms: float
    steps: list[dict]


# ── /api/generate ─────────────────────────────────────────────────────────────

@app.post("/api/generate", response_model=GenerateResponse)
async def api_generate(req: GenerateRequest):
    request_id = str(uuid.uuid4())
    t_start = time.perf_counter()
    steps = []

    await ws_manager.broadcast({"event": "request_received", "request_id": request_id, "ts": time.time()})

    # ── School name lookup ───────────────────────────────────────────────────
    school = next((s for s in db.SCHOOLS if s["id"] == req.school_id), db.SCHOOLS[0])

    # ── BASELINE MODE ────────────────────────────────────────────────────────
    if req.mode == "baseline":
        profile = BASELINE_PROFILE
        t_gen = time.perf_counter()
        await ws_manager.broadcast({"event": "generating_start", "request_id": request_id, "tier": "sdxl_baseline"})

        gen_result = await asyncio.to_thread(generate, profile, req.prompt)

        await ws_manager.broadcast({"event": "generating_end", "request_id": request_id, "gpu_seconds": gen_result.gpu_seconds})

        metrics = cost_module.compute(gen_result.gpu_seconds, gen_result.energy_wh, "poster")
        latency_ms = (time.perf_counter() - t_start) * 1000

        db.log_request(db.RequestRecord(
            school_id=req.school_id, school_name=school["name"],
            prompt=req.prompt, mode="baseline", type="poster",
            profile=profile.name, cache_hit=False, escalated=False,
            gpu_seconds=gen_result.gpu_seconds, energy_wh=gen_result.energy_wh,
            cost=metrics.cost_usd, latency_ms=latency_ms,
            image_path=gen_result.image_path, image_url=gen_result.image_url,
        ))

        return GenerateResponse(
            request_id=request_id,
            image_url=gen_result.image_url,
            intent={"type": "poster", "colour": "colour", "confidence": 1.0, "key": "baseline"},
            profile=profile.name, cache_hit=False, escalated=False,
            gpu_seconds=gen_result.gpu_seconds, energy_wh=gen_result.energy_wh,
            cost_usd=metrics.cost_usd, baseline_gpu_seconds=metrics.baseline_gpu_seconds,
            saved_pct=0.0, latency_ms=latency_ms,
            steps=[{"name": "baseline", "duration_ms": latency_ms, "detail": "SDXL 25-step (no routing)"}],
        )

    # ── SMART MODE ───────────────────────────────────────────────────────────

    # Step 1: Intent
    t_step = time.perf_counter()
    intent_result = await asyncio.to_thread(intent.classify, req.prompt, req.clarification)
    step_intent_ms = (time.perf_counter() - t_step) * 1000
    steps.append({"name": "intent", "duration_ms": round(step_intent_ms, 1),
                  "detail": f"{intent_result.type} ({intent_result.confidence:.0%} confidence)"})

    # If needs confirmation — return early so UI shows chips
    if intent_result.needs_confirmation and not req.clarification:
        return JSONResponse(content={
            "needs_confirmation": True,
            "options": intent_result.options,
            "intent": intent_result.dict(),
            "request_id": request_id,
        })

    # Step 2: Cache lookup
    t_step = time.perf_counter()
    cache_result = await asyncio.to_thread(cache.lookup, intent_result.key)
    step_cache_ms = (time.perf_counter() - t_step) * 1000
    steps.append({"name": "cache", "duration_ms": round(step_cache_ms, 1),
                  "detail": f"HIT (sim={cache_result.similarity:.2f})" if cache_result else "MISS"})

    if cache_result:
        await ws_manager.broadcast({"event": "cache_hit", "request_id": request_id,
                                     "similarity": cache_result.similarity})
        latency_ms = (time.perf_counter() - t_start) * 1000
        metrics = cost_module.compute(0.0, 0.0, intent_result.type)
        db.log_request(db.RequestRecord(
            school_id=req.school_id, school_name=school["name"],
            prompt=req.prompt, mode="smart", type=intent_result.type,
            profile="cache_hit", cache_hit=True, escalated=False,
            gpu_seconds=0.0, energy_wh=0.0, cost=0.0, latency_ms=latency_ms,
            image_path=cache_result.image_path, image_url=cache_result.image_url,
        ))
        return GenerateResponse(
            request_id=request_id,
            image_url=cache_result.image_url,
            intent=intent_result.dict(),
            profile="cache_hit", cache_hit=True, escalated=False,
            gpu_seconds=0.0, energy_wh=0.0, cost_usd=0.0,
            baseline_gpu_seconds=22.0, saved_pct=100.0,
            latency_ms=latency_ms, steps=steps,
        )

    # Step 3: Profile selection
    t_step = time.perf_counter()
    profile = get_profile(intent_result.type, tier=0)
    step_profile_ms = (time.perf_counter() - t_step) * 1000
    steps.append({"name": "profile", "duration_ms": round(step_profile_ms, 1),
                  "detail": profile.name})

    # Step 4: Generate
    t_step = time.perf_counter()
    await ws_manager.broadcast({"event": "generating_start", "request_id": request_id, "tier": profile.model_id})

    total_gpu_s = 0.0
    total_wh = 0.0
    escalated = False
    final_profile = profile

    def _gen_fn(p):
        return asyncio.get_event_loop().run_in_executor(None, lambda: _sync_gen(p, req.prompt))

    gen_result = await asyncio.to_thread(generate, profile, req.prompt)
    total_gpu_s += gen_result.gpu_seconds
    total_wh += gen_result.energy_wh

    await ws_manager.broadcast({"event": "generating_end", "request_id": request_id, "gpu_seconds": gen_result.gpu_seconds})
    step_gen_ms = (time.perf_counter() - t_step) * 1000
    steps.append({"name": "generate", "duration_ms": round(step_gen_ms, 1),
                  "detail": f"{profile.model_id} {profile.steps}-step {profile.width}px"})

    # Step 5: Postprocess
    from PIL import Image as PILImage
    pil_img = PILImage.open(gen_result.image_path)
    processed_img = await asyncio.to_thread(postprocess, pil_img, intent_result.type)

    # Step 6: Quality gate with escalation
    t_step = time.perf_counter()

    def _sync_escalate(p):
        result = generate(p, req.prompt)
        pp = postprocess(PILImage.open(result.image_path), intent_result.type)
        return pp, result.gpu_seconds, result.energy_wh

    final_img, quality_result, extra_gpu, extra_wh = await asyncio.to_thread(
        quality_check,
        processed_img,
        intent_result.type,
        intent_result.safe,
        profile,
        _sync_escalate,
    )
    total_gpu_s += extra_gpu
    total_wh += extra_wh
    escalated = quality_result.escalated
    final_profile = quality_result.final_profile

    step_quality_ms = (time.perf_counter() - t_step) * 1000
    steps.append({"name": "quality", "duration_ms": round(step_quality_ms, 1),
                  "detail": "pass" if quality_result.passed else f"escalated: {quality_result.reason}"})

    if escalated:
        await ws_manager.broadcast({"event": "escalated", "request_id": request_id,
                                     "from_tier": profile.tier, "to_tier": final_profile.tier})

    # Save final image
    import uuid as _uuid
    final_filename = f"{_uuid.uuid4()}.png"
    final_path = img_dir / final_filename
    final_img.save(str(final_path))
    final_url = f"/images/{final_filename}"

    # Store in cache
    await asyncio.to_thread(cache.store, intent_result.key, str(final_path), final_url)

    # Compute costs
    metrics = cost_module.compute(total_gpu_s, total_wh, intent_result.type)
    latency_ms = (time.perf_counter() - t_start) * 1000

    # Log to DB
    db.log_request(db.RequestRecord(
        school_id=req.school_id, school_name=school["name"],
        prompt=req.prompt, mode="smart", type=intent_result.type,
        profile=final_profile.name, cache_hit=False, escalated=escalated,
        gpu_seconds=total_gpu_s, energy_wh=total_wh,
        cost=metrics.cost_usd, latency_ms=latency_ms,
        image_path=str(final_path), image_url=final_url,
    ))

    await ws_manager.broadcast({"event": "complete", "request_id": request_id,
                                  "image_url": final_url, "gpu_seconds": total_gpu_s})

    return GenerateResponse(
        request_id=request_id,
        image_url=final_url,
        intent=intent_result.dict(),
        profile=final_profile.name,
        cache_hit=False,
        escalated=escalated,
        gpu_seconds=total_gpu_s,
        energy_wh=total_wh,
        cost_usd=metrics.cost_usd,
        baseline_gpu_seconds=metrics.baseline_gpu_seconds,
        saved_pct=metrics.saved_pct,
        latency_ms=latency_ms,
        steps=steps,
    )


# ── /api/stats ────────────────────────────────────────────────────────────────

@app.get("/api/stats")
async def api_stats():
    return db.get_stats()


# ── /api/benchmark ────────────────────────────────────────────────────────────

BENCHMARK_PROMPTS = [
    # Outlines (14)
    ("draw a cow for children to colour in", "s01"),
    ("outline of a cat, simple", "s02"),
    ("elephant for colouring worksheet", "s03"),
    ("lion outline kids coloring book", "s04"),
    ("dog outline for grade 2", "s05"),
    ("fish simple outline", "s06"),
    ("tree outline worksheet", "s07"),
    ("flower coloring page", "s08"),
    ("house outline simple", "s09"),
    ("sun and moon outline", "s10"),
    ("butterfly for coloring", "s11"),
    ("rabbit outline colouring", "s12"),
    ("frog outline simple kids", "s01"),
    ("bicycle outline worksheet", "s02"),
    # Flashcards (3)
    ("flashcard for letter A with apple", "s03"),
    ("vocabulary card for the word WATER with an image", "s04"),
    ("math flashcard showing 2 plus 2 equals 4", "s05"),
    # Posters (3)
    ("colorful annual report cover for a school district", "s06"),
    ("motivational poster for a classroom wall bright colors", "s07"),
    ("science fair display board header professional", "s08"),
]


@app.post("/api/benchmark")
async def api_benchmark():
    """
    Run 20 prompts in both baseline and smart mode.
    Returns side-by-side results with real measured GPU-seconds.
    """
    results = []
    total_baseline_gpu = 0.0
    total_smart_gpu = 0.0

    for i, (prompt, school_id) in enumerate(BENCHMARK_PROMPTS):
        await ws_manager.broadcast({"event": "benchmark_progress", "completed": i, "total": len(BENCHMARK_PROMPTS)})

        # Baseline run
        baseline_gen = await asyncio.to_thread(generate, BASELINE_PROFILE, prompt)
        total_baseline_gpu += baseline_gen.gpu_seconds

        # Smart run
        intent_r = await asyncio.to_thread(intent.classify, prompt)
        cache_r = await asyncio.to_thread(cache.lookup, intent_r.key)

        if cache_r:
            smart_gpu = 0.0
            smart_url = cache_r.image_url
            smart_profile = "cache_hit"
            was_cached = True
        else:
            smart_prof = get_profile(intent_r.type, 0)
            smart_gen = await asyncio.to_thread(generate, smart_prof, prompt)
            smart_gpu = smart_gen.gpu_seconds
            smart_url = smart_gen.image_url
            smart_profile = smart_prof.name
            was_cached = False
            await asyncio.to_thread(cache.store, intent_r.key, smart_gen.image_path, smart_gen.image_url)

        total_smart_gpu += smart_gpu

        results.append({
            "index": i + 1,
            "prompt": prompt,
            "intent_type": intent_r.type,
            "baseline": {
                "gpu_seconds": round(baseline_gen.gpu_seconds, 2),
                "cost_usd": round(baseline_gen.gpu_seconds * settings.COST_PER_GPU_SECOND, 5),
                "image_url": baseline_gen.image_url,
                "profile": BASELINE_PROFILE.name,
            },
            "smart": {
                "gpu_seconds": round(smart_gpu, 2),
                "cost_usd": round(smart_gpu * settings.COST_PER_GPU_SECOND, 5),
                "image_url": smart_url,
                "profile": smart_profile,
                "cache_hit": was_cached,
            },
        })

    saved_pct = ((total_baseline_gpu - total_smart_gpu) / total_baseline_gpu * 100) if total_baseline_gpu > 0 else 0

    await ws_manager.broadcast({"event": "benchmark_complete",
                                  "total_baseline_gpu": total_baseline_gpu,
                                  "total_smart_gpu": total_smart_gpu,
                                  "saved_pct": round(saved_pct, 1)})

    return {
        "results": results,
        "summary": {
            "total_baseline_gpu_seconds": round(total_baseline_gpu, 2),
            "total_smart_gpu_seconds": round(total_smart_gpu, 2),
            "saved_gpu_seconds": round(total_baseline_gpu - total_smart_gpu, 2),
            "saved_pct": round(saved_pct, 1),
            "baseline_cost_usd": round(total_baseline_gpu * settings.COST_PER_GPU_SECOND, 4),
            "smart_cost_usd": round(total_smart_gpu * settings.COST_PER_GPU_SECOND, 4),
            "cost_label": "assumed cloud rate",
        },
    }


# ── /api/health ───────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "models_loaded": manager.loaded_models(),
        "cache_items": cache.count(),
    }
