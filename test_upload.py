import time
import requests
import json

time.sleep(3)
with open('demo_class6_lesson_plan.pdf', 'rb') as f:
    print("Uploading PDF to backend...")
    r = requests.post('http://localhost:8000/api/upload',
        files={'file': ('demo.pdf', f, 'application/pdf')},
        data={'school_id': 's01'},
        timeout=120
    )

print('Status:', r.status_code)
if r.status_code == 200:
    d = r.json()
    print('Domain:', json.dumps(d['domain'], indent=2))
    print('RAG Provider:', d.get('rag_provider'))
    print('Total points:', d['total_points'])
    print()
    # Show first 2 enriched points with full prompt cards
    for ep in d['enriched_points'][:2]:
        print(f"--- Point {ep['index']}: {ep['text'][:60]}...")
        print(f"    Type: {ep['suggested_type']} | Cache Hit: {ep['cache_hit']}")
        if ep['prompt_card']:
            pc = ep['prompt_card']['purposecanvas_prompt_card']
            print(f"    Intent: {json.dumps(pc['intent'], indent=6)}")
            print(f"    Prompts:")
            for k,v in pc['prompts'].items():
                print(f"      [{k}]: {v[:120]}")
            print(f"    GPU estimate: {pc['generation']['gpu_estimate_seconds']}s")
        print()
else:
    print(r.text)
