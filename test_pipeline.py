import urllib.request
import json

payload = json.dumps({
    "prompt": "draw a cow for kids to colour in",
    "school_id": "s01",
    "mode": "smart"
}).encode()

req = urllib.request.Request(
    "http://localhost:8000/api/generate",
    data=payload,
    headers={"Content-Type": "application/json"},
    method="POST"
)

try:
    r = urllib.request.urlopen(req, timeout=60)
    data = json.loads(r.read())
    print("=== GENERATE PIPELINE RESULT ===")
    print(f"image_url:    {data['image_url']}")
    print(f"intent_type:  {data['intent']['type']}")
    print(f"intent_key:   {data['intent']['key']}")
    print(f"confidence:   {data['intent'].get('confidence', 'N/A')}")
    print(f"profile:      {data['profile']}")
    print(f"cache_hit:    {data['cache_hit']}")
    print(f"gpu_seconds:  {data['gpu_seconds']}")
    print(f"energy_wh:    {data['energy_wh']}")
    print(f"saved_pct:    {data['saved_pct']}%")
    print(f"latency_ms:   {data['latency_ms']:.1f}ms")
    print()
    print("Pipeline steps:")
    for s in data.get("steps", []):
        print(f"  [{s['name']:12s}] {s['duration_ms']:8.1f}ms  {s['detail']}")

    # Second request: same prompt -> should be cache HIT
    print()
    print("=== SECOND REQUEST (expect cache HIT) ===")
    r2 = urllib.request.urlopen(req, timeout=60)
    d2 = json.loads(r2.read())
    print(f"cache_hit:   {d2['cache_hit']}")
    print(f"gpu_seconds: {d2['gpu_seconds']}")
    print(f"saved_pct:   {d2['saved_pct']}%")

except Exception as e:
    import traceback
    traceback.print_exc()
    print(f"ERROR: {e}")
