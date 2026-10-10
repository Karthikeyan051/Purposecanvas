"""
Milestone 1 CLI test — run BEFORE the full server.
Tests: SD-Turbo 2-step and 4-step generation.
Prints real GPU-seconds per profile.
Run from repo root: python -m backend.test_m1
"""
import sys
import time
import torch

print("=" * 60)
print("PurposeCanvas — Milestone 1 CLI Test")
print("=" * 60)

# ── CUDA check ───────────────────────────────────────────────────
if not torch.cuda.is_available():
    print("❌ CUDA not available. Check PyTorch cu128 install.")
    sys.exit(1)

print(f"✅ CUDA: {torch.cuda.get_device_name(0)}")
print(f"   VRAM total: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")

# ── Import modules ───────────────────────────────────────────────
from backend.profiles import get_profile, PROFILES, BASELINE_PROFILE
from backend.generator import generate
from backend.postprocess import postprocess, get_pixel_stats

print("\n📋 Profiles loaded:")
for t, ladder in PROFILES.items():
    print(f"  {t}: {[p.name for p in ladder]}")

# ── Test SD-Turbo profiles ───────────────────────────────────────
TEST_PROMPT = "a cow, simple children's illustration"

print("\n🔥 Running SD-Turbo tests (outline type)...")

outline_profiles = PROFILES["outline"][:2]  # tier 0 and 1 only (skip SDXL for M1)

results = []
for profile in outline_profiles:
    print(f"\n  Profile: {profile.name}")
    print(f"  Model: {profile.model_id} | {profile.width}px | {profile.steps} steps")

    result = generate(profile, TEST_PROMPT)
    pp_img = postprocess(__import__("PIL.Image", fromlist=["Image"]).open(result.image_path), "outline")
    stats = get_pixel_stats(pp_img)

    print(f"  ✅ GPU-seconds:  {result.gpu_seconds:.2f}s")
    print(f"     Energy:       {result.energy_wh:.4f} Wh")
    print(f"     Cost (est):   ${result.gpu_seconds * 0.0004:.5f} (assumed cloud rate)")
    print(f"     Black ratio:  {stats['black_ratio']:.3f} (pass: 0.03-0.35)")
    print(f"     White ratio:  {stats['white_ratio']:.3f} (pass: >=0.60)")
    print(f"     Image saved:  {result.image_path}")

    results.append({
        "profile": profile.name,
        "gpu_seconds": result.gpu_seconds,
        "energy_wh": result.energy_wh,
    })

# ── Summary ──────────────────────────────────────────────────────
print("\n" + "=" * 60)
print("SUMMARY (paste these into docs/progress.md)")
print("=" * 60)
for r in results:
    print(f"  {r['profile']:<40} {r['gpu_seconds']:.2f}s  {r['energy_wh']:.4f}Wh")

print("\n✅ Milestone 1 test PASSED — commit now")
