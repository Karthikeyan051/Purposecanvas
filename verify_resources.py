from backend.profiles import PROFILES, BASELINE_PROFILE, BASELINE_SECONDS, BASELINE_WH, BASELINE_CO2_G

print("=== PURPOSECANVAS — RESOURCE CALCULATION TABLE ===")
print(f"GPU Model  : NVIDIA RTX 3080 @ 320W")
print(f"Baseline   : SDXL 1024px 25 steps = {BASELINE_SECONDS}s / {BASELINE_WH} Wh / {BASELINE_CO2_G}g CO2")
print(f"CO2 factor : 0.233 g CO2 per Wh (UK national grid)")
print()

for t, ladder in PROFILES.items():
    print(f"  {t.upper()}")
    for p in ladder:
        print(
            f"    [{p.tier_label:15}] {p.steps:2d}steps {p.width}px "
            f"=> {p.gpu_seconds:6.2f}s | {p.energy_wh:.4f} Wh | {p.co2_grams:.4f}g CO2 "
            f"| SAVED {p.saved_pct}%"
        )
    print()

print("SAMPLE calculation_note (outline draft):")
print(PROFILES["outline"][0].resource_card()["calculation_note"])
