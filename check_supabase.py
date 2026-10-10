import os
import sys
sys.path.append('c:/Users/KARTHIKEYAN/Desktop/Sakthihackfest')
from backend.config import settings
from supabase import create_client

try:
    client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
    res = client.table('vector_cache').select('key, intent_type, image_path').execute()
    print(f'\n=== SUPABASE VECTOR CACHE ===')
    print(f'Total Cached Generations: {len(res.data)}')
    for r in res.data:
        print(f"[{r.get('intent_type', 'unknown')}] {r['key']} -> {r['image_path']}")
except Exception as e:
    print("\nSupabase connection error:", e)
