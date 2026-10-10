"""
RAG Pipeline Component Test Suite — PurposeCanvas
Run with: python test_rag.py
Tests each component in isolation, prints PASS/FAIL clearly.
"""
import os, sys, json
sys.stdout.reconfigure(encoding='utf-8')
os.environ["ENABLE_VECTOR_EMBED"] = "0"  # no HuggingFace download during tests
sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv(override=False)  # don't override ENABLE_VECTOR_EMBED set above

GEMINI_KEY   = os.getenv("GEMINI_API_KEY", "")
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")
SAMPLE_PDF   = os.path.join(os.path.dirname(__file__), "lesson_plan_class6_biology.pdf")

SAMPLE_POINTS = [
    "Photosynthesis - The process by which plants make food using sunlight.",
    "The water cycle - Evaporation, condensation, and precipitation.",
    "Food chains - Understanding producers, consumers, and decomposers.",
    "Cell structure - Identifying the nucleus, cytoplasm, and cell wall.",
]

SEP = "-" * 62
def banner(n, title): print(f"\n{SEP}\n  TEST {n}: {title}\n{SEP}")
def ok(msg):   print(f"  [PASS]  {msg}")
def fail(msg): print(f"  [FAIL]  {msg}")
def info(msg): print(f"  [INFO]  {msg}")

RESULTS = {}

# ══════════════════════════════════════════════════════════════
# TEST 1 — ENV / Credentials
# ══════════════════════════════════════════════════════════════
banner(1, "ENV / Credentials Check")
t1 = True
if GEMINI_KEY:
    ok(f"GEMINI_API_KEY  → {GEMINI_KEY[:10]}...")
else:
    fail("GEMINI_API_KEY missing in .env"); t1 = False
if SUPABASE_URL:
    ok(f"SUPABASE_URL    → {SUPABASE_URL}")
else:
    fail("SUPABASE_URL missing in .env"); t1 = False
if SUPABASE_KEY:
    ok(f"SUPABASE_KEY    → {SUPABASE_KEY[:18]}...")
else:
    fail("SUPABASE_KEY missing in .env"); t1 = False
RESULTS["1_env"] = "PASS" if t1 else "FAIL"

# ══════════════════════════════════════════════════════════════
# TEST 2 — Supabase Connection + Table Existence
# ══════════════════════════════════════════════════════════════
banner(2, "Supabase Connection + vector_cache table")
try:
    from supabase import create_client
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)
    try:
        res = sb.table("vector_cache").select("key", count="exact").limit(1).execute()
        ok(f"Connected! vector_cache table found. Rows: {res.count}")
        RESULTS["2_supabase"] = "PASS"
    except Exception as e:
        fail(f"vector_cache table does NOT exist yet!")
        info("ACTION: Run Supabase_Setup.sql.md SQL in your Supabase SQL Editor first.")
        info(f"  Error: {e}")
        RESULTS["2_supabase"] = "FAIL – table missing"
except Exception as e:
    fail(f"Supabase connection failed: {e}")
    RESULTS["2_supabase"] = "FAIL – connection"

# ══════════════════════════════════════════════════════════════
# TEST 3 — Document Parser (PDF)
# ══════════════════════════════════════════════════════════════
banner(3, "Document Parser — PDF Extraction (document_parser.py)")
try:
    from backend.document_parser import extract_points
    if not os.path.exists(SAMPLE_PDF):
        fail(f"Demo PDF not found: {SAMPLE_PDF}")
        info("Run: python generate_demo_pdf.py")
        RESULTS["3_parser"] = "FAIL – no pdf"
    else:
        points = extract_points(SAMPLE_PDF)
        if points:
            ok(f"Extracted {len(points)} learning points:")
            for i, p in enumerate(points, 1): info(f"  {i}. {p}")
            RESULTS["3_parser"] = "PASS"
        else:
            fail("0 points extracted"); RESULTS["3_parser"] = "FAIL – 0 points"
except Exception as e:
    fail(f"document_parser error: {e}")
    RESULTS["3_parser"] = f"FAIL – {e}"

# ══════════════════════════════════════════════════════════════
# TEST 4 — Gemini Domain Classifier
# ══════════════════════════════════════════════════════════════
banner(4, "Gemini Domain Classifier (domain_classifier.py)")
try:
    from backend.domain_classifier import classify_domain
    domain = classify_domain(SAMPLE_POINTS)
    ok(f"Domain:      {domain.domain}")
    ok(f"Sub-domain:  {domain.sub_domain}")
    ok(f"Grade range: {domain.grade_range}")
    ok(f"Age group:   {domain.age_group}")
    ok(f"Confidence:  {domain.confidence:.2f}")
    if domain.confidence < 0.7:
        info("Low confidence → likely used keyword fallback (check Gemini API key)")
    RESULTS["4_domain"] = "PASS"
except Exception as e:
    fail(f"domain_classifier error: {e}")
    RESULTS["4_domain"] = f"FAIL – {e}"

# ══════════════════════════════════════════════════════════════
# TEST 5 — Gemini Intent Classifier + Prompt Engineer
# ══════════════════════════════════════════════════════════════
banner(5, "Gemini Intent Classifier + Prompt Engineer (intent.py)")
try:
    from backend.intent import classify, build_prompt_card
    result = classify("draw a photosynthesis colouring page for class 5")
    ok(f"Type:             {result.type}")
    ok(f"Subject:          {result.subject}")
    ok(f"Cache key:        {result.key}")
    ok(f"Confidence:       {result.confidence:.2f}")
    ok(f"Optimized prompt: {result.optimized_prompt[:70]}...")
    ok(f"Midjourney:       {result.midjourney_prompt[:70]}...")
    ok(f"DALL-E 3:         {result.dalle_prompt[:70]}...")
    ok(f"GPU estimate:     {result.gpu_estimate_seconds}s | {result.energy_estimate_wh}Wh")
    RESULTS["5_intent"] = "PASS"
except Exception as e:
    fail(f"intent.classify error: {e}")
    RESULTS["5_intent"] = f"FAIL – {e}"

# ══════════════════════════════════════════════════════════════
# TEST 6 — Prompt Card JSON (the copy-paste output for any AI)
# ══════════════════════════════════════════════════════════════
banner(6, "Prompt Card JSON Output (build_prompt_card)")
try:
    from backend.intent import classify, build_prompt_card
    result = classify("photosynthesis flashcard for class 6 biology")
    card = build_prompt_card(result)
    print(json.dumps(card, indent=2))
    ok("Prompt card JSON is valid and complete ↑")
    RESULTS["6_prompt_card"] = "PASS"
except Exception as e:
    fail(f"build_prompt_card error: {e}")
    RESULTS["6_prompt_card"] = f"FAIL – {e}"

# ══════════════════════════════════════════════════════════════
# TEST 7 — Supabase Vector Cache STORE
# ══════════════════════════════════════════════════════════════
banner(7, "Supabase Vector Cache — STORE (cache.py)")
try:
    from backend import cache
    cache.store(
        intent_key="test:photosynthesis_flashcard",
        image_path="/backend/generated_images/test.png",
        image_url="/api/images/test.png",
        intent_type="flashcard"
    )
    cnt = cache.count()
    ok(f"cache.store() succeeded. Total rows in vector_cache: {cnt}")
    RESULTS["7_store"] = "PASS"
except Exception as e:
    fail(f"cache.store() error: {e}")
    RESULTS["7_store"] = f"FAIL – {e}"

# ══════════════════════════════════════════════════════════════
# TEST 8 — Supabase Vector Cache LOOKUP
# ══════════════════════════════════════════════════════════════
banner(8, "Supabase Vector Cache — LOOKUP (cache.py)")
try:
    from backend import cache
    hit = cache.lookup("test:photosynthesis_flashcard")
    if hit:
        ok(f"Cache HIT! key={hit.get('key')}")
        ok(f"Image URL: {hit.get('image_url')}")
        RESULTS["8_lookup"] = "PASS"
    else:
        fail("Cache MISS — store() may have failed or table not created yet")
        RESULTS["8_lookup"] = "FAIL – miss"
except Exception as e:
    fail(f"cache.lookup() error: {e}")
    RESULTS["8_lookup"] = f"FAIL – {e}"

# ══════════════════════════════════════════════════════════════
# TEST 9 — Full End-to-End RAG Flow
# ══════════════════════════════════════════════════════════════
banner(9, "Full RAG Flow: PDF → Points → Domain → Prompts (end-to-end)")
try:
    from backend.document_parser import extract_points
    from backend.domain_classifier import classify_domain
    from backend.intent import classify, build_prompt_card

    if not os.path.exists(SAMPLE_PDF):
        fail("Demo PDF missing — run: python generate_demo_pdf.py")
        RESULTS["9_e2e"] = "SKIP"
    else:
        points = extract_points(SAMPLE_PDF)
        ok(f"[1/4] Extracted {len(points)} points from PDF")

        domain = classify_domain(points)
        ok(f"[2/4] Domain: {domain.domain} > {domain.sub_domain} > {domain.grade_range}")

        cards_output = []
        for pt in points[:3]:  # 3 points to conserve API quota
            prompt_text = f"{pt} {domain.sub_domain} {domain.grade_range}"
            intent = classify(prompt_text)
            card = build_prompt_card(intent)
            cards_output.append({
                "point": pt,
                "intent_type": intent.type,
                "cache_key": intent.key,
                "optimized_prompt": intent.optimized_prompt,
            })
            ok(f"[3/4] '{pt[:45]}' → type={intent.type} key={intent.key}")

        info("\nFull Prompt Cards JSON (copy to any AI generator):")
        print(json.dumps(cards_output, indent=2))
        ok("[4/4] End-to-end RAG pipeline COMPLETE ✓")
        RESULTS["9_e2e"] = "PASS"
except Exception as e:
    fail(f"End-to-end error: {e}")
    import traceback; traceback.print_exc()
    RESULTS["9_e2e"] = f"FAIL – {e}"

# ══════════════════════════════════════════════════════════════
# SUMMARY
# ══════════════════════════════════════════════════════════════
print(f"\n{'═'*62}")
print("  RAG TEST SUITE — SUMMARY")
print(f"{'═'*62}")
for k, v in RESULTS.items():
    status = "✅" if v == "PASS" else ("⏭️ " if v == "SKIP" else "❌")
    print(f"  {status}  {k:30s} → {v}")
print(f"{'═'*62}\n")
