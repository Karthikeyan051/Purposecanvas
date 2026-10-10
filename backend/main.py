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
from . import db, cache, cost as cost_module
from .intent import classify as intent_classify, build_prompt_card
from .generator import generate, manager
from .postprocess import postprocess
from .quality import check as quality_check
from .profiles import get_profile, BASELINE_PROFILE
from .document_parser import extract_points
from .domain_classifier import classify_domain, DomainResult

UPLOAD_DIR = Path("backend/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

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
    clarification: Optional[str] = None
    tier: int = 0                  # 0=Draft, 1=Standard, 2=Quality
    intent_override: Optional[str] = None  # teacher-forced type from UI


class GenerateResponse(BaseModel):
    request_id: str
    image_url: str
    intent: dict
    prompt_card: dict          # Full copyable JSON for any AI generator
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
    resource_card: dict = {}   # Full savings breakdown for the UI resource meter

class ClassifyRequest(BaseModel):
    prompt: str

@app.post("/api/classify")
async def api_classify(req: ClassifyRequest):
    """Real-time intent classification for the UI tier picker."""
    # 1. Classify intent
    intent_result = await asyncio.to_thread(intent_classify, req.prompt, None)
    
    # 2. Get the profile ladder for this intent type
    from .profiles import get_ladder
    ladder = get_ladder(intent_result.type)
    
    # Return intent + the available resource cards for UI rendering
    return {
        "intent": intent_result.dict(),
        "profiles": [p.resource_card() for p in ladder],
        "reasoning": intent_result.reasoning,
        "signal_words": intent_result.signal_words,
        "recommended_tier": intent_result.recommended_tier,
    }


# ── /api/generate ─────────────────────────────────────────────────────────────

@app.post("/api/generate", response_model=GenerateResponse)
async def api_generate(req: GenerateRequest):
    request_id = str(uuid.uuid4())
    t_start = time.perf_counter()
    steps = []

    await ws_manager.broadcast({"event": "request_received", "request_id": request_id, "ts": time.time()})

    # ── School name lookup ───────────────────────────────────────────────────
    school = next((s for s in db.SCHOOLS if s["id"] == req.school_id), db.SCHOOLS[0])

    # ── BASELINE MODE ─────────────────────────────────────────────────────────
    if req.mode == "baseline":
        profile = BASELINE_PROFILE
        # Build a simple prompt card for baseline mode
        from .intent import IntentResult as _IR, build_prompt_card as _bpc, _engineer_prompts
        _base_intent = _engineer_prompts(_IR(
            type="poster", subject=req.prompt[:40], colour="colour",
            age_group="6-12", use="publication", complexity=3,
            safe=True, confidence=1.0, key="baseline",
        ))
        baseline_card = _bpc(_base_intent)

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
            prompt_card=baseline_card,
            profile=profile.name, cache_hit=False, escalated=False,
            gpu_seconds=gen_result.gpu_seconds, energy_wh=gen_result.energy_wh,
            cost_usd=metrics.cost_usd, baseline_gpu_seconds=metrics.baseline_gpu_seconds,
            saved_pct=0.0, latency_ms=latency_ms,
            steps=[{"name": "baseline", "duration_ms": latency_ms, "detail": "SDXL 25-step (no routing)"}],
            resource_card=BASELINE_PROFILE.resource_card(),
        )


    # ── SMART MODE ────────────────────────────────────────────────────────────

    # Step 1: Intent + Prompt Engineering
    t_step = time.perf_counter()
    intent_result = await asyncio.to_thread(intent_classify, req.prompt, req.clarification)
    step_intent_ms = (time.perf_counter() - t_step) * 1000
    steps.append({"name": "intent", "duration_ms": round(step_intent_ms, 1),
                  "detail": f"{intent_result.type} ({intent_result.confidence:.0%} confidence)"})

    # Build the copyable prompt card JSON
    prompt_card = build_prompt_card(intent_result)

    # If needs confirmation — return early so UI shows chips
    if intent_result.needs_confirmation and not req.clarification:
        return JSONResponse(content={
            "needs_confirmation": True,
            "options": intent_result.options,
            "intent": intent_result.dict(),
            "prompt_card": prompt_card,
            "request_id": request_id,
        })

    # Step 2: Cache lookup
    t_step = time.perf_counter()
    cache_result = await asyncio.to_thread(cache.lookup, intent_result.key)
    step_cache_ms = (time.perf_counter() - t_step) * 1000
    steps.append({"name": "cache", "duration_ms": round(step_cache_ms, 1),
                  "detail": f"HIT (sim={cache_result.get('similarity', 1.0):.2f})" if cache_result else "MISS"})

    if cache_result:
        await ws_manager.broadcast({"event": "cache_hit", "request_id": request_id,
                                     "similarity": cache_result.get("similarity", 1.0)})
        latency_ms = (time.perf_counter() - t_start) * 1000
        metrics = cost_module.compute(0.0, 0.0, intent_result.type)
        db.log_request(db.RequestRecord(
            school_id=req.school_id, school_name=school["name"],
            prompt=req.prompt, mode="smart", type=intent_result.type,
            profile="cache_hit", cache_hit=True, escalated=False,
            gpu_seconds=0.0, energy_wh=0.0, cost=0.0, latency_ms=latency_ms,
            image_path=cache_result["image_path"], image_url=cache_result["image_url"],
        ))
        return GenerateResponse(
            request_id=request_id,
            image_url=cache_result["image_url"],
            intent=intent_result.dict(),
            prompt_card=prompt_card,
            profile="cache_hit", cache_hit=True, escalated=False,
            gpu_seconds=0.0, energy_wh=0.0, cost_usd=0.0,
            baseline_gpu_seconds=22.0, saved_pct=100.0,
            latency_ms=latency_ms, steps=steps,
        )

    # Step 3: Profile selection — use teacher-selected tier if provided
    t_step = time.perf_counter()
    effective_type = req.intent_override or intent_result.type
    profile = get_profile(effective_type, tier=req.tier)
    step_profile_ms = (time.perf_counter() - t_step) * 1000
    steps.append({"name": "profile", "duration_ms": round(step_profile_ms, 1),
                  "detail": f"{profile.name} (tier={req.tier})"})

    # Step 4: Generate
    t_step = time.perf_counter()
    await ws_manager.broadcast({"event": "generating_start", "request_id": request_id, "tier": profile.model_id})

    total_gpu_s = 0.0
    total_wh = 0.0
    escalated = False
    final_profile = profile

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

    # Step 6: Quality gate — escalate to higher tier if quality fails
    t_step = time.perf_counter()

    def _sync_escalate(escalate_profile):
        """Synchronous escalation function called by quality_check."""
        esc_result = generate(escalate_profile, req.prompt)
        esc_img = postprocess(PILImage.open(esc_result.image_path), intent_result.type)
        return esc_img, esc_result.gpu_seconds, esc_result.energy_wh

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
        prompt_card=prompt_card,
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
        resource_card=final_profile.resource_card(),
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
        intent_r = await asyncio.to_thread(intent_classify, prompt)
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
        "mock_mode": manager.is_mock_mode(),
    }


# ── /api/cache ────────────────────────────────────────────────────────────────

@app.get("/api/cache")
async def api_cache():
    """Return all cached entries for the dashboard cache viewer."""
    return {"items": cache.list_all(), "count": cache.count()}


@app.delete("/api/cache/{key}")
async def api_cache_delete(key: str):
    """Remove a specific key from cache (admin tool)."""
    import sqlite3 as _sq
    from .cache import VECTOR_DB_PATH
    try:
        conn = _sq.connect(str(VECTOR_DB_PATH))
        conn.execute("DELETE FROM vector_cache WHERE key = ?", (key,))
        conn.commit()
        conn.close()
        return {"deleted": key}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


# ── Document Upload & Batch Generation (WOW Feature) ──────────────────────────

@app.post("/api/upload")
async def upload_document(
    file: UploadFile = File(...),
    school_id: str = Form(...),
):
    """
    Full RAG upload pipeline:
    1. Save uploaded file
    2. Extract numbered points via regex
    3. Classify domain with Groq → Gemini → Ollama → keyword fallback
    4. For each point: classify intent + build full prompt card
    5. Check Supabase cache for each point
    6. Return everything as rich JSON
    """
    temp_path = UPLOAD_DIR / f"{uuid.uuid4()}_{file.filename}"
    with open(temp_path, "wb") as f:
        f.write(await file.read())

    try:
        # Step 1: Extract points
        points = extract_points(str(temp_path))

        # Step 2: Classify domain (Groq AI)
        domain = classify_domain(points)

        # Step 3: For every point, build full intent + prompt card
        enriched_points = []
        suggested_types = []

        for i, point in enumerate(points):
            # Suggest output type based on content
            text = point.lower()
            if any(w in text for w in ["draw", "outline", "colour", "color", "shape", "sketch"]):
                suggested_type = "outline"
            elif any(w in text for w in ["poster", "display", "banner", "wall"]):
                suggested_type = "poster"
            elif any(w in text for w in ["define", "meaning", "vocabulary", "term", "worksheet", "exercise", "fill"]):
                suggested_type = "worksheet"
            else:
                suggested_type = "flashcard"

            suggested_types.append(suggested_type)

            # Build full intent-aware prompt from this point
            full_prompt = (
                f"{suggested_type} of {point}, "
                f"{domain.sub_domain} subject, "
                f"{domain.grade_range}, age group {domain.age_group}"
            )

            # Check Supabase cache first
            from . import cache as cache_module
            cache_key = f"{suggested_type}:{point[:40].lower().replace(' ', '_')}"
            cached = cache_module.lookup(cache_key)

            # Classify intent with Groq to get optimized prompts
            try:
                from .intent import classify as intent_classify, build_prompt_card
                intent = intent_classify(full_prompt)
                prompt_card = build_prompt_card(intent)
            except Exception as e:
                logger.warning(f"Intent classify failed for point {i}: {e}")
                prompt_card = None

            enriched_points.append({
                "index": i + 1,
                "text": point,
                "suggested_type": suggested_type,
                "cache_hit": cached is not None,
                "cached_image_url": cached.get("image_url") if cached else None,
                "prompt_card": prompt_card,
            })

        return {
            "points": points,
            "domain": domain.dict(),
            "suggested_types": suggested_types,
            "school_id": school_id,
            "enriched_points": enriched_points,
            "total_points": len(points),
            "rag_provider": "groq/qwen3.8-27b",
        }
    finally:
        if temp_path.exists():
            temp_path.unlink()


class BatchItem(BaseModel):
    point: str
    output_type: str
    school_id: str
    domain: dict

@app.post("/api/batch-generate")
async def batch_generate(items: list[BatchItem]):
    """Run each extracted point through the pipeline and return results + ZIP URL."""
    results = []
    
    for i, item in enumerate(items):
        domain_obj = DomainResult(**item.domain)
        # Build a prompt from the point
        if item.output_type == "outline":
            prompt = f"outline of {item.point}, children's colouring book, {domain_obj.age_group}"
        elif item.output_type == "poster":
            prompt = f"educational poster of {item.point}, {domain_obj.domain}, {domain_obj.grade_range}"
        else:
            prompt = f"flashcard illustration for {item.point}, {domain_obj.sub_domain}, {domain_obj.age_group}"
            
        # We reuse the GenerateEndpoint logic but bypass the API route
        # Actually it's easier to call the generate_image function directly here, or use the GenerateRequest logic
        req = GenerateRequest(prompt=prompt, school_id=item.school_id, mode="smart")
        
        # We simulate hitting the endpoint
        from .intent import classify as intent_classify, build_prompt_card
        
        # VERY simple pipeline for batching to keep it fast
        intent_res = intent_classify(prompt)
        # Force the intent type to match what the user selected
        intent_res.type = item.output_type
        
        profile = get_profile(intent_res.type, 0)
        
        t_gen = time.perf_counter()
        gen_result = await asyncio.to_thread(generate, profile, prompt)
        gpu_s = gen_result.gpu_seconds
        
        latency = (time.perf_counter() - t_gen) * 1000
        
        results.append({
            "point": item.point,
            "image_url": gen_result.image_url,
            "profile": profile.name,
            "gpu_seconds": round(gpu_s, 2),
            "latency_ms": latency
        })
        
        await ws_manager.broadcast({"event": "batch_progress", "completed": i + 1, "total": len(items)})

    return {"results": results, "zip_url": None} # In a real app we'd build a zip file here
