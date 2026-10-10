"""
Download all-MiniLM-L6-v2 from HuggingFace with progress bar.
Run with: python download_minilm.py
The model is 91MB and is cached at: ~/.cache/huggingface/hub/
"""
import sys
import os

print("Downloading all-MiniLM-L6-v2 (91MB)...")
print("This is a one-time download. It will be cached locally forever after.\n")

try:
    from sentence_transformers import SentenceTransformer
    
    # This triggers the download with a built-in progress bar
    model = SentenceTransformer("all-MiniLM-L6-v2")
    
    # Test it immediately
    test_texts = [
        "photosynthesis flashcard",
        "water cycle diagram",
        "food chain poster"
    ]
    
    print("\nTesting model with sample educational prompts...")
    for text in test_texts:
        vec = model.encode(text)
        print(f"  '{text}' -> vector dim={len(vec)}, first values={vec[:3].round(4)}")
    
    # Test similarity (the core of the RAG)
    from sentence_transformers import util
    v1 = model.encode("photosynthesis colouring page", normalize_embeddings=True)
    v2 = model.encode("photosynthesis outline worksheet", normalize_embeddings=True)
    v3 = model.encode("water cycle evaporation", normalize_embeddings=True)
    
    sim_12 = float(util.cos_sim(v1, v2))
    sim_13 = float(util.cos_sim(v1, v3))
    
    print(f"\nSemantic similarity test:")
    print(f"  'photosynthesis colouring' vs 'photosynthesis outline' -> {sim_12:.3f} (should be HIGH ~0.9)")
    print(f"  'photosynthesis colouring' vs 'water cycle evaporation' -> {sim_13:.3f} (should be LOW ~0.3)")
    
    if sim_12 > 0.7 and sim_13 < 0.7:
        print("\n[SUCCESS] Model is working correctly! Semantic search is ready.")
        print("          Your Supabase RAG cache will now find similar prompts, not just exact matches.")
    else:
        print("\n[WARN] Similarity values unexpected - model may need checking.")

except ImportError:
    print("[ERROR] sentence-transformers not installed.")
    print("Run: pip install sentence-transformers")
except Exception as e:
    print(f"[ERROR] {e}")
