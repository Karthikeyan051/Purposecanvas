"""
PurposeCanvas — Startup & Download Guide
Run this file to see what needs to be done.
"""
print("""
╔══════════════════════════════════════════════════════════════════╗
║           PURPOSECANVAS — HOW TO START                          ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  1. BACKEND (FastAPI) — OPEN TERMINAL 1:                         ║
║     cd C:\\Users\\KARTHIKEYAN\\Desktop\\Sakthihackfest               ║
║     python -m uvicorn backend.main:app --reload --port 8000      ║
║                                                                  ║
║  2. FRONTEND (Next.js) — OPEN TERMINAL 2:                        ║
║     cd C:\\Users\\KARTHIKEYAN\\Desktop\\Sakthihackfest\\frontend       ║
║     npm install --legacy-peer-deps                               ║
║     npm run dev                                                  ║
║                                                                  ║
║  3. OPEN BROWSER:                                                ║
║     http://localhost:3000  ← Studio (main app)                   ║
║     http://localhost:3000/control-room  ← 3D live view           ║
║     http://localhost:3000/dashboard     ← Cost metrics           ║
║     http://localhost:8000/docs          ← API explorer           ║
║                                                                  ║
╠══════════════════════════════════════════════════════════════════╣
║  OPTIONAL — REAL IMAGE GENERATION (needs internet once):         ║
║                                                                  ║
║  SD-Turbo weights (~1.7 GB, downloads from HuggingFace):         ║
║  python -c "from diffusers import AutoPipelineForText2Image;     ║
║    AutoPipelineForText2Image.from_pretrained(                    ║
║    'stabilityai/sd-turbo', torch_dtype=__import__('torch').      ║
║    float16, variant='fp16')"                                     ║
║                                                                  ║
║  Without weights: app still works in MOCK mode                   ║
║  (shows placeholder images + real GPU timing simulation)         ║
║                                                                  ║
╠══════════════════════════════════════════════════════════════════╣
║  OPTIONAL — GEMINI API (for smarter intent classification):      ║
║                                                                  ║
║  Create .env in project root:                                    ║
║    GEMINI_API_KEY=your_key_here                                  ║
║  Get key at: https://aistudio.google.com/app/apikey              ║
║  Without key: keyword fallback classifier still works            ║
║                                                                  ║
╠══════════════════════════════════════════════════════════════════╣
║  WHAT THE RAG OUTPUT LOOKS LIKE:                                 ║
║                                                                  ║
║  Input:  "draw a cow for children to colour in"                  ║
║  Output JSON:                                                    ║
║  {                                                               ║
║    "intent": {                                                   ║
║      "type": "outline",                                          ║
║      "subject": "cow",                                           ║
║      "colour": "bw",                                             ║
║      "cache_key": "outline:cow"                                  ║
║    },                                                            ║
║    "prompts": {                                                  ║
║      "optimized": "cow, thick clean black line art...",          ║
║      "negative": "color, shading, gradients...",                 ║
║      "midjourney": "cow, thick clean black... --ar 1:1",         ║
║      "dalle3":   "A simple black and white coloring book..."     ║
║    },                                                            ║
║    "generation": {                                               ║
║      "recommended_model": "SD-Turbo (fast, ~1.0s)",             ║
║      "gpu_estimate_seconds": 1.0,                                ║
║      "energy_estimate_wh": 0.0417                                ║
║    }                                                             ║
║  }                                                               ║
║                                                                  ║
║  → COPY any prompt to Midjourney / DALL-E 3 / Adobe Firefly     ║
║                                                                  ║
╠══════════════════════════════════════════════════════════════════╣
║  STATUS CHECK:                                                   ║
╚══════════════════════════════════════════════════════════════════╝
""")

import subprocess, sys

checks = [
    ("diffusers",          "✅ diffusers installed"),
    ("accelerate",         "✅ accelerate installed"),
    ("sentence_transformers", "✅ sentence-transformers installed"),
    ("google.genai",       "✅ google-genai installed"),
    ("numpy",              "✅ numpy installed"),
    ("PIL",                "✅ Pillow installed"),
    ("fastapi",            "✅ FastAPI installed"),
    ("pynvml",             "✅ pynvml installed (real GPU power)"),
]

for mod, label in checks:
    try:
        __import__(mod.replace("-", "_").replace(".", "_").split("_")[0] if "." in mod else mod)
        print(f"  {label}")
    except ImportError:
        print(f"  ❌ {mod} NOT INSTALLED → pip install {mod}")

# Check GPU
try:
    import torch
    if torch.cuda.is_available():
        name = torch.cuda.get_device_name(0)
        vram = torch.cuda.get_device_properties(0).total_memory / 1e9
        print(f"\n  ✅ GPU: {name} ({vram:.1f} GB VRAM)")
    else:
        print("\n  ⚠️  No CUDA GPU detected — will use CPU (slow)")
except Exception as e:
    print(f"\n  ❌ PyTorch error: {e}")

# Check backend
try:
    import urllib.request
    r = urllib.request.urlopen("http://localhost:8000/api/health", timeout=2)
    import json
    data = json.loads(r.read())
    print(f"\n  ✅ Backend RUNNING — cache_items={data['cache_items']} mock_mode={data['mock_mode']}")
except Exception:
    print("\n  ⚠️  Backend NOT running — start it with: python -m uvicorn backend.main:app --reload --port 8000")

print()
